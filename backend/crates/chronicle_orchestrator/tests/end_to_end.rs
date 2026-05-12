//! End-to-end orchestrator test using `MockSandbox`, `MockAgentRunner`,
//! and in-memory repository stubs. Exercises the full Trial lifecycle
//! and the Job-level Semaphore + retry logic without any container
//! infrastructure.

use async_trait::async_trait;
use chronicle_domain::{
    BacktestArtifactKind, BacktestArtifactRecord, BacktestJobMode, BacktestJobRecord,
    BacktestTrialRecord, CreateBacktestJobInput, CreateBacktestTrialInput, JobStatus, RetryConfig,
    SandboxDriver, TrialEvent, TrialException, TrialStatus, TrialTimings,
};
use chronicle_interfaces::{
    BacktestArtifactRepository, BacktestJobRepository, BacktestTrialRepository, RepoError,
    RepoResult, TrialTimingMarker,
};
use chronicle_orchestrator::{
    run_job, AgentRunOutcome, JobDeps, JobPlan, MockAgentRunner, OrchestratorState, SandboxFactory,
    TrialPlan, TrialStartOpts, TrialTimeouts,
};
use chronicle_sandbox::{
    drivers::{ExecStub, MockSandbox},
    ExecResult, ImageSource, ResourceLimits,
};
use parking_lot::Mutex;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

/* ── In-memory repos ──────────────────────────────────────── */

#[derive(Default)]
struct InMemoryStore {
    jobs: Mutex<HashMap<String, BacktestJobRecord>>,
    trials: Mutex<HashMap<String, BacktestTrialRecord>>,
    rewards: Mutex<HashMap<String, HashMap<String, f64>>>,
    artifacts: Mutex<HashMap<String, Vec<BacktestArtifactRecord>>>,
    /// Records the order timing markers were stamped so tests can
    /// assert "envSetup → agentRun → verifier" ordering.
    timing_log: Mutex<Vec<(String, TrialTimingMarker)>>,
}

#[derive(Clone)]
struct JobRepo(Arc<InMemoryStore>);
#[derive(Clone)]
struct TrialRepo(Arc<InMemoryStore>);
#[derive(Clone)]
struct ArtifactRepo(Arc<InMemoryStore>);

#[async_trait]
impl BacktestJobRepository for JobRepo {
    async fn create(
        &self,
        input: CreateBacktestJobInput,
    ) -> RepoResult<BacktestJobRecord> {
        let id = ulid::Ulid::new().to_string();
        let now = chrono::Utc::now();
        let rec = BacktestJobRecord {
            id: id.clone(),
            tenant_id: input.tenant_id,
            name: input.name,
            mode: input.mode,
            recipe: input.recipe,
            status: JobStatus::Pending,
            verdict: None,
            n_concurrent: input.n_concurrent,
            sandbox_driver: input.sandbox_driver,
            retry_config: input.retry_config,
            created_by: input.created_by,
            scheduled_for: input.scheduled_for,
            created_at: now,
            started_at: None,
            finished_at: None,
            total_trials: None,
            completed_trials: 0,
            failed_trials: 0,
            exception_kind: None,
            updated_at: now,
        };
        self.0.jobs.lock().insert(id, rec.clone());
        Ok(rec)
    }

    async fn find_by_id(&self, id: &str) -> RepoResult<Option<BacktestJobRecord>> {
        Ok(self.0.jobs.lock().get(id).cloned())
    }

    async fn list_by_tenant(
        &self,
        tenant_id: &str,
        _mode: Option<BacktestJobMode>,
        _status: Option<JobStatus>,
        _limit: usize,
        _offset: usize,
    ) -> RepoResult<Vec<BacktestJobRecord>> {
        Ok(self
            .0
            .jobs
            .lock()
            .values()
            .filter(|r| r.tenant_id == tenant_id)
            .cloned()
            .collect())
    }

    async fn count_by_tenant(&self, tenant_id: &str) -> RepoResult<usize> {
        Ok(self
            .0
            .jobs
            .lock()
            .values()
            .filter(|r| r.tenant_id == tenant_id)
            .count())
    }

    async fn update_status(
        &self,
        id: &str,
        status: JobStatus,
        started_at: Option<chrono::DateTime<chrono::Utc>>,
        finished_at: Option<chrono::DateTime<chrono::Utc>>,
    ) -> RepoResult<BacktestJobRecord> {
        let mut jobs = self.0.jobs.lock();
        let rec = jobs
            .get_mut(id)
            .ok_or_else(|| RepoError::NotFound(id.to_string()))?;
        rec.status = status;
        if let Some(t) = started_at {
            rec.started_at = Some(t);
        }
        if let Some(t) = finished_at {
            rec.finished_at = Some(t);
        }
        rec.updated_at = chrono::Utc::now();
        Ok(rec.clone())
    }

