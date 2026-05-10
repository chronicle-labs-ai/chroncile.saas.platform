//! Wire-shape DTOs for the Daytona Cloud REST API.
//!
//! Field names mirror Daytona's camelCase JSON. Resources sit flat on
//! the request (`cpu`, `memory` in GiB, `disk` in GiB) — there's no
//! nested `resources` object on the public cloud surface. When the API
//! evolves, fixes land here, isolated from the driver in `mod.rs`.
//!
//! `#[allow(dead_code)]` at module level: several fields are populated
//! from the API for observability (state, snapshot, etc.) but not yet
//! consumed by the orchestrator. Removing them now would force a
//! churn pass when more endpoints come online.
#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/* ── Sandbox lifecycle ──────────────────────────────────── */

/// Daytona's `/sandbox` create endpoint accepts EITHER snapshot-mode
/// (uses a pre-built snapshot, no resources allowed) OR image-mode
/// (specifies image + cpu/memory/disk). The API rejects requests that
/// straddle the two; everything resource-related is skip-on-`None` so
/// the orchestrator can compose either flavour cleanly.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSandboxRequest {
    /// Container image to launch from. Mutually exclusive with
    /// `snapshot`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image: Option<String>,
    /// Pre-created Daytona snapshot (faster than image pull).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub snapshot: Option<String>,
    /// Resources are only valid in image-mode and are skipped on
    /// `None`. Daytona picks safe defaults when omitted.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cpu: Option<u32>,
    /// Memory in GiB.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memory: Option<u32>,
    /// Disk in GiB.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disk: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gpu: Option<u32>,
    /// Auto-stop after N minutes of inactivity. 0 disables.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_stop_interval: Option<u32>,
    /// Auto-archive after N minutes after stop.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_archive_interval: Option<u32>,
    /// Auto-delete after N minutes after stop. 0 = delete immediately.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_delete_interval: Option<u32>,
    /// Sandbox env vars, set on every command run inside it.
    #[serde(skip_serializing_if = "HashMap::is_empty")]
    pub env_vars: HashMap<String, String>,
    /// Free-form labels rendered as tags in the Daytona dashboard.
    #[serde(skip_serializing_if = "HashMap::is_empty")]
    pub labels: HashMap<String, String>,
    /// Whether the sandbox listens on a publicly reachable host.
    #[serde(default)]
    pub public: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SandboxResponse {
    pub id: String,
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub user: Option<String>,
    #[serde(default)]
    pub image: Option<String>,
}

