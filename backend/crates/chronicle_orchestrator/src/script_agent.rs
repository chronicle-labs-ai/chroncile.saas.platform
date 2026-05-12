//! `ScriptAgentRunner` — the simplest "real" agent.
//!
//! Lifecycle inside one trial:
//!
//! 1. Make sure `/work/` exists in the sandbox.
//! 2. Write the instruction (the per-case prompt the dataset carries)
//!    to `/work/instruction.txt`.
//! 3. Run the configured shell command. The "agent" is whatever that
//!    command does — read the instruction, call out to anything,
//!    write to `/work/`.
//! 4. Capture stdout/stderr + exit code as the agent run outcome. A
//!    non-zero exit code is reported as `OrchestratorError::AgentFailed`
//!    so the orchestrator's retry policy can route it.
//!
//! The verifier (Phase 2) reads `/work/output.*` (or whatever the
//! recipe's `tests/test.sh` looks for) and writes the reward file.
//! The runner doesn't presume any output schema.
//!
//! When you eventually want a real LLM-backed agent, swap this out
//! for an `HttpAgentRunner` that POSTs the instruction to a hosted
//! agent endpoint and writes the response into `/work/`. The trait
//! contract is identical.

use crate::agent_runner::{AgentRunContext, AgentRunOutcome, AgentRunner};
use crate::error::{OrchestratorError, OrchestratorResult};
use async_trait::async_trait;
use chronicle_sandbox::ExecRequest;
use std::time::Duration;

/// Per-trial working directory inside the sandbox. The script can
/// assume it exists and is writable. Sits under `/tmp/` so the
/// default non-root sandbox user (e.g. Daytona's `daytona` user) can
/// always write here without elevated permissions.
pub const WORK_DIR: &str = "/tmp/chronicle/work";
pub const INSTRUCTION_PATH: &str = "/tmp/chronicle/work/instruction.txt";

/// Default timeout the runner enforces on its own exec call (the
/// orchestrator's per-phase timeout is the outer guard).
const DEFAULT_AGENT_TIMEOUT: Duration = Duration::from_secs(5 * 60);

/// Runs a configurable shell command as the agent.
///
/// Construct with:
/// * `ScriptAgentRunner::echo()` — built-in demo script that writes
///   the instruction back to `/work/output.txt`. Useful for verifying
///   the wiring end-to-end.
/// * `ScriptAgentRunner::new(script)` — your own bash command. The
///   command runs through `bash -lc` so `$VARS` and pipes work as
///   expected.
#[derive(Clone)]
pub struct ScriptAgentRunner {
    name: String,
    /// The bash command run after the instruction is written. Receives
    /// `INSTRUCTION_PATH` env var pointing at the instruction file.
    script: String,
    /// User to run the script as (e.g. "agent", "root"). When `None`
    /// the sandbox default is used.
    run_as: Option<String>,
    timeout: Duration,
}

impl ScriptAgentRunner {
    /// Build a runner from a literal script string.
    pub fn new(script: impl Into<String>) -> Self {
        Self {
            name: "script-agent".to_string(),
            script: script.into(),
            run_as: None,
            timeout: DEFAULT_AGENT_TIMEOUT,
        }
    }

    /// Built-in echo demo: writes the instruction back to
    /// `$WORK_DIR/output.txt` so the verifier can confirm the agent
    /// ran. Drives the "wiring works" check without needing a real
    /// model.
    pub fn echo() -> Self {
        Self::new(
            "set -euo pipefail; \
             cp \"$INSTRUCTION_PATH\" \"$WORK_DIR/output.txt\" && \
             echo \"echo agent ran successfully\"",
        )
        .with_name("echo-agent")
    }

    pub fn with_name(mut self, name: impl Into<String>) -> Self {
        self.name = name.into();
        self
    }

    pub fn with_user(mut self, user: impl Into<String>) -> Self {
        self.run_as = Some(user.into());
        self
    }

    pub fn with_timeout(mut self, t: Duration) -> Self {
        self.timeout = t;
        self
    }
}

#[async_trait]
impl AgentRunner for ScriptAgentRunner {
    fn name(&self) -> &str {
        &self.name
    }