    async fn update_summary(
        &self,
        id: &str,
        total_trials: Option<u32>,
        completed_trials: u32,
        failed_trials: u32,
        exception_kind: Option<&str>,
    ) -> RepoResult<BacktestJobRecord> {
        let mut jobs = self.0.jobs.lock();
        let rec = jobs
            .get_mut(id)
            .ok_or_else(|| RepoError::NotFound(id.to_string()))?;
        if let Some(t) = total_trials {
            rec.total_trials = Some(t);
        }
        rec.completed_trials = completed_trials;
        rec.failed_trials = failed_trials;
        if let Some(k) = exception_kind {
            rec.exception_kind = Some(k.to_string());
        }
        rec.updated_at = chrono::Utc::now();
        Ok(rec.clone())
    }

    async fn set_verdict(&self, id: &str, verdict: &str) -> RepoResult<BacktestJobRecord> {
        let mut jobs = self.0.jobs.lock();
        let rec = jobs
            .get_mut(id)
            .ok_or_else(|| RepoError::NotFound(id.to_string()))?;
        rec.verdict = Some(verdict.to_string());
        Ok(rec.clone())
    }
}

#[async_trait]
impl BacktestTrialRepository for TrialRepo {
    async fn create(
        &self,
        input: CreateBacktestTrialInput,
    ) -> RepoResult<BacktestTrialRecord> {
        let id = ulid::Ulid::new().to_string();
        let now = chrono::Utc::now();
        let rec = BacktestTrialRecord {
            id: id.clone(),
            job_id: input.job_id,
            tenant_id: input.tenant_id,
            agent_id: input.agent_id,
            agent_label: input.agent_label,
            is_baseline: input.is_baseline,
            case_id: input.case_id,
            case_cluster: input.case_cluster,
            status: TrialStatus::Pending,
            timings: TrialTimings::default(),
            duration_ms: None,
            sandbox_id: None,
            exception: None,
            attempt: 0,
            created_at: now,
            updated_at: now,
        };
        self.0.trials.lock().insert(id, rec.clone());
        Ok(rec)
    }

    async fn find_by_id(&self, id: &str) -> RepoResult<Option<BacktestTrialRecord>> {
        Ok(self.0.trials.lock().get(id).cloned())
    }

    async fn list_by_job(&self, job_id: &str) -> RepoResult<Vec<BacktestTrialRecord>> {
        Ok(self
            .0
            .trials
            .lock()
            .values()
            .filter(|r| r.job_id == job_id)
            .cloned()
            .collect())
    }

    async fn list_by_job_status(
        &self,
        job_id: &str,
        status: TrialStatus,
    ) -> RepoResult<Vec<BacktestTrialRecord>> {
        Ok(self
            .0
            .trials
            .lock()
            .values()
            .filter(|r| r.job_id == job_id && r.status == status)
            .cloned()
            .collect())
    }

    async fn record_timing(
        &self,
        id: &str,
        marker: TrialTimingMarker,
    ) -> RepoResult<()> {
        self.0
            .timing_log
            .lock()
            .push((id.to_string(), marker));
        // Update the timestamp in TrialTimings as a poor man's copy of
        // the postgres COALESCE-only-on-null behavior.
        let mut trials = self.0.trials.lock();
        let rec = trials
            .get_mut(id)
            .ok_or_else(|| RepoError::NotFound(id.to_string()))?;
        let now = chrono::Utc::now();
        let setter = |slot: &mut Option<chrono::DateTime<chrono::Utc>>| {
            if slot.is_none() {
                *slot = Some(now);
            }
        };
        match marker {
            TrialTimingMarker::EnvSetupStarted => setter(&mut rec.timings.env_setup_started_at),
            TrialTimingMarker::EnvSetupFinished => setter(&mut rec.timings.env_setup_finished_at),
            TrialTimingMarker::AgentSetupStarted => {
                setter(&mut rec.timings.agent_setup_started_at)
            }
            TrialTimingMarker::AgentSetupFinished => {
                setter(&mut rec.timings.agent_setup_finished_at)
            }
            TrialTimingMarker::AgentRunStarted => setter(&mut rec.timings.agent_run_started_at),
            TrialTimingMarker::AgentRunFinished => setter(&mut rec.timings.agent_run_finished_at),
            TrialTimingMarker::VerifierStarted => setter(&mut rec.timings.verifier_started_at),
            TrialTimingMarker::VerifierFinished => setter(&mut rec.timings.verifier_finished_at),
        }
        Ok(())
    }

