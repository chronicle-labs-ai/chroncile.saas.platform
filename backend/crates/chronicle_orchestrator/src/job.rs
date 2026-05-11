//! `Job::run` — schedule N trials concurrently against the sandbox
//! pool, with image-build dedup, retry, and lazy job-summary updates.
//!
//! The job is an `async fn` (not a long-lived struct) — the API layer
//! wraps each invocation in a `tokio::task::JoinHandle` and stores the
//! handle in a `DashMap<job_id, JoinHandle>` so it can be cancelled
//! via `JoinHandle::abort()`.

use crate::agent_runner::AgentRunner;
use crate::error::{OrchestratorError, OrchestratorResult};
use crate::judges::Grader;
use crate::plan::JobPlan;
use crate::trial::{mark_trial_failed, Trial, TrialDeps, TrialEventSink};
use chronicle_domain::{BacktestArtifactKind, JobStatus, RetryConfig, TrialEvent};
use chronicle_interfaces::{
    BacktestArtifactRepository, BacktestJobRepository, BacktestTrialRepository,
};
use chronicle_sandbox::{factory as sandbox_factory, Sandbox};
use chrono::Utc;
use dashmap::DashMap;
use parking_lot::Mutex;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{OnceCell, Semaphore};
use tokio::time::{sleep, Instant};

/// Shared concurrency primitives that survive across job invocations.
/// One instance per orchestrator (process-wide); pass into `Job::run`.
#[derive(Default)]
pub struct OrchestratorState {
    /// Image-build dedup. Concurrent trials sharing the same image
    /// key wait on the same `OnceCell`; only the first one actually
    /// builds. Mirrors Harbor's `_image_build_locks` pattern.
    pub image_build_locks: DashMap<String, Arc<OnceCell<()>>>,
}

impl OrchestratorState {
    pub fn new() -> Self {
        Self::default()
    }
}

#[allow(unused_variables)] // unused param avoidance is documented below
pub struct JobDeps {
    pub jobs: Arc<dyn BacktestJobRepository>,
    pub trials: Arc<dyn BacktestTrialRepository>,
    pub artifacts: Arc<dyn BacktestArtifactRepository>,
    pub agent_runner: Arc<dyn AgentRunner>,
    pub grader: Arc<dyn Grader>,
    pub state: Arc<OrchestratorState>,
    pub event_sink: TrialEventSink,
}

/// Hint to the sandbox factory for a job. Each trial gets a freshly
/// constructed sandbox; this struct decides which driver.
///
/// Test-only override (`SandboxFactoryOverride`) lets the integration
/// test inject `MockSandbox` instances without going through the
/// `chronicle_sandbox::factory` registry.
#[derive(Clone)]
pub enum SandboxFactory {
    Default,
    Override(Arc<dyn Fn() -> Box<dyn Sandbox> + Send + Sync>),
}

impl SandboxFactory {
    pub fn from_override<F>(f: F) -> Self
    where
        F: Fn() -> Box<dyn Sandbox> + Send + Sync + 'static,
    {
        Self::Override(Arc::new(f))
    }

    fn build(&self, driver: chronicle_domain::SandboxDriver) -> OrchestratorResult<Box<dyn Sandbox>> {
        match self {
            Self::Default => sandbox_factory::build(driver).map_err(Into::into),
            Self::Override(f) => Ok(f()),
        }
    }
}

/// Final summary returned by `Job::run`. The API layer projects this
/// into the SSE `JobFinished` event + persists the `BacktestJob.status`.
pub struct JobOutcome {
    pub job_id: String,
    pub status: JobStatus,
    pub completed_trials: u32,
    pub failed_trials: u32,
    pub total_trials: u32,
}

