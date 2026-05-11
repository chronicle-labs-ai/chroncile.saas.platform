//! `BacktestService` — the in-process orchestrator wrapper that the
//! HTTP layer talks to. Owns the active-job table (used by SSE +
//! cancellation) and the broadcast channel topology.
//!
//! Lifecycle:
//!
//! * `submit(plan)` — persists the job row, spawns `run_job` on a
//!   `tokio::task::JoinHandle`, registers a per-job `broadcast::Sender`
//!   so SSE consumers can subscribe.
//! * `subscribe(job_id)` — hands out a `broadcast::Receiver` for the
//!   SSE handler.
//! * `cancel(job_id)` — `JoinHandle::abort()`. The orchestrator's
//!   `SandboxGuard::Drop` impl ensures sandboxes don't leak.
//! * Active-job entry is GC'd via a watchdog that polls
//!   `JoinHandle::is_finished()` from the spawned run task.

use chronicle_domain::{
    BacktestEnvironmentRef, BacktestJobRecord, CreateBacktestJobInput, SandboxDriver, TrialEvent,
};
use chronicle_interfaces::{
    BacktestArtifactRepository, BacktestJobRepository, BacktestTrialRepository, RepoResult,
};
use chronicle_orchestrator::{
    AgentRunner, Grader, JobDeps, JobPlan, OrchestratorState, SandboxFactory, TrialEventSink,
};
use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::broadcast;
use tokio::task::JoinHandle;

/// Per-job runtime entry held by the service while the job is in flight.
struct ActiveJob {
    /// Broadcast sender re-emits every `TrialEvent` from the
    /// orchestrator. SSE handlers subscribe via `subscribe()`.
    sender: broadcast::Sender<TrialEvent>,
    /// Top-level handle for the spawned `run_job` task. `JoinHandle::abort()`
    /// cancels the in-flight trials.
    run_handle: parking_lot::Mutex<Option<JoinHandle<()>>>,
}

/// Capacity of the per-job broadcast ring. Late subscribers can lose
/// the very first events if the queue fills before they connect; the
/// orchestrator-side persistence is the authoritative state.
const BROADCAST_CAP: usize = 256;

/// All the moving parts the HTTP layer hands to the orchestrator.
/// One instance per process; cloned cheaply (everything is `Arc`).
#[derive(Clone)]
pub struct BacktestService {
    pub jobs_repo: Arc<dyn BacktestJobRepository>,
    pub trials_repo: Arc<dyn BacktestTrialRepository>,
    pub artifacts_repo: Arc<dyn BacktestArtifactRepository>,

    pub agent_runner: Arc<dyn AgentRunner>,
    pub grader: Arc<dyn Grader>,
    pub sandbox_factory: SandboxFactory,
    pub orchestrator_state: Arc<OrchestratorState>,

    /// Static availability data — datasets, environments, agents the
    /// recipe picker can choose from. Phase 5+ replaces this with a
    /// real catalog backed by `domain::datasets` / agent registry.
    pub availability: Arc<BacktestsAvailabilityData>,

    active: Arc<DashMap<String, Arc<ActiveJob>>>,
}

/// Static-for-now availability data. Same shape the dashboard's
/// `BacktestsAvailability` consumes; the route handler projects it
/// into the wire response. Held inside an `Arc` so cloning the
/// service is still cheap.
#[derive(Debug, Clone, Default)]
pub struct BacktestsAvailabilityData {
    pub datasets: Vec<chronicle_domain::Dataset>,
    pub dataset_snapshots: std::collections::HashMap<
        String,
        chronicle_domain::DatasetSnapshot,
    >,
    pub environments: Vec<BacktestEnvironmentRef>,
    pub agents: Vec<chronicle_domain::AgentSummary>,
}

impl BacktestService {
    pub fn new(
        jobs_repo: Arc<dyn BacktestJobRepository>,
        trials_repo: Arc<dyn BacktestTrialRepository>,
        artifacts_repo: Arc<dyn BacktestArtifactRepository>,
        agent_runner: Arc<dyn AgentRunner>,
        grader: Arc<dyn Grader>,
        sandbox_factory: SandboxFactory,
    ) -> Self {
        Self {
            jobs_repo,
            trials_repo,
            artifacts_repo,
            agent_runner,
            grader,
            sandbox_factory,
            orchestrator_state: Arc::new(OrchestratorState::new()),
            availability: Arc::new(BacktestsAvailabilityData::default()),
            active: Arc::new(DashMap::new()),
        }
    }

    /// Replace the availability dataset (datasets, environments,
    /// agents). Used by the runtime builder to seed dev fixtures.
    #[must_use]
    pub fn with_availability(mut self, data: BacktestsAvailabilityData) -> Self {
        self.availability = Arc::new(data);
        self
    }

    /// Persist the `BacktestJob` row and return the freshly-created
    /// record. The caller (POST /jobs handler) typically follows this
    /// with `start_run(plan)` once the JobPlan is built.
    pub async fn create_job_row(
        &self,
        input: CreateBacktestJobInput,
    ) -> RepoResult<BacktestJobRecord> {
        self.jobs_repo.create(input).await
    }

