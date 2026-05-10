//! Persistent CLI config + per-invocation overrides.
//!
//! Resolution order (lowest → highest priority):
//!   1. `Config::default()` — `http://localhost:3000`, no token.
//!   2. `~/.config/chronicle/config.toml` — written by `chronicle config set ...`.
//!   3. Environment variables (`CHRONICLE_BASE_URL`, `CHRONICLE_AUTH_TOKEN`).
//!   4. `--base-url` / `--token` CLI flags (handled by main; not here).

use crate::error::{CliError, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const DEFAULT_BASE_URL: &str = "http://localhost:3000";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Config {
    pub base_url: String,
    pub auth_token: Option<String>,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            base_url: DEFAULT_BASE_URL.to_string(),
            auth_token: None,
        }
    }
}

impl Config {
    /// Load + apply env overlays. Used by every command at startup.
    pub fn load_with_env() -> Self {
        let mut cfg = Self::load_from_disk().unwrap_or_default();
        if let Ok(url) = std::env::var("CHRONICLE_BASE_URL") {
            if !url.trim().is_empty() {
                cfg.base_url = url;
            }
        }
        if let Ok(tok) = std::env::var("CHRONICLE_AUTH_TOKEN") {
            if !tok.trim().is_empty() {
                cfg.auth_token = Some(tok);
            }
        }
        cfg
    }

    fn load_from_disk() -> Option<Self> {
        let path = config_path()?;
        let raw = std::fs::read_to_string(&path).ok()?;
        toml::from_str(&raw).ok()
    }

    pub fn save(&self) -> Result<()> {
        let path = config_path()
            .ok_or_else(|| CliError::config("could not resolve config dir on this OS"))?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let raw = toml::to_string_pretty(self)?;
        std::fs::write(&path, raw)?;
        // 0600 the file on Unix so the auth token isn't world-readable.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(&path)?.permissions();
            perms.set_mode(0o600);
            std::fs::set_permissions(&path, perms)?;
        }
        Ok(())
    }

    /// Apply CLI flag overrides on top of the loaded config.
    pub fn apply_overrides(&mut self, base_url: Option<String>, token: Option<String>) {
        if let Some(url) = base_url {
            self.base_url = url;
        }
        if let Some(tok) = token {
            self.auth_token = Some(tok);
        }
    }

    /// Strip trailing slashes — the routes always start with `/`.
    pub fn url(&self, path: &str) -> String {
        format!(
            "{}{}",
            self.base_url.trim_end_matches('/'),
            if path.starts_with('/') {
                path.to_string()
            } else {
                format!("/{path}")
            }
        )
    }

    /// Path to the on-disk config file. None on platforms without a
    /// home dir (essentially never on real machines).
    pub fn config_file() -> Option<PathBuf> {
        config_path()
    }
}

fn config_path() -> Option<PathBuf> {
    dirs::config_dir().map(|d| d.join("chronicle").join("config.toml"))
}

/// Pretty-print a config snapshot, masking the token. Used by
/// `chronicle config show`.
pub fn fmt_for_display(cfg: &Config) -> String {
    let token_view = match &cfg.auth_token {
        None => "<unset>".to_string(),
        Some(t) if t.len() <= 8 => "***".to_string(),
        Some(t) => format!("{}…{} ({} chars)", &t[..4], &t[t.len() - 4..], t.len()),
    };
    format!(
        "base_url    : {}\nauth_token  : {}\nconfig_file : {}",
        cfg.base_url,
        token_view,
        Config::config_file()
            .as_deref()
            .map(Path::display)
            .map(|d| d.to_string())
            .unwrap_or_else(|| "<unavailable>".to_string()),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn url_join_handles_leading_and_trailing_slashes() {
        let cfg = Config {
            base_url: "http://localhost:3000/".to_string(),
            auth_token: None,
        };
        assert_eq!(cfg.url("/api/health"), "http://localhost:3000/api/health");
        assert_eq!(cfg.url("api/health"), "http://localhost:3000/api/health");

        let cfg = Config {
            base_url: "http://localhost:3000".to_string(),
            auth_token: None,
        };
        assert_eq!(cfg.url("/api/health"), "http://localhost:3000/api/health");
    }

    #[test]
    fn apply_overrides_replaces_in_priority() {
        let mut cfg = Config::default();
        cfg.apply_overrides(Some("https://prod.example.com".to_string()), None);
        assert_eq!(cfg.base_url, "https://prod.example.com");
        assert!(cfg.auth_token.is_none());
        cfg.apply_overrides(None, Some("tok_xyz".to_string()));
        assert_eq!(cfg.auth_token.as_deref(), Some("tok_xyz"));
    }

    #[test]
    fn fmt_masks_token_safely() {
        let cfg = Config {
            base_url: "http://x".to_string(),
            auth_token: Some("abcdefghijklmnop".to_string()),
        };
        let s = fmt_for_display(&cfg);
        assert!(s.contains("abcd…mnop"));
        assert!(!s.contains("efghij"));
    }

    #[test]
    fn fmt_redacts_short_token() {
        let cfg = Config {
            base_url: "http://x".to_string(),
            auth_token: Some("short".to_string()),
        };
        let s = fmt_for_display(&cfg);
        assert!(s.contains("***"));
    }
}