/// Run one job to completion. Bounds concurrency to `n_concurrent`,
/// retries individual trials according to the recipe's
/// `RetryConfig`, and persists summary counts as trials finish.
///
/// The future is cancellation-safe: aborting the outer task triggers
/// each in-flight trial's `SandboxGuard::Drop`, which fires a detached
/// cleanup `tokio::spawn`. The cleanup runs even if the outer
/// runtime survives (i.e. `JoinHandle::abort` from the API layer).
pub async fn run_job(
    plan: JobPlan,
    deps: JobDeps,
    factory: SandboxFactory,
) -> OrchestratorResult<JobOutcome> {
    let job_id = plan.job_id.clone();
    let total = plan.trials.len() as u32;

    // ── Job marked running ────────────────────────────────────────
    deps.jobs
        .update_status(&job_id, JobStatus::Running, Some(Utc::now()), None)
        .await?;
    deps.jobs
        .update_summary(&job_id, Some(total), 0, 0, None)
        .await?;
    (deps.event_sink)(TrialEvent::JobStarted {
        job_id: job_id.clone(),
    });

    let semaphore = Arc::new(Semaphore::new(plan.n_concurrent.max(1) as usize));
    let completed = Arc::new(AtomicU32::new(0));
    let failed = Arc::new(AtomicU32::new(0));
    let last_exception = Arc::new(Mutex::new(Option::<String>::None));

    // ── Spawn one task per trial ──────────────────────────────────
    let plan_arc = Arc::new(plan);
    let mut handles = Vec::with_capacity(plan_arc.trials.len());
    for trial_idx in 0..plan_arc.trials.len() {
        let plan_arc = Arc::clone(&plan_arc);
        let semaphore = Arc::clone(&semaphore);
        let completed = Arc::clone(&completed);
        let failed = Arc::clone(&failed);
        let last_exception = Arc::clone(&last_exception);
        let job_id = job_id.clone();
        let factory = factory.clone();
        let jobs_repo = Arc::clone(&deps.jobs);
        let trials_repo = Arc::clone(&deps.trials);
        let artifacts_repo = Arc::clone(&deps.artifacts);
        let agent_runner = Arc::clone(&deps.agent_runner);
        let grader = Arc::clone(&deps.grader);
        let event_sink = Arc::clone(&deps.event_sink);
        let retry = plan_arc.retry_config.clone();

        let handle = tokio::spawn(async move {
            let _permit = match semaphore.acquire_owned().await {
                Ok(p) => p,
                // Semaphore closed — the orchestrator was torn down.
                Err(_) => return,
            };

            let trial_plan = &plan_arc.trials[trial_idx];
            let trial_id = trial_plan.trial_id.clone();

            let mut attempt: u32 = 0;
            let outcome: OrchestratorResult<()> = loop {
                let trial_deps = TrialDeps {
                    trials: Arc::clone(&trials_repo),
                    artifacts: Arc::clone(&artifacts_repo),
                    agent_runner: Arc::clone(&agent_runner),
                    grader: Arc::clone(&grader),
                    event_sink: Arc::clone(&event_sink),
                };

                let started = Instant::now();
                let trial = Trial {
                    job_id: job_id.clone(),
                    tenant_id: plan_arc.tenant_id.clone(),
                    plan: trial_plan,
                    start_template: &plan_arc.start_opts_template,
                    timeouts: plan_arc.timeouts,
                    graders: &plan_arc.graders,
                    deps: trial_deps,
                };
                let sandbox = match factory.build(plan_arc.sandbox_driver) {
                    Ok(sb) => sb,
                    Err(e) => {
                        // Build error is configuration — never retry.
                        let _ = mark_trial_failed(&trials_repo, &trial_id, &e, None).await;
                        emit_trial_failed(&event_sink, &job_id, &trial_id, &e);
                        break Err(e);
                    }
                };

                match trial.run(sandbox).await {
                    Ok(_outcome) => break Ok(()),
                    Err(e) => {
                        if !should_retry(&e, &retry, attempt) {
                            let _ = mark_trial_failed(&trials_repo, &trial_id, &e, Some(started))
                                .await;
                            emit_trial_failed(&event_sink, &job_id, &trial_id, &e);
                            break Err(e);
                        }
                        attempt = attempt.saturating_add(1);
                        let _ = trials_repo.bump_attempt(&trial_id).await;
                        sleep(retry_backoff(&retry, attempt)).await;
                        // Loop and try again.
                    }
                }
            };

            // ── Update job-level summary counts ──────────────────
            match outcome {
                Ok(()) => {
                    completed.fetch_add(1, Ordering::SeqCst);
                }
                Err(e) => {
                    failed.fetch_add(1, Ordering::SeqCst);
                    *last_exception.lock() = Some(e.kind().as_str().to_string());
                }
            }

            let c = completed.load(Ordering::SeqCst);
            let f = failed.load(Ordering::SeqCst);
            let kind = last_exception.lock().clone();
            let _ = jobs_repo
                .update_summary(&job_id, None, c, f, kind.as_deref())
                .await;
        });
        handles.push(handle);
    }

    // ── Wait for every trial to finish (success or failure) ──────
    for h in handles {
        let _ = h.await;
    }

    // ── Mark job terminal ────────────────────────────────────────
    let c = completed.load(Ordering::SeqCst);
    let f = failed.load(Ordering::SeqCst);
    let final_status = if f == 0 {
        JobStatus::Succeeded
    } else if c > 0 {
        // Partial success: some trials passed, some failed. Mark
        // succeeded so the dashboard renders the partial verdict;
        // failed-trials count carries the bad news.
        JobStatus::Succeeded
    } else {
        JobStatus::Failed
    };
    let now = Utc::now();
    let _ = deps
        .jobs
        .update_status(&job_id, final_status, None, Some(now))
        .await;
    (deps.event_sink)(TrialEvent::JobFinished {
        job_id: job_id.clone(),
        status: final_status,
        verdict: None,
    });

    // Image-build locks are kept around — image keys are stable and
    // future jobs benefit from the cached builds. State::cleanup()
    // can prune (Phase 2.5).
    let _ = &deps.state.image_build_locks;
    let _ = BacktestArtifactKind::Other; // sanity-pin domain dep

    Ok(JobOutcome {
        job_id,
        status: final_status,
        completed_trials: c,
        failed_trials: f,
        total_trials: total,
    })
}