    async fn update_status(&self, id: &str, status: TrialStatus) -> RepoResult<()> {
        let mut trials = self.0.trials.lock();
        let rec = trials
            .get_mut(id)
            .ok_or_else(|| RepoError::NotFound(id.to_string()))?;
        rec.status = status;
        rec.updated_at = chrono::Utc::now();
        Ok(())
    }

    async fn mark_terminal(
        &self,
        id: &str,
        status: TrialStatus,
        duration_ms: Option<u32>,
        exception: Option<TrialException>,
    ) -> RepoResult<BacktestTrialRecord> {
        let mut trials = self.0.trials.lock();
        let rec = trials
            .get_mut(id)
            .ok_or_else(|| RepoError::NotFound(id.to_string()))?;
        rec.status = status;
        if let Some(d) = duration_ms {
            rec.duration_ms = Some(d);
        }
        if let Some(e) = exception {
            rec.exception = Some(e);
        }
        rec.updated_at = chrono::Utc::now();
        Ok(rec.clone())
    }

    async fn set_sandbox_id(&self, id: &str, sandbox_id: &str) -> RepoResult<()> {
        let mut trials = self.0.trials.lock();
        let rec = trials
            .get_mut(id)
            .ok_or_else(|| RepoError::NotFound(id.to_string()))?;
        rec.sandbox_id = Some(sandbox_id.to_string());
        Ok(())
    }

    async fn bump_attempt(&self, id: &str) -> RepoResult<u32> {
        let mut trials = self.0.trials.lock();
        let rec = trials
            .get_mut(id)
            .ok_or_else(|| RepoError::NotFound(id.to_string()))?;
        rec.attempt = rec.attempt.saturating_add(1);
        Ok(rec.attempt)
    }

    async fn record_rewards(
        &self,
        trial_id: &str,
        rewards: &HashMap<String, f64>,
        _grader_id: Option<&str>,
    ) -> RepoResult<()> {
        let mut store = self.0.rewards.lock();
        let entry = store.entry(trial_id.to_string()).or_default();
        for (k, v) in rewards {
            entry.insert(k.clone(), *v);
        }
        Ok(())
    }

    async fn list_rewards(&self, trial_id: &str) -> RepoResult<HashMap<String, f64>> {
        Ok(self
            .0
            .rewards
            .lock()
            .get(trial_id)
            .cloned()
            .unwrap_or_default())
    }
}

#[async_trait]
impl BacktestArtifactRepository for ArtifactRepo {
    async fn create(
        &self,
        trial_id: &str,
        kind: BacktestArtifactKind,
        path: &str,
        size_bytes: Option<u64>,
        content_type: Option<&str>,
    ) -> RepoResult<BacktestArtifactRecord> {
        let id = ulid::Ulid::new().to_string();
        let rec = BacktestArtifactRecord {
            id: id.clone(),
            trial_id: trial_id.to_string(),
            kind,
            path: path.to_string(),
            size_bytes,
            content_type: content_type.map(String::from),
            created_at: chrono::Utc::now(),
        };
        self.0
            .artifacts
            .lock()
            .entry(trial_id.to_string())
            .or_default()
            .push(rec.clone());
        Ok(rec)
    }

    async fn list_by_trial(&self, trial_id: &str) -> RepoResult<Vec<BacktestArtifactRecord>> {
        Ok(self
            .0
            .artifacts
            .lock()
            .get(trial_id)
            .cloned()
            .unwrap_or_default())
    }
}

/* ── Test fixtures ────────────────────────────────────────── */

fn empty_recipe() -> chronicle_domain::BacktestRecipe {
    chronicle_domain::BacktestRecipe {
        mode: BacktestJobMode::Replay,
        agents: vec![],
        data: chronicle_domain::BacktestData {
            kind: chronicle_domain::BacktestDataKind::Dataset,
            dataset: Some("test_dataset".to_string()),
            dataset_label: Some("Test Dataset".to_string()),
            sources: vec![],
            scenarios: vec![],
            saved_as: None,
        },
        graders: vec![],
        environment: None,
        name: "test_run".to_string(),
        seed: None,
    }
}

