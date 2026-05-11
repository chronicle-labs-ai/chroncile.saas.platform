//! Single-trial lifecycle. Ports Harbor's `Trial.run()` to Rust.
//!
//! Pipeline (single-step, multi-step is Phase 2.5):
//!
//!   1. Sandbox start
//!   2. Healthcheck (folded into start in Phase 2; Phase 2.5 adds explicit)
//!   3. Agent setup (Phase 2 = no-op; AgentRunner does any setup it needs inline)
//!   4. Agent run
//!   5. Verifier
//!   6. Cleanup (always — `SandboxGuard` handles cancellation)
//!
//! Each phase records (start, finish) timestamps via
//! `BacktestTrialRepository::record_timing` so the dashboard's per-phase
//! progress bar matches reality.

use crate::agent_runner::{AgentRunContext, AgentRunner};
use crate::error::{OrchestratorError, OrchestratorResult};
use crate::judges::{rubric_graders, Grader, GraderContext};
use crate::plan::{TrialPlan, TrialStartOpts, TrialTimeouts};
use crate::script_agent::WORK_DIR;
use crate::verifier::{RewardFileKind, Verifier, VerifierOutcome};
use chronicle_domain::{
    BacktestArtifactKind, BacktestGrader, TrialEvent, TrialException, TrialPhase, TrialStatus,
};
use chronicle_interfaces::{
    BacktestArtifactRepository, BacktestTrialRepository, TrialTimingMarker,
};
use chronicle_sandbox::{Sandbox, SandboxId, StartOpts};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::time::{timeout, Instant};

/// Async, fire-and-forget event sink. The orchestrator broadcasts
/// `TrialEvent`s through this; the API/CLI wraps a `tokio::sync::broadcast`
/// channel around it.
pub type TrialEventSink = Arc<dyn Fn(TrialEvent) + Send + Sync>;

pub struct TrialDeps {
    pub trials: Arc<dyn BacktestTrialRepository>,
    pub artifacts: Arc<dyn BacktestArtifactRepository>,
    pub agent_runner: Arc<dyn AgentRunner>,
    pub grader: Arc<dyn Grader>,
    pub event_sink: TrialEventSink,
}

pub struct Trial<'plan> {
    pub job_id: String,
    pub tenant_id: String,
    pub plan: &'plan TrialPlan,
    pub start_template: &'plan TrialStartOpts,
    pub timeouts: TrialTimeouts,
    /// Graders the recipe declared. Phase 6 only honours rubric kind;
    /// everything else is silently ignored (see
    /// `crate::judges::rubric_graders`).
    pub graders: &'plan [BacktestGrader],
    pub deps: TrialDeps,
}

