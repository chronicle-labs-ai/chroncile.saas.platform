//! Orchestrator-level error model.
//!
//! Sandbox + repo errors fold in via `From` impls, so the trial state
//! machine can use `?` throughout. The `kind()` method gives the retry
//! loop a stable label without parsing strings.

use chronicle_interfaces::RepoError;
use chronicle_sandbox::SandboxError;

pub type OrchestratorResult<T> = Result<T, OrchestratorError>;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OrchestratorErrorKind {
    /// Misconfigured trial — bad recipe, unknown agent, missing
    /// dataset case. Never retried.
    Configuration,
    /// Provider-side transient (network, 5xx). Retry-eligible.
    Transient,
    /// Sandbox failed to provision. Retried with caution.
    SandboxStartFailed,
    /// Agent runtime failure (timeout, non-zero exit, model API error).
    /// Retry policy depends on `RetryConfig`.
    AgentFailed,
    /// Verifier produced no reward file or an unparseable one.
    VerifierFailed,
    /// Persistence layer error.
    Persistence,
    /// Trial cancelled via `Job::cancel` or upstream drop.
    Cancelled,
    /// Programmer error — invariant broken.
    Internal,
}

impl OrchestratorErrorKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Configuration => "Configuration",
            Self::Transient => "Transient",
            Self::SandboxStartFailed => "SandboxStartFailed",
            Self::AgentFailed => "AgentFailed",
            Self::VerifierFailed => "VerifierFailed",
            Self::Persistence => "Persistence",
            Self::Cancelled => "Cancelled",
            Self::Internal => "Internal",
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum OrchestratorError {
    #[error("orchestrator configuration error: {0}")]
    Configuration(String),

    #[error("orchestrator transient error: {0}")]
    Transient(String),

    #[error("sandbox start failed: {0}")]
    SandboxStartFailed(String),

    #[error("agent failed: {0}")]
    AgentFailed(String),

    #[error("verifier failed: {0}")]
    VerifierFailed(String),

    #[error("persistence error: {0}")]
    Persistence(String),

    #[error("cancelled")]
    Cancelled,

    #[error("internal: {0}")]
    Internal(String),
}

impl OrchestratorError {
    pub fn kind(&self) -> OrchestratorErrorKind {
        match self {
            Self::Configuration(_) => OrchestratorErrorKind::Configuration,
            Self::Transient(_) => OrchestratorErrorKind::Transient,
            Self::SandboxStartFailed(_) => OrchestratorErrorKind::SandboxStartFailed,
            Self::AgentFailed(_) => OrchestratorErrorKind::AgentFailed,
            Self::VerifierFailed(_) => OrchestratorErrorKind::VerifierFailed,
            Self::Persistence(_) => OrchestratorErrorKind::Persistence,
            Self::Cancelled => OrchestratorErrorKind::Cancelled,
            Self::Internal(_) => OrchestratorErrorKind::Internal,
        }
    }

    /// Whether the trial-level retry loop should consider re-running.
    /// Mirrors Harbor's exclude-list pattern: agent-failed and
    /// verifier-failed are user-meaningful failures (the agent's
    /// fault) and never retried; transient + sandbox-start are.
    pub fn is_transient(&self) -> bool {
        matches!(
            self.kind(),
            OrchestratorErrorKind::Transient | OrchestratorErrorKind::SandboxStartFailed
        )
    }
}

impl From<SandboxError> for OrchestratorError {
    fn from(e: SandboxError) -> Self {
        use chronicle_sandbox::SandboxErrorKind as K;
        match e.kind() {
            K::Configuration => Self::Configuration(e.to_string()),
            K::Transient => Self::Transient(e.to_string()),
            K::Unsupported => Self::Configuration(e.to_string()),
            K::StartFailed => Self::SandboxStartFailed(e.to_string()),
            K::ExecFailed => Self::AgentFailed(e.to_string()),
            K::FileTransfer => Self::Transient(e.to_string()),
            K::Internal => Self::Internal(e.to_string()),
        }
    }
}

impl From<RepoError> for OrchestratorError {
    fn from(e: RepoError) -> Self {
        Self::Persistence(e.to_string())
    }
}