    async fn run(
        &self,
        ctx: AgentRunContext<'_>,
    ) -> OrchestratorResult<AgentRunOutcome> {
        // 1. Make sure the work dir exists. We use `/tmp/chronicle/`
        //    so the default sandbox user can write without sudo —
        //    Daytona sandboxes run as `daytona`, not root.
        let mkdir = ExecRequest::new(format!(
            "mkdir -p {WORK_DIR} && chmod 777 {WORK_DIR}"
        ))
        .with_timeout(Duration::from_secs(15));
        let result = ctx.sandbox.exec(mkdir).await?;
        if result.return_code != 0 {
            return Err(OrchestratorError::AgentFailed(format!(
                "could not prepare {WORK_DIR}: rc={} stdout={} stderr={}",
                result.return_code,
                truncate(&result.stdout, 512),
                truncate(&result.stderr, 512)
            )));
        }

        // 2. Write the instruction to a host-side temp file, then upload.
        //    Going via tempfile is safer than embedding the instruction
        //    in the shell command (escaping minefield).
        let tmp = std::env::temp_dir().join(format!(
            "chronicle_agent_instruction_{}",
            ulid::Ulid::new()
        ));
        std::fs::write(&tmp, ctx.instruction.as_bytes()).map_err(|e| {
            OrchestratorError::AgentFailed(format!("could not write instruction tempfile: {e}"))
        })?;
        let upload_result = ctx.sandbox.upload_file(&tmp, INSTRUCTION_PATH).await;
        let _ = std::fs::remove_file(&tmp);
        upload_result?;

        // 3. Run the script. Pass INSTRUCTION_PATH so the script can
        //    locate the prompt without our env-var format leaking.
        let mut req = ExecRequest::new(format!("bash -lc {}", shell_quote(&self.script)))
            .with_env("INSTRUCTION_PATH", INSTRUCTION_PATH)
            .with_env("WORK_DIR", WORK_DIR)
            .with_env("CHRONICLE_TRIAL_ID", ctx.trial_id)
            .with_env("CHRONICLE_AGENT_ID", ctx.agent_id)
            .with_timeout(self.timeout);
        if let Some(user) = &self.run_as {
            req = req.with_user(user.clone());
        }
        let result = ctx.sandbox.exec(req).await?;

        if result.return_code != 0 {
            return Err(OrchestratorError::AgentFailed(format!(
                "script-agent exit {}: stdout={}, stderr={}",
                result.return_code,
                truncate(&result.stdout, 512),
                truncate(&result.stderr, 512),
            )));
        }

        // 4. Surface the script output verbatim as the trajectory.
        //    Future LLM-backed runners will produce structured JSON
        //    here; for now it's a single-string transcript.
        Ok(AgentRunOutcome {
            input_tokens: None,
            output_tokens: None,
            reasoning_tokens: None,
            trajectory_json: Some(serde_json::json!({
                "kind": "script-agent",
                "name": self.name,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "return_code": result.return_code,
            })),
            output_text: None,
        })
    }
}

/// POSIX single-quote escape for the bash command. Inputs from
/// `ScriptAgentRunner::new(...)` are operator-controlled (env var or
/// runtime config) so this is defense-in-depth, not a security
/// boundary.
fn shell_quote(s: &str) -> String {
    if s.is_empty() {
        return "''".to_string();
    }
    let escaped = s.replace('\'', "'\\''");
    format!("'{escaped}'")
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        return s.to_string();
    }
    format!("{}…[+{} bytes]", &s[..max], s.len() - max)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent_runner::AgentRunContext;
    use chronicle_sandbox::{
        drivers::{ExecStub, MockSandbox},
        ExecResult, Sandbox, StartOpts,
    };

    async fn fixture_sandbox() -> Box<dyn chronicle_sandbox::Sandbox> {
        let mut sb = MockSandbox::new().with_stubs(vec![
            ExecStub {
                command_prefix: "mkdir -p /work".to_string(),
                result: ExecResult::ok(""),
            },
            ExecStub {
                command_prefix: "bash -lc".to_string(),
                result: ExecResult::ok("agent done"),
            },
        ]);
        sb.start(StartOpts::default()).await.unwrap();
        Box::new(sb)
    }

    #[tokio::test]
    async fn echo_runner_succeeds_against_mock() {
        let sandbox = fixture_sandbox().await;
        let runner = ScriptAgentRunner::echo();
        let ctx = AgentRunContext {
            job_id: "j1",
            trial_id: "t1",
            agent_id: "a1",
            instruction: "do the thing",
            sandbox: sandbox.as_ref(),
        };
        let outcome = runner.run(ctx).await.unwrap();
        assert!(outcome.trajectory_json.is_some());
        let traj = outcome.trajectory_json.unwrap();
        assert_eq!(traj["kind"], "script-agent");
        assert_eq!(traj["return_code"], 0);
    }

    #[tokio::test]
    async fn nonzero_exit_surfaces_as_agent_failed() {
        let mut sb = MockSandbox::new().with_stubs(vec![
            ExecStub {
                command_prefix: "mkdir -p /work".to_string(),
                result: ExecResult::ok(""),
            },
            ExecStub {
                command_prefix: "bash -lc".to_string(),
                result: ExecResult::failed(7, "boom"),
            },
        ]);
        sb.start(StartOpts::default()).await.unwrap();
        let sandbox: Box<dyn chronicle_sandbox::Sandbox> = Box::new(sb);
        let runner = ScriptAgentRunner::new("false");
        let ctx = AgentRunContext {
            job_id: "j1",
            trial_id: "t1",
            agent_id: "a1",
            instruction: "do",
            sandbox: sandbox.as_ref(),
        };
        let err = runner.run(ctx).await.unwrap_err();
        assert!(matches!(
            err.kind(),
            crate::error::OrchestratorErrorKind::AgentFailed
        ));
        assert!(err.to_string().contains("exit 7"));
    }
}