impl<'plan> Trial<'plan> {
    /// Run one trial. On success, returns the `TrialStatus` the trial
    /// finished in (`Succeeded` or `Failed` — never `Cancelled` here;
    /// cancellation propagates as `Err(OrchestratorError::Cancelled)`).
    pub async fn run(
        self,
        sandbox: Box<dyn Sandbox>,
    ) -> OrchestratorResult<TrialOutcome> {
        let trial_id = self.plan.trial_id.clone();
        let job_id = self.job_id.clone();

        // Sandbox lives inside a guard that ensures cleanup runs even
        // on cancellation (drop fires `tokio::spawn(stop(true))`).
        let mut guard = SandboxGuard::new(sandbox);

        // ── Phase 1: environment setup ────────────────────────────
        self.emit_phase(&job_id, &trial_id, TrialPhase::EnvironmentStart);
        self.deps
            .trials
            .record_timing(&trial_id, TrialTimingMarker::EnvSetupStarted)
            .await?;
        self.deps
            .trials
            .update_status(&trial_id, TrialStatus::Setup)
            .await?;

        let start_opts = self
            .start_template
            .into_start_opts(&job_id, self.plan, &self.tenant_id);
        let sandbox_id = self.run_phase_with_timeout(
            self.timeouts.env_setup,
            "environment-start",
            start_sandbox(guard.sandbox_mut(), start_opts),
        )
        .await
        .map_err(|e| match e {
            OrchestratorError::Transient(msg) => OrchestratorError::SandboxStartFailed(msg),
            other => other,
        })?;

        self.deps
            .trials
            .set_sandbox_id(&trial_id, sandbox_id.as_str())
            .await?;
        self.deps
            .trials
            .record_timing(&trial_id, TrialTimingMarker::EnvSetupFinished)
            .await?;
        self.emit_phase(&job_id, &trial_id, TrialPhase::EnvironmentReady);

        // ── Phase 2: agent setup (Phase 2 = mark-only) ────────────
        self.deps
            .trials
            .record_timing(&trial_id, TrialTimingMarker::AgentSetupStarted)
            .await?;
        self.emit_phase(&job_id, &trial_id, TrialPhase::AgentSetup);
        self.deps
            .trials
            .record_timing(&trial_id, TrialTimingMarker::AgentSetupFinished)
            .await?;

        // ── Phase 3: agent run ────────────────────────────────────
        self.deps
            .trials
            .update_status(&trial_id, TrialStatus::Running)
            .await?;
        self.deps
            .trials
            .record_timing(&trial_id, TrialTimingMarker::AgentRunStarted)
            .await?;
        self.emit_phase(&job_id, &trial_id, TrialPhase::AgentRunning);

        let agent_ctx = AgentRunContext {
            job_id: &job_id,
            trial_id: &trial_id,
            agent_id: &self.plan.agent_id,
            instruction: &self.plan.instruction,
            sandbox: guard.sandbox(),
        };
        let mut agent_outcome = self
            .run_phase_with_timeout(
                self.timeouts.agent_run,
                "agent-run",
                self.deps.agent_runner.run(agent_ctx),
            )
            .await?;
        self.deps
            .trials
            .record_timing(&trial_id, TrialTimingMarker::AgentRunFinished)
            .await?;

        // Capture the agent's output text from $WORK_DIR/output.txt.
        // Best-effort: an agent that doesn't write a file (e.g. a
        // pure-tool agent) just leaves output_text = None and rubric
        // graders see an empty body. Failing the read shouldn't fail
        // the trial — the verifier may still produce a meaningful
        // assertion-based reward.
        agent_outcome.output_text = capture_agent_output(guard.sandbox()).await;

        // ── Phase 4: verifier ─────────────────────────────────────
        self.deps
            .trials
            .update_status(&trial_id, TrialStatus::Verifying)
            .await?;
        self.deps
            .trials
            .record_timing(&trial_id, TrialTimingMarker::VerifierStarted)
            .await?;
        self.emit_phase(&job_id, &trial_id, TrialPhase::VerifierRunning);

        let verifier_outcome: VerifierOutcome = self
            .run_phase_with_timeout(
                self.timeouts.verifier,
                "verifier",
                Verifier::verify(guard.sandbox(), self.plan),
            )
            .await?;
        self.deps
            .trials
            .record_timing(&trial_id, TrialTimingMarker::VerifierFinished)
            .await?;

        // ── Persist verifier rewards (assertion-based) ────────────
        self.deps
            .trials
            .record_rewards(&trial_id, &verifier_outcome.rewards, None)
            .await?;
        self.emit(TrialEvent::TrialRewardsRecorded {
            job_id: job_id.clone(),
            trial_id: trial_id.clone(),
            rewards: verifier_outcome.rewards.clone(),
        });

        // ── Run rubric (LLM-judge) graders, merge rewards ─────────
        //
        // Phase 6: only `kind = Rubric` graders are honoured. Each
        // grader emits one reward key (`grader_<id>`); multi-criterion
        // sub-scores (Phase 6.5) would emit `grader_<id>__<criterion>`.
        // Failures of individual graders are logged but don't fail
        // the trial — partial rubric coverage is still useful.
        let rubric_list = rubric_graders(self.graders);
        if !rubric_list.is_empty() {
            let agent_output_text = agent_outcome.output_text.as_deref().unwrap_or("");
            let mut rubric_rewards = HashMap::<String, f64>::new();
            for grader in rubric_list {
                let ctx = GraderContext {
                    trial_id: &trial_id,
                    agent_id: &self.plan.agent_id,
                    instruction: &self.plan.instruction,
                    agent_output: agent_output_text,
                    expected_outcome: self.plan.expected_outcome.as_deref(),
                };
                match self.deps.grader.grade(grader, ctx).await {
                    Ok(outcome) => {
                        let key = format!("grader_{}", grader.id);
                        rubric_rewards.insert(key, outcome.score);
                        for (k, v) in outcome.sub_scores {
                            rubric_rewards.insert(format!("grader_{}__{}", grader.id, k), v);
                        }
                        if let Some(reasoning) = outcome.reasoning {
                            tracing::debug!(
                                trial_id = %trial_id,
                                grader_id = %grader.id,
                                score = outcome.score,
                                reasoning = %reasoning,
                                "rubric grader completed"
                            );
                        }
                    }
                    Err(e) => {
                        tracing::warn!(
                            trial_id = %trial_id,
                            grader_id = %grader.id,
                            error = %e,
                            "rubric grader failed; trial keeps assertion reward only"
                        );
                    }
                }
            }
            if !rubric_rewards.is_empty() {
                self.deps
                    .trials
                    .record_rewards(&trial_id, &rubric_rewards, None)
                    .await?;
                self.emit(TrialEvent::TrialRewardsRecorded {
                    job_id: job_id.clone(),
                    trial_id: trial_id.clone(),
                    rewards: rubric_rewards,
                });
            }
        }

        // Best-effort artifact persistence.
        let artifact_kind = match verifier_outcome.raw_reward_kind {
            RewardFileKind::Txt => BacktestArtifactKind::RewardTxt,
            RewardFileKind::Json => BacktestArtifactKind::RewardJson,
        };
        if let Err(e) = self
            .deps
            .artifacts
            .create(
                &trial_id,
                artifact_kind,
                match verifier_outcome.raw_reward_kind {
                    RewardFileKind::Txt => "/logs/verifier/reward.txt",
                    RewardFileKind::Json => "/logs/verifier/reward.json",
                },
                Some(verifier_outcome.raw_reward_bytes.len() as u64),
                Some(match verifier_outcome.raw_reward_kind {
                    RewardFileKind::Txt => "text/plain",
                    RewardFileKind::Json => "application/json",
                }),
            )
            .await
        {
            tracing::warn!("trial {trial_id}: artifact insert failed: {e}");
        }

        // ── Mark terminal + cleanup ───────────────────────────────
        let duration_ms = trial_duration_ms(guard.started_at(), Instant::now());
        let final_record = self
            .deps
            .trials
            .mark_terminal(&trial_id, TrialStatus::Succeeded, Some(duration_ms), None)
            .await?;
        self.emit(TrialEvent::TrialFinished {
            job_id,
            trial_id: trial_id.clone(),
            status: TrialStatus::Succeeded,
            exception: None,
        });

        // Explicit cleanup so we observe failures inline; SandboxGuard
        // takes the same path on cancellation.
        guard.stop_now(true).await;
        let _ = agent_outcome; // hold for future trajectory persistence

        Ok(TrialOutcome {
            trial_id,
            status: TrialStatus::Succeeded,
            record: final_record,
            sandbox_id,
        })
    }

