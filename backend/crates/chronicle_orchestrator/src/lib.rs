//! Backtest orchestrator — schedules `Trial`s on top of the
//! `chronicle_sandbox` trait, persists state through
//! `chronicle_interfaces` repositories, and emits `TrialEvent`s on a
//! caller-supplied sink for SSE / CLI consumption.
//!
//! Entry point: `job::run_job`. The crate is library-only — there's no
//! daemon here. The HTTP layer (`chronicle_api`, Phase 3) wraps each
//! invocation in `tokio::task::JoinHandle` and stores it in a
//! `DashMap<job_id, JoinHandle>` so it can be cancelled via `abort()`.
//!
//! Architectural notes:
//!
//! * **Sandbox lifetime is bounded by the trial.** Each `Trial::run`
//!   builds + tears down its own sandbox via `SandboxGuard`. There is
//!   no sandbox pool; ephemeral matches the dashboard's mental model
//!   ("every run starts clean").
//! * **Cancellation is via `JoinHandle::abort`** at the API layer.
//!   The trial's cleanup is handled by `SandboxGuard`'s `Drop` impl,
//!   which fires a detached `tokio::spawn(stop(true))` so a server
//!   crash mid-trial doesn't leak provider-side sandboxes (Rust analog
//!   of Harbor's `asyncio.shield`).
//! * **Image-build dedup** uses `tokio::sync::OnceCell` keyed by image
//!   identity (managed in `OrchestratorState`). Concurrent trials of
//!   the same task wait on the same `OnceCell`. Phase 2 doesn't yet
//!   *use* this for actual builds — Daytona builds happen server-side
//!   — but the primitive is in place for the eventual Docker driver.

pub mod agent_runner;
pub mod error;
pub mod job;
pub mod judges;
pub mod plan;
pub mod script_agent;
pub mod trial;
pub mod verifier;

pub use agent_runner::{
    AgentRunContext, AgentRunOutcome, AgentRunner, MockAgentRunner, MockInvocation,
};
pub use script_agent::{ScriptAgentRunner, INSTRUCTION_PATH, WORK_DIR};
pub use error::{OrchestratorError, OrchestratorErrorKind, OrchestratorResult};
pub use job::{run_job, JobDeps, JobOutcome, OrchestratorState, SandboxFactory};
pub use judges::{
    build_default_grader, rubric_graders, AnthropicGrader, Grader, GraderContext, GraderOutcome,
    MockGrader,
};
pub use plan::{JobPlan, TrialPlan, TrialStartOpts, TrialTimeouts};
pub use trial::{
    mark_trial_failed, SandboxGuard, Trial, TrialDeps, TrialEventSink, TrialOutcome,
};
pub use verifier::{RewardFileKind, Verifier, VerifierOutcome};
