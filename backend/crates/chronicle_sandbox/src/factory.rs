//! Sandbox driver factory + preflight.
//!
//! The orchestrator passes a `chronicle_domain::SandboxDriver` (echoed
//! from `BacktestJob.sandboxDriver`) and gets back a `Box<dyn Sandbox>`
//! it can hand to `Trial::run`. Driver-specific config is sourced from
//! env vars; future iterations can layer per-tenant config from the
//! database on top.

use crate::drivers::{DaytonaConfig, DaytonaSandbox, ExecStub, MockSandbox};
use crate::error::{SandboxError, SandboxResult};
use crate::traits::Sandbox;
use crate::types::ExecResult;
use chronicle_domain::SandboxDriver;

/// Build a sandbox instance for a given driver kind. The instance is
/// pure (no I/O) — call `start(opts)` to actually provision.
pub fn build(driver: SandboxDriver) -> SandboxResult<Box<dyn Sandbox>> {
    match driver {
        SandboxDriver::Mock => Ok(Box::new(build_dev_mock_sandbox())),
        SandboxDriver::Daytona => {
            let cfg = DaytonaConfig::from_env();
            cfg.preflight()?;
            Ok(Box::new(DaytonaSandbox::new(cfg)?))
        }
        SandboxDriver::Docker => Err(SandboxError::Unsupported(
            "Docker driver lands in Phase 1.5; use mock or daytona for now".to_string(),
        )),
    }
}

/// Pre-seeded `MockSandbox` for dev / smoke-test workflows. Returns
/// a sandbox whose exec handler:
///
/// * Treats `bash /tests/test.sh` as a successful run that wrote
///   `reward.txt = 1` to `/logs/verifier/`.
/// * Returns `0` for `mkdir -p` / `chmod` / `test -d` style probes.
/// * Returns `0` (silent) for everything else.
///
/// This makes `chronicle backtests jobs run --sandbox-driver mock`
/// produce a clean "all trials succeeded with reward=1" outcome,
/// which is exactly what dev devs want when validating the runtime
/// without real container infrastructure.
fn build_dev_mock_sandbox() -> MockSandbox {
    let sandbox = MockSandbox::new().with_stubs(vec![
        ExecStub {
            command_prefix: "mkdir -p /tmp/chronicle".to_string(),
            result: ExecResult::ok(""),
        },
        ExecStub {
            command_prefix: "test -d".to_string(),
            result: ExecResult::ok(""),
        },
        ExecStub {
            command_prefix: "test -f".to_string(),
            result: ExecResult::ok(""),
        },
        ExecStub {
            command_prefix: "chmod".to_string(),
            result: ExecResult::ok(""),
        },
        ExecStub {
            command_prefix: "bash /tmp/chronicle/tests/test.sh".to_string(),
            result: ExecResult::ok("ok"),
        },
        ExecStub {
            command_prefix: "bash -lc".to_string(),
            result: ExecResult::ok("ok"),
        },
    ]);
    // Pre-seed the reward file so verifier::download_file succeeds.
    // The verifier prefers reward.txt; reward.json is only consulted
    // on failure.
    sandbox.put_file(
        "/tmp/chronicle/logs/verifier/reward.txt",
        b"1\n".to_vec(),
    );
    sandbox
}

/// Run preflight checks for a driver without constructing a full
/// sandbox. Intended for the server's startup-time credential check
/// + the CLI's `chronicle sandbox preflight --driver <kind>`.
pub fn preflight(driver: SandboxDriver) -> SandboxResult<()> {
    match driver {
        SandboxDriver::Mock => Ok(()),
        SandboxDriver::Daytona => DaytonaConfig::from_env().preflight(),
        SandboxDriver::Docker => Err(SandboxError::Unsupported(
            "Docker driver lands in Phase 1.5".to_string(),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mock_builds_without_credentials() {
        build(SandboxDriver::Mock).unwrap();
        preflight(SandboxDriver::Mock).unwrap();
    }

    #[test]
    fn docker_returns_unsupported() {
        let result = build(SandboxDriver::Docker);
        let err = match result {
            Ok(_) => panic!("expected SandboxError::Unsupported for Docker"),
            Err(e) => e,
        };
        assert!(matches!(err.kind(), crate::error::SandboxErrorKind::Unsupported));
    }
}