    /// Wrap one phase's future in a timeout, propagating cancellation.
    async fn run_phase_with_timeout<F, T>(
        &self,
        budget: std::time::Duration,
        phase_name: &'static str,
        fut: F,
    ) -> OrchestratorResult<T>
    where
        F: std::future::Future<Output = OrchestratorResult<T>>,
    {
        match timeout(budget, fut).await {
            Ok(Ok(v)) => Ok(v),
            Ok(Err(e)) => Err(e),
            Err(_) => Err(OrchestratorError::AgentFailed(format!(
                "{phase_name} timed out after {budget:?}"
            ))),
        }
    }

    fn emit(&self, ev: TrialEvent) {
        (self.deps.event_sink)(ev);
    }

    fn emit_phase(&self, job_id: &str, trial_id: &str, phase: TrialPhase) {
        self.emit(TrialEvent::TrialPhaseChanged {
            job_id: job_id.to_string(),
            trial_id: trial_id.to_string(),
            phase,
        });
    }
}

/// Helper so `start_sandbox` can be a free `async fn` instead of a
/// closure (closures don't compose with `&mut self` well in async).
async fn start_sandbox(
    sandbox: &mut Box<dyn Sandbox>,
    opts: StartOpts,
) -> OrchestratorResult<SandboxId> {
    sandbox.start(opts).await.map_err(Into::into)
}