fn make_tests_dir() -> (PathBuf, Box<dyn FnOnce()>) {
    let dir = std::env::temp_dir().join(format!("chronicle_test_{}", ulid::Ulid::new()));
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(
        dir.join("test.sh"),
        "#!/bin/bash\necho 1 > /logs/verifier/reward.txt\n",
    )
    .unwrap();
    let cleanup_dir = dir.clone();
    let cleanup: Box<dyn FnOnce()> = Box::new(move || {
        let _ = std::fs::remove_dir_all(&cleanup_dir);
    });
    (dir, cleanup)
}

fn make_plan(
    job_id: &str,
    tenant_id: &str,
    trial_count: usize,
    n_concurrent: u32,
) -> (JobPlan, Box<dyn FnOnce()>) {
    let (tests_dir, cleanup) = make_tests_dir();
    let trials = (0..trial_count)
        .map(|i| TrialPlan {
            trial_id: format!("trial_{i}"),
            agent_id: "agent_v1".to_string(),
            agent_label: "Agent v1".to_string(),
            is_baseline: i == 0,
            case_id: format!("case_{i}"),
            case_cluster: None,
            instruction: "do the thing".to_string(),
            expected_outcome: None,
            tests_dir: tests_dir.clone(),
            verifier_env: HashMap::new(),
        })
        .collect();
    let plan = JobPlan {
        job_id: job_id.to_string(),
        tenant_id: tenant_id.to_string(),
        recipe: empty_recipe(),
        trials,
        n_concurrent,
        sandbox_driver: SandboxDriver::Mock,
        retry_config: RetryConfig::default(),
        start_opts_template: TrialStartOpts {
            image: ImageSource::None,
            resources: ResourceLimits::small(),
            allow_internet: true,
            env: HashMap::new(),
            labels: HashMap::new(),
            max_lifetime: Duration::from_secs(60),
            idle_timeout: None,
        },
        timeouts: TrialTimeouts {
            env_setup: Duration::from_secs(5),
            agent_setup: Duration::from_secs(5),
            agent_run: Duration::from_secs(5),
            verifier: Duration::from_secs(5),
        },
        graders: vec![],
    };
    (plan, cleanup)
}

/// Build a MockSandbox configured to behave like the orchestrator
/// expects: download_file for reward.txt returns a 1. Paths mirror
/// the verifier's `/tmp/chronicle/...` layout so non-root sandbox
/// users (e.g. Daytona) can write here at runtime.
fn make_sandbox_factory() -> SandboxFactory {
    SandboxFactory::from_override(|| {
        let sb = MockSandbox::new().with_stubs(vec![
            ExecStub {
                command_prefix: "mkdir -p /tmp/chronicle/logs/verifier".to_string(),
                result: ExecResult::ok(""),
            },
            ExecStub {
                command_prefix: "bash /tmp/chronicle/tests/test.sh".to_string(),
                result: ExecResult::ok(""),
            },
        ]);
        // Pre-seed the reward file so verifier's download_file works.
        sb.put_file(
            "/tmp/chronicle/logs/verifier/reward.txt",
            b"1\n".to_vec(),
        );
        Box::new(sb)
    })
}

fn captured_events() -> (
    chronicle_orchestrator::TrialEventSink,
    Arc<Mutex<Vec<TrialEvent>>>,
) {
    let buffer = Arc::new(Mutex::new(Vec::<TrialEvent>::new()));
    let buf_clone = Arc::clone(&buffer);
    let sink: chronicle_orchestrator::TrialEventSink = Arc::new(move |ev| {
        buf_clone.lock().push(ev);
    });
    (sink, buffer)
}

