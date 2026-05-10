//! Sandbox driver error model.
//!
//! Error variants are split by concern so the orchestrator's retry
//! policy (`chronicle_domain::RetryConfig`) can decide whether to retry
//! based on `kind()` without parsing strings. New drivers should map
//! provider-specific errors onto these variants — never invent a new
//! variant per driver.

use std::fmt;

/// Result alias used throughout the crate.
pub type SandboxResult<T> = Result<T, SandboxError>;

/// Categories of sandbox errors. The orchestrator inspects `.kind()`
/// to decide retry vs fail-fast — see `RetryConfig.exclude_exceptions`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SandboxErrorKind {
    /// Misconfiguration: missing credentials, invalid driver kwargs,
    /// unsupported capability for the requested task. Never retried.
    Configuration,
    /// Transient network or provider error (timeout, 5xx, throttling).
    /// Eligible for retry.
    Transient,
    /// Driver capability isn't supported for this operation
    /// (e.g. attaching to a Mock sandbox). Never retried.
    Unsupported,
    /// The sandbox couldn't be created (image build failure,
    /// quota exceeded, region down). Retried with caution.
    StartFailed,
    /// Command exec timed out or returned a hard provider error.
    /// Note: a non-zero exit code from the *user's command* is NOT an
    /// error — it's reported on `ExecResult.return_code`.
    ExecFailed,
    /// File transfer failed (upload/download).
    FileTransfer,
    /// Internal/programmer error (invariant violation). Never retried.
    Internal,
}

#[derive(Debug, thiserror::Error)]
pub enum SandboxError {
    #[error("sandbox configuration error: {0}")]
    Configuration(String),

    #[error("sandbox transient error: {0}")]
    Transient(String),

    #[error("sandbox does not support this operation: {0}")]
    Unsupported(String),

    #[error("sandbox start failed: {0}")]
    StartFailed(String),

    #[error("sandbox exec failed: {0}")]
    ExecFailed(String),

    #[error("sandbox file transfer failed: {0}")]
    FileTransfer(String),

    #[error("sandbox internal error: {0}")]
    Internal(String),
}

impl SandboxError {
    pub fn kind(&self) -> SandboxErrorKind {
        match self {
            Self::Configuration(_) => SandboxErrorKind::Configuration,
            Self::Transient(_) => SandboxErrorKind::Transient,
            Self::Unsupported(_) => SandboxErrorKind::Unsupported,
            Self::StartFailed(_) => SandboxErrorKind::StartFailed,
            Self::ExecFailed(_) => SandboxErrorKind::ExecFailed,
            Self::FileTransfer(_) => SandboxErrorKind::FileTransfer,
            Self::Internal(_) => SandboxErrorKind::Internal,
        }
    }

    pub fn is_transient(&self) -> bool {
        matches!(self.kind(), SandboxErrorKind::Transient)
    }
}

impl fmt::Display for SandboxErrorKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::Configuration => "Configuration",
            Self::Transient => "Transient",
            Self::Unsupported => "Unsupported",
            Self::StartFailed => "StartFailed",
            Self::ExecFailed => "ExecFailed",
            Self::FileTransfer => "FileTransfer",
            Self::Internal => "Internal",
        };
        f.write_str(s)
    }
}

impl From<reqwest::Error> for SandboxError {
    fn from(e: reqwest::Error) -> Self {
        // reqwest's transient classification covers timeouts, connect
        // errors, body decode failures. Status-code 5xx is also bucketed
        // here; 4xx surfaces as Configuration since it usually means
        // "you sent the wrong thing".
        if e.is_timeout() || e.is_connect() || e.is_request() {
            Self::Transient(e.to_string())
        } else if let Some(status) = e.status() {
            if status.is_server_error() {
                Self::Transient(format!("{status}: {e}"))
            } else {
                Self::Configuration(format!("{status}: {e}"))
            }
        } else {
            Self::Transient(e.to_string())
        }
    }
}