    /// Spawn `run_job` in the background. Returns immediately; the
    /// caller relays the `BacktestJobRecord` to the HTTP client.
    ///
    /// The job's broadcast channel is registered before the spawn so
    /// SSE subscribers connecting milliseconds later still see the
    /// `JobStarted` event.
    pub fn start_run(&self, plan: JobPlan) {
        let job_id = plan.job_id.clone();
        let (sender, _) = broadcast::channel::<TrialEvent>(BROADCAST_CAP);

        let active = ActiveJob {
            sender: sender.clone(),
            run_handle: parking_lot::Mutex::new(None),
        };
        let active = Arc::new(active);
        self.active.insert(job_id.clone(), Arc::clone(&active));

        // Build the event sink that fans events out to the broadcast
        // channel. Senders ignore "no active receivers" errors —
        // events that nobody listened to are intentionally lost
        // (the orchestrator persists the authoritative state).
        let sender_for_sink = sender.clone();
        let event_sink: TrialEventSink = Arc::new(move |event| {
            let _ = sender_for_sink.send(event);
        });

        let deps = JobDeps {
            jobs: Arc::clone(&self.jobs_repo),
            trials: Arc::clone(&self.trials_repo),
            artifacts: Arc::clone(&self.artifacts_repo),
            agent_runner: Arc::clone(&self.agent_runner),
            grader: Arc::clone(&self.grader),
            state: Arc::clone(&self.orchestrator_state),
            event_sink,
        };

        let factory = self.sandbox_factory.clone();
        let active_table = Arc::clone(&self.active);
        let active_for_cleanup = Arc::clone(&active);
        let job_id_for_log = job_id.clone();

        let run_handle = tokio::spawn(async move {
            let outcome = chronicle_orchestrator::run_job(plan, deps, factory).await;
            match outcome {
                Ok(o) => tracing::info!(
                    job_id = %job_id_for_log,
                    status = ?o.status,
                    completed = o.completed_trials,
                    failed = o.failed_trials,
                    "run_job finished"
                ),
                Err(e) => tracing::error!(
                    job_id = %job_id_for_log,
                    error = %e,
                    "run_job errored"
                ),
            }
            // Drop the broadcast sender on completion so any remaining
            // subscribers see `RecvError::Closed`. Then GC the entry —
            // late subscribers can no longer get a new receiver.
            drop(active_for_cleanup);
            active_table.remove(&job_id_for_log);
        });

        *active.run_handle.lock() = Some(run_handle);
    }

    /// Subscribe to the per-job event stream. Returns `None` if the
    /// job has already finished and been GC'd — the SSE handler should
    /// fall back to "stream historical state from the DB then close"
    /// in that case (Phase 3.5; for now a `None` results in an empty
    /// stream that closes immediately).
    pub fn subscribe(&self, job_id: &str) -> Option<broadcast::Receiver<TrialEvent>> {
        self.active.get(job_id).map(|entry| entry.sender.subscribe())
    }

    /// Cancel the job's in-flight task. Returns `true` if the job was
    /// active and `abort()` was called; `false` if the job had already
    /// finished. Cleanup of the sandboxes is delegated to the
    /// orchestrator's `SandboxGuard::Drop`.
    pub fn cancel(&self, job_id: &str) -> bool {
        if let Some(entry) = self.active.get(job_id) {
            if let Some(handle) = entry.run_handle.lock().take() {
                handle.abort();
                return true;
            }
        }
        false
    }

    /// Fast path for the dashboard: which jobs are currently running
    /// in this process? Used by the CLI's `chronicle jobs ls --live`
    /// to filter without scanning the database.
    pub fn active_job_ids(&self) -> Vec<String> {
        self.active
            .iter()
            .map(|entry| entry.key().clone())
            .collect()
    }
}

/// Parameters for the create-job HTTP request. Distinct from
/// `chronicle_domain::JobConfig` because the API also accepts
/// caller-supplied case enumeration (Phase 3.5 will move this server-side
/// once `domain::datasets` has case storage).
#[derive(Debug, Clone)]
pub struct CreateJobParams {
    pub recipe: chronicle_domain::BacktestRecipe,
    pub cases: Vec<JobCaseInput>,
    pub n_concurrent: u32,
    pub sandbox_driver: SandboxDriver,
    pub retry_config: Option<chronicle_domain::RetryConfig>,
    pub created_by: Option<String>,
}

#[derive(Debug, Clone)]
pub struct JobCaseInput {
    pub case_id: String,
    pub case_cluster: Option<String>,
    pub instruction: String,
}

/// Active-job projection for the CLI / dashboard "what's running"
/// view. Refreshed each call from the runtime table — no caching.
#[derive(Debug, Clone)]
pub struct ActiveJobInfo {
    pub job_id: String,
    pub aborted: bool,
}

impl BacktestService {
    /// Detailed view of every active job. Cheap; reads the dashmap.
    pub fn active_jobs(&self) -> Vec<ActiveJobInfo> {
        self.active
            .iter()
            .map(|entry| ActiveJobInfo {
                job_id: entry.key().clone(),
                aborted: entry
                    .run_handle
                    .lock()
                    .as_ref()
                    .map(|h| h.is_finished())
                    .unwrap_or(true),
            })
            .collect()
    }
}

/// Convenience: build a service backed by `MockAgentRunner` +
/// `SandboxFactory::Default`. Used by the in-memory dev path and by
/// integration tests that exercise the HTTP layer end-to-end.
pub fn build_default_service(
    jobs: Arc<dyn BacktestJobRepository>,
    trials: Arc<dyn BacktestTrialRepository>,
    artifacts: Arc<dyn BacktestArtifactRepository>,
) -> BacktestService {
    BacktestService::new(
        jobs,
        trials,
        artifacts,
        Arc::new(chronicle_orchestrator::MockAgentRunner::always_ok()),
        Arc::new(chronicle_orchestrator::MockGrader::default()),
        SandboxFactory::Default,
    )
}

