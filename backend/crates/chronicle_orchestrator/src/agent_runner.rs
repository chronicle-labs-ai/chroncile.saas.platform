//! `AgentRunner` — the seam between the trial lifecycle and the agent
//! actually doing work.
//!
//! In Chronicle's model, agents are HTTP-callable artifacts (Vercel AI
//! SDK / OpenAI Agents Python / etc.). The runner orchestrates one
//! invocation: takes the instruction, talks to the agent, persists
//! whatever the agent produced into the sandbox at the place the
//! verifier expects (typically `/work/output.json` or similar).
//!
//! Phase 2 ships:
//! * `AgentRunner` trait
//! * `MockAgentRunner` — runs a closure inline; powers tests.
//!
//! Phase 2.5 will add a Vercel-AI-SDK-style HTTP runner that calls the
//! agent's resolved endpoint and writes the response into the sandbox.

use crate::error::OrchestratorResult;
use async_trait::async_trait;
use chronicle_sandbox::Sandbox;
use parking_lot::Mutex;
use std::sync::Arc;

/// One agent invocation against one (trial, sandbox).
///
/// Implementations MUST be safe to call concurrently — many trials
/// run in parallel and may share an `Arc<dyn AgentRunner>`.
#[async_trait]
pub trait AgentRunner: Send + Sync {
    /// Display name for logs / SSE events. Stable across calls.
    fn name(&self) -> &str;

    /// Runs the agent for one trial. The runner has full access to the
    /// `sandbox` so it can read fixture state, write outputs, and run
    /// commands. Returns `Ok(AgentRunOutcome)` on success — non-zero
    /// exits or model errors should be returned as
    /// `Err(OrchestratorError::AgentFailed(...))`.
    async fn run(
        &self,
        ctx: AgentRunContext<'_>,
    ) -> OrchestratorResult<AgentRunOutcome>;
}

/// What the runner sees per call.
pub struct AgentRunContext<'a> {
    pub job_id: &'a str,
    pub trial_id: &'a str,
    pub agent_id: &'a str,
    pub instruction: &'a str,
    pub sandbox: &'a dyn Sandbox,
}

/// What the runner records for the trial result. Token counts surface
/// to the dashboard's metrics; the trajectory is persisted as an
/// artifact (Phase 2.5+).
#[derive(Debug, Clone, Default)]
pub struct AgentRunOutcome {
    pub input_tokens: Option<u32>,
    pub output_tokens: Option<u32>,
    pub reasoning_tokens: Option<u32>,
    /// Optional inline trajectory JSON the runner produced. The trial
    /// stores this as a `trajectory` artifact when present.
    pub trajectory_json: Option<serde_json::Value>,
    /// Captured agent output text. The trial body downloads
    /// `/tmp/chronicle/work/output.txt` after `run` returns and
    /// stashes the contents here so rubric graders can score against
    /// it without re-fetching from the sandbox.
    pub output_text: Option<String>,
}

/* ── MockAgentRunner ─────────────────────────────────────── */

type MockHandler = Arc<
    dyn for<'a> Fn(&'a AgentRunContext<'_>) -> futures::future::BoxFuture<'a, OrchestratorResult<AgentRunOutcome>>
        + Send
        + Sync,
>;

/// Test-only runner that drives behavior from a closure. Records every
/// invocation for assertion in tests.
#[derive(Clone)]
pub struct MockAgentRunner {
    name: String,
    handler: MockHandler,
    invocations: Arc<Mutex<Vec<MockInvocation>>>,
}

#[derive(Debug, Clone)]
pub struct MockInvocation {
    pub job_id: String,
    pub trial_id: String,
    pub agent_id: String,
    pub instruction: String,
}

impl MockAgentRunner {
    /// Default runner: returns `Ok(AgentRunOutcome::default())` for
    /// every call. Useful when the test only cares about lifecycle,
    /// not what the agent did.
    pub fn always_ok() -> Self {
        Self::new("mock", |_ctx| async { Ok(AgentRunOutcome::default()) })
    }

    /// Runner that fails every call with the given message. Drives
    /// the "trial is marked failed" branch of the lifecycle.
    pub fn always_fail(msg: impl Into<String>) -> Self {
        let msg = msg.into();
        Self::new("mock-fail", move |_ctx| {
            let msg = msg.clone();
            async move { Err(crate::error::OrchestratorError::AgentFailed(msg)) }
        })
    }

    pub fn new<F, Fut>(name: impl Into<String>, handler: F) -> Self
    where
        F: for<'a> Fn(&'a AgentRunContext<'_>) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = OrchestratorResult<AgentRunOutcome>> + Send + 'static,
    {
        let handler: MockHandler = Arc::new(move |ctx| Box::pin(handler(ctx)));
        Self {
            name: name.into(),
            handler,
            invocations: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn invocations(&self) -> Vec<MockInvocation> {
        self.invocations.lock().clone()
    }
}

#[async_trait]
impl AgentRunner for MockAgentRunner {
    fn name(&self) -> &str {
        &self.name
    }

    async fn run(
        &self,
        ctx: AgentRunContext<'_>,
    ) -> OrchestratorResult<AgentRunOutcome> {
        self.invocations.lock().push(MockInvocation {
            job_id: ctx.job_id.to_string(),
            trial_id: ctx.trial_id.to_string(),
            agent_id: ctx.agent_id.to_string(),
            instruction: ctx.instruction.to_string(),
        });
        (self.handler)(&ctx).await
    }
}