/// Best-effort fetch of the agent's output file. Returns `None` when
/// the file is missing, the download fails, or the bytes aren't
/// valid UTF-8 — none of those are trial-failing conditions on their
/// own (verifier may still pass; rubric graders just see empty input).
async fn capture_agent_output(sandbox: &dyn Sandbox) -> Option<String> {
    let remote = format!("{WORK_DIR}/output.txt");
    let tmp = std::env::temp_dir().join(format!(
        "chronicle_agent_output_{}",
        ulid::Ulid::new()
    ));
    if let Err(e) = sandbox.download_file(&remote, &tmp).await {
        tracing::debug!(error = %e, "could not capture {remote}; rubric will see empty agent output");
        return None;
    }
    let bytes = std::fs::read(&tmp).ok()?;
    let _ = std::fs::remove_file(&tmp);
    String::from_utf8(bytes).ok()
}

/// Trial result the caller (Job::run) consumes to update job-level
/// counters + verdict.
pub struct TrialOutcome {
    pub trial_id: String,
    pub status: TrialStatus,
    pub record: chronicle_domain::BacktestTrialRecord,
    pub sandbox_id: SandboxId,
}

/// Helper used by Job::run to mark a trial failed without going
/// through the full lifecycle (e.g. when the trial errors before
/// even reaching the verifier).
pub async fn mark_trial_failed(
    trials: &Arc<dyn BacktestTrialRepository>,
    trial_id: &str,
    err: &OrchestratorError,
    started: Option<Instant>,
) -> OrchestratorResult<()> {
    let duration_ms = started.map(|s| trial_duration_ms(s, Instant::now()));
    let exception = TrialException {
        kind: err.kind().as_str().to_string(),
        message: err.to_string(),
    };
    trials
        .mark_terminal(trial_id, TrialStatus::Failed, duration_ms, Some(exception))
        .await?;
    Ok(())
}

fn trial_duration_ms(started: Instant, now: Instant) -> u32 {
    now.saturating_duration_since(started)
        .as_millis()
        .min(u32::MAX as u128) as u32
}

/* ── SandboxGuard ─────────────────────────────────────────── */

/// Owns the sandbox for the duration of one trial. On `Drop`, fires a
/// detached `tokio::spawn` that calls `stop(true)` so a dropped trial
/// future never leaks a provider-side sandbox. This is the Rust
/// analog of Harbor's `asyncio.shield` cleanup.
///
/// Happy-path code calls `stop_now(true)` explicitly so failures are
/// observable inline; the Drop fallback only fires on cancellation.
pub struct SandboxGuard {
    sandbox: Option<Box<dyn Sandbox>>,
    started_at: Instant,
}

impl SandboxGuard {
    pub fn new(sandbox: Box<dyn Sandbox>) -> Self {
        Self {
            sandbox: Some(sandbox),
            started_at: Instant::now(),
        }
    }

    pub fn started_at(&self) -> Instant {
        self.started_at
    }

    pub fn sandbox(&self) -> &dyn Sandbox {
        self.sandbox
            .as_deref()
            .expect("SandboxGuard::sandbox() called after stop_now")
    }

    pub fn sandbox_mut(&mut self) -> &mut Box<dyn Sandbox> {
        self.sandbox
            .as_mut()
            .expect("SandboxGuard::sandbox_mut() called after stop_now")
    }

    /// Synchronous cleanup. Call from happy paths so errors surface.
    pub async fn stop_now(&mut self, delete: bool) {
        if let Some(mut sb) = self.sandbox.take() {
            if let Err(e) = sb.stop(delete).await {
                tracing::warn!("sandbox stop failed: {e}");
            }
        }
    }
}

impl Drop for SandboxGuard {
    fn drop(&mut self) {
        if let Some(mut sb) = self.sandbox.take() {
            // We're inside a tokio runtime (the orchestrator runs
            // there). The detached spawn means cleanup runs to
            // completion even if the outer trial future is dropped.
            tokio::spawn(async move {
                if let Err(e) = sb.stop(true).await {
                    tracing::warn!("SandboxGuard drop: stop failed: {e}");
                }
            });
        }
    }
}