/* ── Tests ────────────────────────────────────────────────── */

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn happy_path_records_rewards_artifacts_and_terminal_status() {
    let store = Arc::new(InMemoryStore::default());

    // Persist a job + trial up front (matches the API layer's
    // contract: rows exist before run_job is called).
    let jobs_repo = Arc::new(JobRepo(Arc::clone(&store)));
    let trials_repo = Arc::new(TrialRepo(Arc::clone(&store)));
    let artifacts_repo = Arc::new(ArtifactRepo(Arc::clone(&store)));

    let job_record = jobs_repo
        .create(CreateBacktestJobInput {
            tenant_id: "tenant_1".to_string(),
            name: "test_run".to_string(),
            mode: BacktestJobMode::Replay,
            recipe: serde_json::json!({}),
            n_concurrent: 1,
            sandbox_driver: SandboxDriver::Mock,
            retry_config: None,
            created_by: None,
            scheduled_for: None,
        })
        .await
        .unwrap();

    let (mut plan, cleanup) = make_plan(&job_record.id, "tenant_1", 1, 1);
    // Seed the trial row so timing/status updates have something to
    // operate on.
    let trial_record = trials_repo
        .create(CreateBacktestTrialInput {
            job_id: job_record.id.clone(),
            tenant_id: "tenant_1".to_string(),
            agent_id: "agent_v1".to_string(),
            agent_label: "Agent v1".to_string(),
            is_baseline: true,
            case_id: "case_0".to_string(),
            case_cluster: None,
        })
        .await
        .unwrap();
    plan.trials[0].trial_id = trial_record.id.clone();

    let (sink, captured) = captured_events();
    let deps = JobDeps {
        jobs: jobs_repo.clone(),
        trials: trials_repo.clone(),
        artifacts: artifacts_repo.clone(),
        agent_runner: Arc::new(MockAgentRunner::always_ok()),
        grader: Arc::new(chronicle_orchestrator::MockGrader::default()),
        state: Arc::new(OrchestratorState::new()),
        event_sink: sink,
    };

    let outcome = run_job(plan, deps, make_sandbox_factory()).await.unwrap();

    assert_eq!(outcome.status, JobStatus::Succeeded);
    assert_eq!(outcome.completed_trials, 1);
    assert_eq!(outcome.failed_trials, 0);

    // Trial status persisted as Succeeded with timings filled in.
    let final_trial = trials_repo
        .find_by_id(&trial_record.id)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(final_trial.status, TrialStatus::Succeeded);
    assert!(final_trial.timings.env_setup_started_at.is_some());
    assert!(final_trial.timings.env_setup_finished_at.is_some());
    assert!(final_trial.timings.agent_run_finished_at.is_some());
    assert!(final_trial.timings.verifier_finished_at.is_some());
    assert!(final_trial.duration_ms.unwrap_or(0) < 1_000_000);

    // Sandbox id persisted (mock driver assigns mock_<ulid>).
    assert!(final_trial.sandbox_id.as_deref().unwrap_or("").starts_with("mock_"));

    // Rewards persisted.
    let rewards = trials_repo.list_rewards(&trial_record.id).await.unwrap();
    assert_eq!(rewards.get("reward"), Some(&1.0));

    // Reward file persisted as artifact.
    let arts = artifacts_repo.list_by_trial(&trial_record.id).await.unwrap();
    assert_eq!(arts.len(), 1);
    assert_eq!(arts[0].kind, BacktestArtifactKind::RewardTxt);

    // Job terminal status + summary updated.
    let final_job = jobs_repo.find_by_id(&job_record.id).await.unwrap().unwrap();
    assert_eq!(final_job.status, JobStatus::Succeeded);
    assert_eq!(final_job.completed_trials, 1);
    assert_eq!(final_job.failed_trials, 0);

    // Event stream contains the full lifecycle.
    let events = captured.lock().clone();
    assert!(matches!(events.first(), Some(TrialEvent::JobStarted { .. })));
    assert!(matches!(
        events.last(),
        Some(TrialEvent::JobFinished {
            status: JobStatus::Succeeded,
            ..
        })
    ));
    assert!(events.iter().any(|e| matches!(
        e,
        TrialEvent::TrialFinished {
            status: TrialStatus::Succeeded,
            ..
        }
    )));

    cleanup();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn agent_failure_marks_trial_failed_and_does_not_retry_default() {
    let store = Arc::new(InMemoryStore::default());
    let jobs_repo = Arc::new(JobRepo(Arc::clone(&store)));
    let trials_repo = Arc::new(TrialRepo(Arc::clone(&store)));
    let artifacts_repo = Arc::new(ArtifactRepo(Arc::clone(&store)));

    let job_record = jobs_repo
        .create(CreateBacktestJobInput {
            tenant_id: "tenant_1".to_string(),
            name: "fail_run".to_string(),
            mode: BacktestJobMode::Replay,
            recipe: serde_json::json!({}),
            n_concurrent: 1,
            sandbox_driver: SandboxDriver::Mock,
            retry_config: None,
            created_by: None,
            scheduled_for: None,
        })
        .await
        .unwrap();

    let (mut plan, cleanup) = make_plan(&job_record.id, "tenant_1", 1, 1);
    let trial_record = trials_repo
        .create(CreateBacktestTrialInput {
            job_id: job_record.id.clone(),
            tenant_id: "tenant_1".to_string(),
            agent_id: "agent_v1".to_string(),
            agent_label: "Agent v1".to_string(),
            is_baseline: true,
            case_id: "case_0".to_string(),
            case_cluster: None,
        })
        .await
        .unwrap();
    plan.trials[0].trial_id = trial_record.id.clone();

    let (sink, _) = captured_events();
    let runner = Arc::new(MockAgentRunner::always_fail("model returned 500"));
    let runner_invocations = runner.clone();
    let deps = JobDeps {
        jobs: jobs_repo.clone(),
        trials: trials_repo.clone(),
        artifacts: artifacts_repo.clone(),
        agent_runner: runner,
        grader: Arc::new(chronicle_orchestrator::MockGrader::default()),
        state: Arc::new(OrchestratorState::new()),
        event_sink: sink,
    };

    let outcome = run_job(plan, deps, make_sandbox_factory()).await.unwrap();
    // Job is marked failed because every trial failed.
    assert_eq!(outcome.status, JobStatus::Failed);
    assert_eq!(outcome.failed_trials, 1);

    let final_trial = trials_repo.find_by_id(&trial_record.id).await.unwrap().unwrap();
    assert_eq!(final_trial.status, TrialStatus::Failed);
    assert_eq!(
        final_trial.exception.as_ref().map(|e| e.kind.as_str()),
        Some("AgentFailed")
    );

    // AgentFailed is NOT transient → no retry.
    let invocations = runner_invocations.invocations();
    assert_eq!(invocations.len(), 1);

    cleanup();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 8)]
