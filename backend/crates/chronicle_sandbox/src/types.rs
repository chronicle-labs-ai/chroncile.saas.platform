//! Shared types crossing the `Sandbox` trait boundary.
//!
//! Kept deliberately decoupled from `chronicle_domain::backtests` —
//! the sandbox trait should be reusable for anything that needs a
//! container-with-exec, not just trial execution. The orchestrator
//! adapts `BacktestRecipe`/`JobConfig` into `StartOpts` itself.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

/// Stable identifier for a sandbox produced by `start()`. Drivers
/// generate their own ids; the orchestrator persists them onto
/// `BacktestTrial.sandboxId` for audit + correlation.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct SandboxId(pub String);

impl SandboxId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for SandboxId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

/// Resource limits the orchestrator pins on the sandbox at start-time.
/// Sourced from `BacktestRecipe.environment` ↔ task config in the
/// frontend; a driver that can't enforce these returns an error from
/// `start()`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ResourceLimits {
    pub cpus: u32,
    pub memory_mb: u32,
    pub disk_mb: u32,
    pub gpus: u32,
}

impl ResourceLimits {
    pub const fn small() -> Self {
        Self {
            cpus: 1,
            memory_mb: 2048,
            disk_mb: 10_240,
            gpus: 0,
        }
    }
}

impl Default for ResourceLimits {
    fn default() -> Self {
        Self::small()
    }
}

/// How the sandbox image should be sourced. Drivers translate this
/// into provider-specific calls (Daytona: `Image.from_dockerfile` /
/// `Image.base`; Mock: ignore).
#[derive(Debug, Clone)]
pub enum ImageSource {
    /// Use a pre-built image from a registry (`alpine:3.19`,
    /// `gcr.io/.../my-task:v1`).
    PrebuiltImage(String),
    /// Build from a Dockerfile path on the orchestrator host.
    /// `context_dir` is the build context; defaults to the
    /// Dockerfile's parent directory if not set.
    Dockerfile {
        dockerfile_path: std::path::PathBuf,
        context_dir: Option<std::path::PathBuf>,
    },
    /// No-op for drivers that don't need an image (Mock).
    None,
}

/// Configuration the orchestrator passes to `Sandbox::start()`.
#[derive(Debug, Clone)]
pub struct StartOpts {
    /// A stable name the driver can use for the sandbox label / project
    /// name. Typically `<job_id>__<trial_id>`. Drivers MAY transform
    /// this to fit provider-side naming rules.
    pub session_id: String,

    pub image: ImageSource,
    pub resources: ResourceLimits,

    /// Whether the sandbox should be allowed to reach the public
    /// internet. When false, drivers without `disable_internet`
    /// capability MUST return `SandboxError::Configuration` from
    /// their constructor (the orchestrator pre-flights this).
    pub allow_internet: bool,

    /// Persistent env vars set on every `exec` inside this sandbox.
    /// Per-exec env from `ExecRequest::env` takes precedence.
    pub env: HashMap<String, String>,

    /// Free-form metadata the driver records on the sandbox for
    /// observability (`tenant_id`, `job_id`, `trial_id`). Daytona
    /// surfaces these in the dashboard; Mock just records them.
    pub labels: HashMap<String, String>,

    /// Maximum lifetime; drivers MAY enforce this (Daytona uses
    /// `auto_delete_interval`). Defaults to 1 hour.
    pub max_lifetime: Duration,

    /// Idle timeout — sandbox is auto-stopped after N seconds of
    /// inactivity. None means "no idle timeout".
    pub idle_timeout: Option<Duration>,
}

impl Default for StartOpts {
    fn default() -> Self {
        Self {
            session_id: String::new(),
            image: ImageSource::None,
            resources: ResourceLimits::default(),
            allow_internet: true,
            env: HashMap::new(),
            labels: HashMap::new(),
            max_lifetime: Duration::from_secs(60 * 60),
            idle_timeout: None,
        }
    }
}

/// One command the orchestrator wants to run inside the sandbox.
#[derive(Debug, Clone)]
pub struct ExecRequest {
    pub command: String,
    pub cwd: Option<String>,
    pub env: HashMap<String, String>,
    pub user: Option<String>,
    pub timeout: Option<Duration>,
}

impl ExecRequest {
    pub fn new(command: impl Into<String>) -> Self {
        Self {
            command: command.into(),
            cwd: None,
            env: HashMap::new(),
            user: None,
            timeout: None,
        }
    }

    pub fn with_cwd(mut self, cwd: impl Into<String>) -> Self {
        self.cwd = Some(cwd.into());
        self
    }

    pub fn with_user(mut self, user: impl Into<String>) -> Self {
        self.user = Some(user.into());
        self
    }

    pub fn with_timeout(mut self, t: Duration) -> Self {
        self.timeout = Some(t);
        self
    }

    pub fn with_env(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.env.insert(key.into(), value.into());
        self
    }
}

/// Result of an `exec`. Note: a non-zero `return_code` is NOT an
/// error condition — it's how the verifier signals failure to the
/// orchestrator. Real driver errors (timeouts, network failures)
/// surface as `SandboxError`.
#[derive(Debug, Clone)]
pub struct ExecResult {
    pub return_code: i32,
    pub stdout: String,
    pub stderr: String,
}

impl ExecResult {
    pub fn ok(stdout: impl Into<String>) -> Self {
        Self {
            return_code: 0,
            stdout: stdout.into(),
            stderr: String::new(),
        }
    }

    pub fn failed(return_code: i32, stderr: impl Into<String>) -> Self {
        Self {
            return_code,
            stdout: String::new(),
            stderr: stderr.into(),
        }
    }

    /// Convenience: did the command succeed (return_code == 0).
    pub fn succeeded(&self) -> bool {
        self.return_code == 0
    }
}
