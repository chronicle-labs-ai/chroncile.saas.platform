//! Daytona driver configuration + credential preflight.
//!
//! Three sources, in priority order:
//!   1. `DaytonaConfig::from_kwargs(...)` — fields set explicitly.
//!   2. `DaytonaConfig::from_env()` — well-known env vars.
//!   3. `DaytonaConfig::default()` — public Daytona Cloud endpoint, no creds.

use crate::error::{SandboxError, SandboxResult};
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct DaytonaConfig {
    /// REST API base URL. Default is the public Daytona Cloud endpoint;
    /// override for self-hosted via `DAYTONA_API_URL`.
    pub api_url: String,

    /// Bearer token for API auth. Required (returns
    /// `SandboxError::Configuration` from preflight if missing).
    pub api_key: Option<String>,

    /// Optional organization id. When set, written into the
    /// `X-Daytona-Organization-ID` header on every request.
    pub organization_id: Option<String>,

    /// HTTP client timeout per request.
    pub request_timeout: Duration,

    /// Default sandbox creation timeout. Surfaces as 504 from
    /// `start()` if exceeded.
    pub create_timeout: Duration,

    /// Polling interval when waiting for an exec command to finish.
    pub exec_poll_interval: Duration,
}

impl Default for DaytonaConfig {
    fn default() -> Self {
        Self {
            // Public Daytona Cloud API. Verified against `dtn_…` keys.
            // Self-hosted deployments override via `DAYTONA_API_URL`.
            api_url: "https://app.daytona.io/api".to_string(),
            api_key: None,
            organization_id: None,
            request_timeout: Duration::from_secs(60),
            create_timeout: Duration::from_secs(300),
            exec_poll_interval: Duration::from_millis(500),
        }
    }
}

impl DaytonaConfig {
    /// Read credentials from the canonical env vars.
    /// Mirrors Harbor's preflight pattern: `DAYTONA_API_KEY` is the
    /// primary auth path; org id is optional.
    pub fn from_env() -> Self {
        let mut cfg = Self::default();
        if let Ok(url) = std::env::var("DAYTONA_API_URL") {
            cfg.api_url = url;
        }
        if let Ok(key) = std::env::var("DAYTONA_API_KEY") {
            if !key.is_empty() {
                cfg.api_key = Some(key);
            }
        }
        if let Ok(org) = std::env::var("DAYTONA_ORGANIZATION_ID") {
            if !org.is_empty() {
                cfg.organization_id = Some(org);
            }
        }
        cfg
    }

    /// Validate that the bare minimum required to talk to Daytona is
    /// present. Called by `preflight::run("daytona")` once at server
    /// startup so trials don't fail mid-flight.
    pub fn preflight(&self) -> SandboxResult<()> {
        if self.api_key.as_deref().unwrap_or("").is_empty() {
            return Err(SandboxError::Configuration(
                "Daytona requires DAYTONA_API_KEY to be set. \
                 Get one at https://app.daytona.io/dashboard/keys"
                    .to_string(),
            ));
        }
        if self.api_url.is_empty() {
            return Err(SandboxError::Configuration(
                "Daytona api_url cannot be empty".to_string(),
            ));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_point_at_public_cloud() {
        let cfg = DaytonaConfig::default();
        assert_eq!(cfg.api_url, "https://app.daytona.io/api");
        assert!(cfg.api_key.is_none());
    }

    #[test]
    fn preflight_fails_without_api_key() {
        let cfg = DaytonaConfig::default();
        let err = cfg.preflight().unwrap_err();
        assert!(err.to_string().contains("DAYTONA_API_KEY"));
    }

    #[test]
    fn preflight_passes_with_api_key() {
        let cfg = DaytonaConfig {
            api_key: Some("dt_test_xyz".to_string()),
            ..Default::default()
        };
        cfg.preflight().unwrap();
    }
}