/* ── Process / exec (toolbox endpoints) ──────────────────── */

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionRequest {
    pub session_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionResponse {
    #[serde(default)]
    pub session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteSessionCommandRequest {
    pub command: String,
    /// `false` = block until command completes; response carries
    /// `exitCode` + `output` directly. Cheap for fast commands.
    /// `true` = return cmd id immediately; client polls.
    pub run_async: bool,
}

/// Synchronous exec response. The driver uses sync mode by default —
/// the polling path (below) is kept as a fallback for long-running
/// commands.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteSessionCommandResponse {
    /// Command id (server-assigned). Used by the async fallback path.
    #[serde(default, alias = "cmd_id", alias = "id")]
    pub cmd_id: Option<String>,
    /// Combined stdout/stderr from the command, present in sync mode.
    #[serde(default)]
    pub output: Option<String>,
    /// Final exit code, present in sync mode.
    #[serde(default)]
    pub exit_code: Option<i32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionCommandStatusResponse {
    /// Present once the command exits; absent while running.
    #[serde(default)]
    pub exit_code: Option<i32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionCommandLogsResponse {
    /// Daytona returns combined stdout+stderr in `output`; the
    /// separated stdout/stderr fields are kept as aliases for
    /// forward-compat if/when Daytona adds them.
    #[serde(default, alias = "stdout")]
    pub stdout: Option<String>,
    #[serde(default, alias = "stderr")]
    pub stderr: Option<String>,
    #[serde(default)]
    pub output: Option<String>,
}

impl SessionCommandLogsResponse {
    /// Best-effort flat stdout view for surfacing to the orchestrator.
    pub fn flatten_stdout(&self) -> String {
        self.stdout
            .clone()
            .or_else(|| self.output.clone())
            .unwrap_or_default()
    }

    pub fn flatten_stderr(&self) -> String {
        self.stderr.clone().unwrap_or_default()
    }
}

/* ── Filesystem (toolbox endpoints) ──────────────────────── */

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfoResponse {
    #[serde(default)]
    pub is_dir: bool,
    #[serde(default)]
    pub size: u64,
    #[serde(default)]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ListFilesResponse {
    #[serde(default)]
    pub files: Vec<FileInfoEntry>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfoEntry {
    pub name: String,
    #[serde(default)]
    pub is_dir: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_request_serializes_flat_camel_case() {
        let mut env = HashMap::new();
        env.insert("FOO".to_string(), "bar".to_string());
        let req = CreateSandboxRequest {
            image: Some("alpine:3.19".to_string()),
            snapshot: None,
            cpu: Some(2),
            memory: Some(4),
            disk: Some(10),
            gpu: None,
            auto_stop_interval: None,
            auto_archive_interval: None,
            auto_delete_interval: None,
            env_vars: env,
            labels: HashMap::new(),
            public: false,
        };
        let json = serde_json::to_value(&req).unwrap();
        assert_eq!(json["image"], "alpine:3.19");
        assert_eq!(json["cpu"], 2);
        assert_eq!(json["memory"], 4);
        assert_eq!(json["disk"], 10);
        assert_eq!(json["envVars"]["FOO"], "bar");
        // `resources` should NOT be nested.
        assert!(json.get("resources").is_none());
        // Empty / unset resource fields shouldn't appear at all so the
        // server doesn't conflate "default" with "explicit zero".
        assert!(json.get("gpu").is_none());
        assert!(json.get("autoStopInterval").is_none());
    }

    #[test]
    fn snapshot_mode_omits_all_resource_fields() {
        // For default-snapshot creates, every resource field must be
        // omitted; otherwise Daytona returns 400 "Cannot specify
        // Sandbox resources when using a snapshot".
        let req = CreateSandboxRequest {
            image: None,
            snapshot: None,
            cpu: None,
            memory: None,
            disk: None,
            gpu: None,
            auto_stop_interval: None,
            auto_archive_interval: None,
            auto_delete_interval: None,
            env_vars: HashMap::new(),
            labels: HashMap::new(),
            public: false,
        };
        let json = serde_json::to_value(&req).unwrap();
        for k in [
            "image",
            "snapshot",
            "cpu",
            "memory",
            "disk",
            "gpu",
            "autoStopInterval",
        ] {
            assert!(json.get(k).is_none(), "{k} should be absent");
        }
    }

    #[test]
    #[allow(non_snake_case)]
    fn execute_response_parses_sync_and_async_shapes() {
        // Sync: exitCode + output present.
        let raw = r#"{"cmdId":"abc","output":"hi\n","exitCode":0}"#;
        let r: ExecuteSessionCommandResponse = serde_json::from_str(raw).unwrap();
        assert_eq!(r.cmd_id.as_deref(), Some("abc"));
        assert_eq!(r.exit_code, Some(0));
        assert_eq!(r.output.as_deref(), Some("hi\n"));

        // Async: just cmdId.
        let raw = r#"{"cmdId":"xyz"}"#;
        let r: ExecuteSessionCommandResponse = serde_json::from_str(raw).unwrap();
        assert_eq!(r.cmd_id.as_deref(), Some("xyz"));
        assert!(r.exit_code.is_none());

        // Older `id` alias.
        let raw = r#"{"id":"older"}"#;
        let r: ExecuteSessionCommandResponse = serde_json::from_str(raw).unwrap();
        assert_eq!(r.cmd_id.as_deref(), Some("older"));
    }
}
