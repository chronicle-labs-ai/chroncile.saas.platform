//! User-facing error type for the CLI.
//!
//! Wraps the usual suspects (`reqwest`, `serde_json`, `io`) and adds
//! domain-aware variants so users see "no recipe at <path>" instead of
//! "No such file or directory (os error 2)".

use std::path::PathBuf;

pub type Result<T> = std::result::Result<T, CliError>;

/// Format a detail suffix, suppressing it when the detail string is
/// just a tautological repeat of the variant label (e.g.
/// `NotFound("not found")` → "not found", not "not found: not found").
fn fmt_detail(detail: &str) -> String {
    let trimmed = detail.trim();
    let lower = trimmed.to_ascii_lowercase();
    if trimmed.is_empty()
        || lower == "not found"
        || lower == "forbidden"
        || lower == "request failed"
    {
        String::new()
    } else {
        format!(": {trimmed}")
    }
}

#[derive(Debug, thiserror::Error)]
pub enum CliError {
    #[error("config error: {0}")]
    Config(String),

    #[error("recipe file not found: {0}")]
    RecipeNotFound(PathBuf),

    #[error("could not parse recipe at {path}: {message}")]
    RecipeParse {
        path: PathBuf,
        message: String,
    },

    #[error("authentication failed — set CHRONICLE_AUTH_TOKEN or run `chronicle config set token <jwt>`")]
    Unauthenticated,

    #[error("forbidden{}", fmt_detail(.0))]
    Forbidden(String),

    #[error("not found{}", fmt_detail(.0))]
    NotFound(String),

    #[error("backend returned {status}{}", fmt_detail(.body))]
    Http { status: u16, body: String },

    #[error("network error: {0}")]
    Network(String),

    #[error("server stream ended unexpectedly")]
    StreamClosed,

    #[error("internal: {0}")]
    Internal(String),
}

impl CliError {
    pub fn config(msg: impl Into<String>) -> Self {
        Self::Config(msg.into())
    }
}

impl From<reqwest::Error> for CliError {
    fn from(e: reqwest::Error) -> Self {
        if let Some(status) = e.status() {
            match status.as_u16() {
                401 => Self::Unauthenticated,
                403 => Self::Forbidden(e.to_string()),
                404 => Self::NotFound(e.to_string()),
                _ => Self::Http {
                    status: status.as_u16(),
                    body: e.to_string(),
                },
            }
        } else {
            Self::Network(e.to_string())
        }
    }
}

impl From<serde_json::Error> for CliError {
    fn from(e: serde_json::Error) -> Self {
        Self::Internal(format!("json: {e}"))
    }
}

impl From<std::io::Error> for CliError {
    fn from(e: std::io::Error) -> Self {
        Self::Internal(format!("io: {e}"))
    }
}

impl From<toml::ser::Error> for CliError {
    fn from(e: toml::ser::Error) -> Self {
        Self::Internal(format!("toml ser: {e}"))
    }
}