async fn semaphore_caps_concurrency_below_total_trials() {
    use std::sync::atomic::{AtomicUsize, Ordering};

    let store = Arc::new(InMemoryStore::default());
    let jobs_repo = Arc::new(JobRepo(Arc::clone(&store)));
    let trials_repo = Arc::new(TrialRepo(Arc::clone(&store)));
    let artifacts_repo = Arc::new(ArtifactRepo(Arc::clone(&store)));

    let job_record = jobs_repo
        .create(CreateBacktestJobInput {
            tenant_id: "tenant_1".to_string(),
            name: "concurrent".to_string(),
            mode: BacktestJobMode::Replay,
            recipe: serde_json::json!({}),
            n_concurrent: 2,
            sandbox_driver: SandboxDriver::Mock,
            retry_config: None,
            created_by: None,
            scheduled_for: None,
        })
        .await
        .unwrap();

    let (mut plan, cleanup) = make_plan(&job_record.id, "tenant_1", 6, 2);
    for trial in plan.trials.iter_mut() {
        let rec = trials_repo
            .create(CreateBacktestTrialInput {
                job_id: job_record.id.clone(),
                tenant_id: "tenant_1".to_string(),
                agent_id: trial.agent_id.clone(),
                agent_label: trial.agent_label.clone(),
                is_baseline: trial.is_baseline,
                case_id: trial.case_id.clone(),
                case_cluster: None,
            })
            .await
            .unwrap();
        trial.trial_id = rec.id;
    }

    // Custom agent runner that holds for 50ms and tracks peak active.
    let active = Arc::new(AtomicUsize::new(0));
    let peak = Arc::new(AtomicUsize::new(0));
    let runner = {
        let active = Arc::clone(&active);
        let peak = Arc::clone(&peak);
        Arc::new(MockAgentRunner::new("slow", move |_ctx| {
            let active = Arc::clone(&active);
            let peak = Arc::clone(&peak);
            async move {
                let now = active.fetch_add(1, Ordering::SeqCst) + 1;
                peak.fetch_max(now, Ordering::SeqCst);
                tokio::time::sleep(Duration::from_millis(50)).await;
                active.fetch_sub(1, Ordering::SeqCst);
                Ok(AgentRunOutcome::default())
            }
        }))
    };

    let (sink, _) = captured_events();
    let deps = JobDeps {
        jobs: jobs_repo,
        trials: trials_repo,
        artifacts: artifacts_repo,
        agent_runner: runner,
        grader: Arc::new(chronicle_orchestrator::MockGrader::default()),
        state: Arc::new(OrchestratorState::new()),
        event_sink: sink,
    };

    let outcome = run_job(plan, deps, make_sandbox_factory()).await.unwrap();
    assert_eq!(outcome.completed_trials, 6);
    assert_eq!(outcome.failed_trials, 0);

    let observed_peak = peak.load(Ordering::SeqCst);
    assert!(
        observed_peak <= 2,
        "peak concurrent agents was {observed_peak}; expected <= 2"
    );

    cleanup();
}