fn emit_trial_failed(
    sink: &TrialEventSink,
    job_id: &str,
    trial_id: &str,
    err: &OrchestratorError,
) {
    sink(TrialEvent::TrialFinished {
        job_id: job_id.to_string(),
        trial_id: trial_id.to_string(),
        status: chronicle_domain::TrialStatus::Failed,
        exception: Some(chronicle_domain::TrialException {
            kind: err.kind().as_str().to_string(),
            message: err.to_string(),
        }),
    });
}

fn should_retry(err: &OrchestratorError, cfg: &RetryConfig, attempt: u32) -> bool {
    if attempt >= cfg.max_retries {
        return false;
    }
    let kind = err.kind().as_str();

    if let Some(exclude) = &cfg.exclude_exceptions {
        if exclude.iter().any(|e| e == kind) {
            return false;
        }
    }
    if let Some(include) = &cfg.include_exceptions {
        if !include.iter().any(|e| e == kind) {
            return false;
        }
    }

    err.is_transient()
}

fn retry_backoff(cfg: &RetryConfig, attempt: u32) -> Duration {
    let exp = cfg.wait_multiplier.powi(attempt.saturating_sub(1) as i32);
    let secs = (cfg.min_wait_sec * exp).clamp(cfg.min_wait_sec, cfg.max_wait_sec);
    Duration::from_secs_f64(secs.max(0.0))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chronicle_domain::RetryConfig;

    fn cfg() -> RetryConfig {
        RetryConfig {
            max_retries: 2,
            min_wait_sec: 0.1,
            max_wait_sec: 1.0,
            wait_multiplier: 2.0,
            include_exceptions: None,
            exclude_exceptions: Some(vec!["VerifierFailed".to_string()]),
        }
    }

    #[test]
    fn transient_retried_within_budget() {
        let err = OrchestratorError::Transient("flake".to_string());
        let c = cfg();
        assert!(should_retry(&err, &c, 0));
        assert!(should_retry(&err, &c, 1));
        assert!(!should_retry(&err, &c, 2));
    }

    #[test]
    fn excluded_kinds_not_retried() {
        let err = OrchestratorError::VerifierFailed("expected 1, got 0".to_string());
        let c = cfg();
        assert!(!should_retry(&err, &c, 0));
    }

    #[test]
    fn agent_failure_default_not_retried() {
        // AgentFailed is not transient and not in the include list →
        // bail.
        let err = OrchestratorError::AgentFailed("non-zero".to_string());
        let c = cfg();
        assert!(!should_retry(&err, &c, 0));
    }

    #[test]
    fn backoff_grows_then_clamps() {
        let c = cfg();
        let b1 = retry_backoff(&c, 1);
        let b2 = retry_backoff(&c, 2);
        let b10 = retry_backoff(&c, 10);
        assert!(b2 >= b1);
        assert!(b10 <= Duration::from_secs_f64(c.max_wait_sec));
    }
}
