//! Daytona Cloud sandbox driver.
//!
//! Talks to Daytona's REST API directly via reqwest (no third-party
//! Rust SDK). Endpoint paths are derived from the public Daytona Cloud
//! API surface and Harbor's `daytona-py` SDK usage; **Phase 1.5 will
//! verify each endpoint against a live account**. When divergence is
//! found, fixes should land in `client.rs` (transport) or `types.rs`
//! (DTOs) — this file owns lifecycle + sequencing only.
//!
//! Single-container only for now — Daytona's "DinD compose" mode (used
//! by Harbor for multi-container tasks) is intentionally out of scope.

mod config;
mod client;
mod types;

pub use config::DaytonaConfig;
pub use client::DaytonaHttpClient;

use crate::capabilities::SandboxCapabilities;
use crate::error::{SandboxError, SandboxResult};
use crate::traits::Sandbox;
use crate::types::{ExecRequest, ExecResult, ImageSource, SandboxId, StartOpts};
use async_trait::async_trait;
use parking_lot::Mutex;
use reqwest::Method;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::{sleep, Instant};
use types::{
    CreateSandboxRequest, CreateSessionRequest, ExecuteSessionCommandRequest,
    ExecuteSessionCommandResponse, FileInfoResponse, SandboxResponse,
    SessionCommandLogsResponse, SessionCommandStatusResponse,
};

/// Daytona-backed implementation of the `Sandbox` trait.
pub struct DaytonaSandbox {
    client: DaytonaHttpClient,
    /// Sandbox state is shared mutably between trait methods (`stop`
    /// is `&mut self`, `exec` is `&self`) — wrap in Arc<Mutex<_>>.
    state: Arc<Mutex<DaytonaState>>,
}

#[derive(Default)]
struct DaytonaState {
    /// Set after `start()` succeeds; cleared after `stop(delete=true)`.
    id: Option<SandboxId>,
    /// `StartOpts.session_id` — re-used as the Daytona process session
    /// id so every exec lives in the same shell context.
    session_id: Option<String>,
}

impl DaytonaSandbox {
    pub fn new(config: DaytonaConfig) -> SandboxResult<Self> {
        let client = DaytonaHttpClient::new(config)?;
        Ok(Self {
            client,
            state: Arc::new(Mutex::new(DaytonaState::default())),
        })
    }

    /// Convenience for the factory: build from env vars.
    pub fn from_env() -> SandboxResult<Self> {
        Self::new(DaytonaConfig::from_env())
    }

    /// Currently-active sandbox id (`None` before start, after stop).
    pub fn current_id(&self) -> Option<SandboxId> {
        self.state.lock().id.clone()
    }

    fn require_id(&self) -> SandboxResult<String> {
        self.state
            .lock()
            .id
            .as_ref()
            .map(|i| i.as_str().to_string())
            .ok_or_else(|| {
                SandboxError::Internal("DaytonaSandbox: not started".to_string())
            })
    }

    fn require_session(&self) -> SandboxResult<String> {
        self.state
            .lock()
            .session_id
            .as_ref()
            .cloned()
            .ok_or_else(|| {
                SandboxError::Internal("DaytonaSandbox: no active session".to_string())
            })
    }

    /// Translate `StartOpts` into the Daytona create payload.
    ///
    /// Two creation modes:
    ///
    /// * **Image mode** (`ImageSource::PrebuiltImage`) — pass `image`
    ///   and resource fields. Daytona pulls the image and provisions
    ///   a fresh sandbox with the given CPU/memory/disk.
    /// * **Snapshot mode** (`ImageSource::None`) — pass nothing
    ///   resource-related; Daytona uses the default snapshot. The
    ///   resource fields MUST be absent from JSON or the API returns
    ///   400 "Cannot specify Sandbox resources when using a snapshot".
    ///
    /// `Dockerfile` source is not yet supported — Daytona's build
    /// flow is a separate snapshot-bake pipeline that we'd model as
    /// its own driver method (Phase 2.5).
    fn build_create_request(&self, opts: &StartOpts) -> SandboxResult<CreateSandboxRequest> {
        let mut labels = opts.labels.clone();
        labels
            .entry("chronicle.session_id".to_string())
            .or_insert_with(|| opts.session_id.clone());

        match &opts.image {
            ImageSource::Dockerfile { .. } => Err(SandboxError::Unsupported(
                "DaytonaSandbox: Dockerfile-based images require a separate \
                 snapshot-build flow; pass a pre-built image to start() for now"
                    .to_string(),
            )),
            ImageSource::PrebuiltImage(img) => {
                // Phase 5 debug: send the absolute minimum payload —
                // just `image` + labels + env. If THIS returns the
                // "snapshot" error, the field name is wrong (or
                // image-mode isn't called this; could be `from_image`
                // / `imageRef` / etc.). If it succeeds with default
                // resources, we layer cpu/memory/disk back in once
                // we know the right shape.
                Ok(CreateSandboxRequest {
                    image: Some(img.clone()),
                    snapshot: None,
                    cpu: None,
                    memory: None,
                    disk: None,
                    gpu: None,
                    auto_stop_interval: None,
                    auto_archive_interval: None,
                    auto_delete_interval: None,
                    env_vars: opts.env.clone(),
                    labels,
                    public: false,
                })
            }
            ImageSource::None => {
                // Default-snapshot path: omit every resource field.
                Ok(CreateSandboxRequest {
                    image: None,
                    snapshot: None,
                    cpu: None,
                    memory: None,
                    disk: None,
                    gpu: None,
                    auto_stop_interval: None,
                    auto_archive_interval: None,
                    auto_delete_interval: None,
                    env_vars: opts.env.clone(),
                    labels,
                    public: false,
                })
            }
        }
    }

    /// Poll the Daytona session-command endpoint until it reports an
    /// exit code, then fetch logs and assemble an `ExecResult`.
    async fn poll_command(
        &self,
        sandbox_id: &str,
        session_id: &str,
        cmd_id: &str,
        timeout: Option<Duration>,
    ) -> SandboxResult<ExecResult> {
        let deadline = timeout.map(|t| Instant::now() + t);
        let status_path = format!(
            "/toolbox/{sandbox_id}/toolbox/process/session/{session_id}/command/{cmd_id}"
        );
        let logs_path = format!(
            "/toolbox/{sandbox_id}/toolbox/process/session/{session_id}/command/{cmd_id}/logs"
        );

        loop {
            if let Some(d) = deadline {
                if Instant::now() >= d {
                    return Err(SandboxError::ExecFailed(format!(
                        "DaytonaSandbox: exec exceeded timeout {timeout:?}",
                    )));
                }
            }
            let status: SessionCommandStatusResponse = self
                .client
                .json_in_json_out::<(), _>(Method::GET, &status_path, None)
                .await?;
            if let Some(exit_code) = status.exit_code {
                let logs: SessionCommandLogsResponse = self
                    .client
                    .json_in_json_out::<(), _>(Method::GET, &logs_path, None)
                    .await
                    .unwrap_or_default();
                return Ok(ExecResult {
                    return_code: exit_code,
                    stdout: logs.flatten_stdout(),
                    stderr: logs.flatten_stderr(),
                });
            }
            sleep(self.client.cfg().exec_poll_interval).await;
        }
    }
}

#[async_trait]
impl Sandbox for DaytonaSandbox {
    fn capabilities(&self) -> SandboxCapabilities {
        SandboxCapabilities {
            // GPUs are quota-gated per account but the API surface
            // supports them. Orchestrator validates against live
            // account state at preflight, not here.
            gpus: true,
            disable_internet: true,
            windows: false,
            mounted: false,
            attach: true,
        }
    }

    fn driver(&self) -> &'static str {
        "daytona"
    }

    fn id(&self) -> Option<&SandboxId> {
        // See MockSandbox::id() — same constraint, can't return a
        // borrow through a Mutex without leaking the guard.
        None
    }

    async fn start(&mut self, opts: StartOpts) -> SandboxResult<SandboxId> {
        if self.state.lock().id.is_some() {
            return Err(SandboxError::Internal(
                "DaytonaSandbox: start() called twice".to_string(),
            ));
        }

        let req = self.build_create_request(&opts)?;
        let session_id = opts.session_id.clone();

        // Daytona's create endpoint returns the new sandbox metadata.
        // We don't shield this future against cancellation here — the
        // orchestrator wraps trial cleanup in `tokio::spawn` per the
        // Phase 1 plan, which keeps the cleanup running even if the
        // outer trial future is dropped mid-create.
        let resp: SandboxResponse = self
            .client
            .json_in_json_out(Method::POST, "/sandbox", Some(&req))
            .await
            .map_err(|e| match e {
                // Tag create failures specifically so retries +
                // observability can reason about them.
                SandboxError::Transient(msg) => {
                    SandboxError::StartFailed(format!("transient: {msg}"))
                }
                other => other,
            })?;

        let id = SandboxId::new(resp.id);

        // Open a long-lived process session in the toolbox. Every exec
        // runs inside it so env / cwd state persists across calls
        // (same trick Harbor's Daytona driver uses). Daytona's API
        // path has a redundant double `/toolbox/` segment — that's
        // their convention, not a typo.
        self.client
            .json_in_no_body(
                Method::POST,
                &format!("/toolbox/{}/toolbox/process/session", id.as_str()),
                Some(&CreateSessionRequest {
                    session_id: session_id.clone(),
                }),
            )
            .await?;

        let mut state = self.state.lock();
        state.id = Some(id.clone());
        state.session_id = Some(session_id);
        Ok(id)
    }

    async fn stop(&mut self, delete: bool) -> SandboxResult<()> {
        let (id, _session_id) = {
            let mut state = self.state.lock();
            let id = match state.id.take() {
                Some(id) => id,
                None => return Ok(()),
            };
            (id, state.session_id.take())
        };

        if !delete {
            // Daytona doesn't have a "stop and keep" toggle on the
            // public API; leave the sandbox alive but disown it. The
            // server-side auto_stop_interval will reap eventually.
            tracing::info!(
                sandbox_id = %id,
                "DaytonaSandbox::stop(delete=false): leaving sandbox alive"
            );
            return Ok(());
        }

        self.client
            .json_in_no_body::<()>(
                Method::DELETE,
                &format!("/sandbox/{}", id.as_str()),
                None,
            )
            .await
    }

    async fn exec(&self, req: ExecRequest) -> SandboxResult<ExecResult> {
        let sandbox_id = self.require_id()?;
        let session_id = self.require_session()?;
        let timeout = req.timeout;

        // Compose env + user + cwd into the actual shell command so we
        // don't have to expose them in the API DTO. Same recipe Harbor
        // uses for its Daytona driver.
        let composed = compose_command(&req);

        let exec_path = format!(
            "/toolbox/{sandbox_id}/toolbox/process/session/{session_id}/exec"
        );

        // Synchronous mode: server blocks until the command exits and
        // returns exit code + combined output in a single response.
        // Cheap for fast commands (mkdir, chmod, test). For long-
        // running agent execs, callers can configure async via the
        // poll path below.
        let resp: ExecuteSessionCommandResponse = self
            .client
            .json_in_json_out(
                Method::POST,
                &exec_path,
                Some(&ExecuteSessionCommandRequest {
                    command: composed,
                    run_async: false,
                }),
            )
            .await?;

        // Sync path: response carries the answer directly.
        if let Some(exit_code) = resp.exit_code {
            return Ok(ExecResult {
                return_code: exit_code,
                stdout: resp.output.unwrap_or_default(),
                stderr: String::new(),
            });
        }

        // Fallback: server returned a cmd id with no exit code. Poll.
        let cmd_id = resp.cmd_id.ok_or_else(|| {
            SandboxError::ExecFailed(
                "Daytona exec returned neither exitCode nor cmdId".to_string(),
            )
        })?;
        self.poll_command(&sandbox_id, &session_id, &cmd_id, timeout).await
    }

    async fn upload_file(&self, src: &Path, dst: &str) -> SandboxResult<()> {
        // Daytona's `/files/upload` endpoint is deprecated (and the
        // documented multipart shape returns 400). Write via the
        // exec session instead — base64-encode locally, decode in the
        // sandbox. Works for any file size up to the sandbox's
        // shell-arg-length limit (~128 KiB on Linux); large blobs
        // would need streaming, which we'll add when needed.
        let bytes = tokio::fs::read(src).await.map_err(|e| {
            SandboxError::FileTransfer(format!(
                "DaytonaSandbox::upload_file({}): {e}",
                src.display()
            ))
        })?;
        self.write_bytes_via_exec(dst, &bytes).await
    }

    async fn upload_dir(&self, src: &Path, dst: &str) -> SandboxResult<()> {
        // Tar the local tree into memory, base64-encode, decode +
        // extract in the sandbox. Single round-trip per directory
        // tree, no deprecated APIs.
        if !src.is_dir() {
            return Err(SandboxError::FileTransfer(format!(
                "DaytonaSandbox::upload_dir: not a directory: {}",
                src.display()
            )));
        }
        let tar_bytes = tar_dir_to_gz(src).map_err(|e| {
            SandboxError::FileTransfer(format!(
                "DaytonaSandbox::upload_dir tar({}): {e}",
                src.display()
            ))
        })?;
        let dst_root = dst.trim_end_matches('/').to_string();
        let b64 = base64_encode(&tar_bytes);
        let cmd = format!(
            "mkdir -p {dst_quoted} && printf %s {payload} | base64 -d | tar xz -C {dst_quoted}",
            dst_quoted = shell_escape(&dst_root),
            payload = shell_escape(&b64),
        );
        let result = self
            .exec(ExecRequest::new(format!("bash -lc {}", shell_escape(&cmd))))
            .await?;
        if result.return_code != 0 {
            return Err(SandboxError::FileTransfer(format!(
                "DaytonaSandbox::upload_dir: rc={} stdout={}",
                result.return_code, result.stdout
            )));
        }
        Ok(())
    }

    async fn download_file(&self, src: &str, dst: &Path) -> SandboxResult<()> {
        // Read via exec: `base64 -w0 < $src` returns the file contents
        // base64-encoded in stdout. Decode locally.
        let cmd = format!("base64 -w0 < {src_q}", src_q = shell_escape(src));
        let result = self
            .exec(ExecRequest::new(format!("bash -lc {}", shell_escape(&cmd))))
            .await?;
        if result.return_code != 0 {
            return Err(SandboxError::FileTransfer(format!(
                "DaytonaSandbox::download_file({src}): rc={} output={}",
                result.return_code, result.stdout
            )));
        }
        let bytes = base64_decode(result.stdout.trim()).map_err(|e| {
            SandboxError::FileTransfer(format!(
                "DaytonaSandbox::download_file({src}): bad base64: {e}"
            ))
        })?;
        if let Some(parent) = dst.parent() {
            tokio::fs::create_dir_all(parent).await.map_err(|e| {
                SandboxError::FileTransfer(format!(
                    "DaytonaSandbox::download_file create_dir_all: {e}"
                ))
            })?;
        }
        tokio::fs::write(dst, bytes).await.map_err(|e| {
            SandboxError::FileTransfer(format!(
                "DaytonaSandbox::download_file write({}): {e}",
                dst.display()
            ))
        })
    }

    async fn download_dir(&self, src: &str, dst: &Path) -> SandboxResult<()> {
        // Tar in the sandbox, base64 over the wire, decode + extract
        // locally. Single exec, single download.
        let cmd = format!(
            "tar cz -C {src_q} . | base64 -w0",
            src_q = shell_escape(src)
        );
        let result = self
            .exec(ExecRequest::new(format!("bash -lc {}", shell_escape(&cmd))))
            .await?;
        if result.return_code != 0 {
            return Err(SandboxError::FileTransfer(format!(
                "DaytonaSandbox::download_dir({src}): rc={} output={}",
                result.return_code, result.stdout
            )));
        }
        let tar_bytes = base64_decode(result.stdout.trim()).map_err(|e| {
            SandboxError::FileTransfer(format!(
                "DaytonaSandbox::download_dir({src}): bad base64: {e}"
            ))
        })?;
        tokio::fs::create_dir_all(dst).await.map_err(|e| {
            SandboxError::FileTransfer(format!(
                "DaytonaSandbox::download_dir create_dir_all: {e}"
            ))
        })?;
        gz_extract_to(&tar_bytes, dst).map_err(|e| {
            SandboxError::FileTransfer(format!(
                "DaytonaSandbox::download_dir extract: {e}"
            ))
        })
    }

    async fn is_dir(&self, path: &str) -> SandboxResult<bool> {
        let sandbox_id = self.require_id()?;
        let info: SandboxResult<FileInfoResponse> = self
            .client
            .json_in_json_out::<(), _>(
                Method::GET,
                &format!(
                    "/toolbox/{sandbox_id}/toolbox/files/info?path={}",
                    urlencoding(path)
                ),
                None,
            )
            .await;
        match info {
            Ok(info) => Ok(info.is_dir),
            // Fall back to `test -d` if the info endpoint isn't
            // available (older Daytona versions).
            Err(SandboxError::Configuration(_)) => {
                let exec_result = self
                    .exec(ExecRequest::new(format!("test -d {}", shell_escape(path))))
                    .await?;
                Ok(exec_result.return_code == 0)
            }
            Err(e) => Err(e),
        }
    }

    async fn is_file(&self, path: &str) -> SandboxResult<bool> {
        let sandbox_id = self.require_id()?;
        let info: SandboxResult<FileInfoResponse> = self
            .client
            .json_in_json_out::<(), _>(
                Method::GET,
                &format!(
                    "/toolbox/{sandbox_id}/toolbox/files/info?path={}",
                    urlencoding(path)
                ),
                None,
            )
            .await;
        match info {
            Ok(info) => Ok(!info.is_dir),
            Err(SandboxError::Configuration(_)) => {
                let exec_result = self
                    .exec(ExecRequest::new(format!("test -f {}", shell_escape(path))))
                    .await?;
                Ok(exec_result.return_code == 0)
            }
            Err(e) => Err(e),
        }
    }
}

/// Compose `cwd`, `env`, `user` into a bash one-liner. Daytona's exec
/// endpoint accepts a single command string; we wrap with `bash -lc` so
/// `.bashrc` is sourced (matches Harbor's pattern for installed-agent
/// CLIs that expect login-shell PATH).
/// Compose `cwd` + `env` + `command` into a `bash -lc` invocation.
///
/// Env vars are emitted as `export K=V` so they're inherited by
/// nested shells (the agent script uses its own `bash -lc` wrapper,
/// and a plain `K=V && bash …` only sets shell locals — they don't
/// reach the child).
///
/// User switching is intentionally NOT done here. Daytona sandboxes
/// run as a non-root user (`daytona`) and `su` requires shadow-file
/// configuration that isn't always present. Callers that genuinely
/// need to drop privileges should `useradd` + `su -c` themselves
/// inside their script — that's recipe / agent-script territory,
/// not a transport concern.
fn compose_command(req: &ExecRequest) -> String {
    let mut parts = Vec::<String>::new();
    if let Some(cwd) = &req.cwd {
        parts.push(format!("cd {}", shell_escape(cwd)));
    }
    for (k, v) in &req.env {
        parts.push(format!("export {k}={}", shell_escape(v)));
    }
    parts.push(req.command.clone());

    let inner = parts.join(" && ");
    format!("bash -lc {}", shell_escape(&inner))
}

impl DaytonaSandbox {
    /// Write a small file inline via exec. The bytes are base64-
    /// encoded into a single shell command, decoded by the sandbox's
    /// `base64 -d`, and redirected to the target path. Single exec
    /// per file.
    async fn write_bytes_via_exec(&self, dst: &str, bytes: &[u8]) -> SandboxResult<()> {
        let b64 = base64_encode(bytes);
        // Drop the file via `printf %s '<base64>' | base64 -d > dst`.
        // `printf %s` (vs `echo`) avoids any escape interpretation of
        // the payload.
        let cmd = format!(
            "mkdir -p $(dirname {dst_q}) && printf %s {payload} | base64 -d > {dst_q}",
            dst_q = shell_escape(dst),
            payload = shell_escape(&b64),
        );
        let result = self
            .exec(ExecRequest::new(format!("bash -lc {}", shell_escape(&cmd))))
            .await?;
        if result.return_code != 0 {
            return Err(SandboxError::FileTransfer(format!(
                "DaytonaSandbox::write_bytes_via_exec({dst}): rc={} stdout={}",
                result.return_code, result.stdout
            )));
        }
        Ok(())
    }
}

/// Base64-encode (no newlines, standard alphabet).
fn base64_encode(bytes: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

fn base64_decode(s: &str) -> Result<Vec<u8>, base64::DecodeError> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.decode(s.trim())
}

/// Tar+gzip a local directory tree into an in-memory blob.
fn tar_dir_to_gz(src: &Path) -> std::io::Result<Vec<u8>> {
    let buf: Vec<u8> = Vec::new();
    let gz = flate2::write::GzEncoder::new(buf, flate2::Compression::default());
    let mut tar_builder = tar::Builder::new(gz);
    tar_builder.append_dir_all(".", src)?;
    let gz = tar_builder.into_inner()?;
    gz.finish()
}

/// Decompress + extract an in-memory tar.gz blob into the given dir.
fn gz_extract_to(bytes: &[u8], dst: &Path) -> std::io::Result<()> {
    let gz = flate2::read::GzDecoder::new(bytes);
    let mut archive = tar::Archive::new(gz);
    archive.unpack(dst)
}

/// Single-quote-escape for POSIX shell. Mirrored from `traits.rs`'s
/// helper; duplicated to keep `traits.rs` zero-dependency.
fn shell_escape(s: &str) -> String {
    if s.is_empty() {
        return "''".to_string();
    }
    if s.chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '/' | '.' | ':' | '='))
    {
        return s.to_string();
    }
    let escaped = s.replace('\'', "'\\''");
    format!("'{escaped}'")
}

/// Minimal URL-component encoder. Daytona's API accepts paths via query
/// string, so we have to escape the few characters that survive raw.
fn urlencoding(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '0'..='9' | 'A'..='Z' | 'a'..='z' | '-' | '_' | '.' | '~' | '/' => out.push(ch),
            ' ' => out.push_str("%20"),
            other => {
                let mut buf = [0u8; 4];
                for byte in other.encode_utf8(&mut buf).as_bytes() {
                    out.push_str(&format!("%{byte:02X}"));
                }
            }
        }
    }
    out
}

fn walk_files(root: &Path) -> std::io::Result<Vec<std::path::PathBuf>> {
    let mut out = Vec::new();
    if !root.is_dir() {
        if root.is_file() {
            out.push(root.to_path_buf());
        }
        return Ok(out);
    }
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        for entry in std::fs::read_dir(&dir)? {
            let entry = entry?;
            let p = entry.path();
            if p.is_dir() {
                stack.push(p);
            } else if p.is_file() {
                out.push(p);
            }
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn opts_for(image: &str) -> StartOpts {
        StartOpts {
            session_id: "test_session".to_string(),
            image: ImageSource::PrebuiltImage(image.to_string()),
            ..Default::default()
        }
    }

    #[test]
    fn build_create_request_image_mode_passes_image_and_labels() {
        // Phase 5 simplification: image-mode sends only the image +
        // labels + env, letting Daytona pick default resources. This
        // sidesteps the "Cannot specify resources" 400 the API
        // returns when the request shape is even slightly wrong.
        // Resources will come back in a follow-up once we know the
        // exact knobs Daytona accepts alongside `image`.
        let cfg = DaytonaConfig {
            api_key: Some("dt_test".to_string()),
            ..Default::default()
        };
        let driver = DaytonaSandbox::new(cfg).unwrap();
        let opts = opts_for("alpine:3.19");
        let req = driver.build_create_request(&opts).unwrap();
        assert_eq!(req.image.as_deref(), Some("alpine:3.19"));
        assert!(req.cpu.is_none());
        assert!(req.memory.is_none());
        assert!(req.disk.is_none());
        // Session id stamped onto labels for dashboard correlation.
        assert_eq!(
            req.labels.get("chronicle.session_id").map(String::as_str),
            Some("test_session")
        );
    }

    #[test]
    fn build_create_request_for_default_snapshot_omits_resources() {
        let cfg = DaytonaConfig {
            api_key: Some("dt_test".to_string()),
            ..Default::default()
        };
        let driver = DaytonaSandbox::new(cfg).unwrap();
        let mut opts = opts_for("ignored");
        // Force snapshot/default-snapshot mode by setting image=None.
        opts.image = ImageSource::None;
        let req = driver.build_create_request(&opts).unwrap();
        assert!(req.image.is_none());
        assert!(req.snapshot.is_none());
        assert!(req.cpu.is_none());
        assert!(req.memory.is_none());
        assert!(req.disk.is_none());
    }

    #[test]
    fn build_create_request_rejects_dockerfile_image_for_now() {
        let cfg = DaytonaConfig {
            api_key: Some("dt_test".to_string()),
            ..Default::default()
        };
        let driver = DaytonaSandbox::new(cfg).unwrap();
        let opts = StartOpts {
            session_id: "x".to_string(),
            image: ImageSource::Dockerfile {
                dockerfile_path: "Dockerfile".into(),
                context_dir: None,
            },
            ..Default::default()
        };
        let err = driver.build_create_request(&opts).unwrap_err();
        assert!(matches!(err.kind(), crate::error::SandboxErrorKind::Unsupported));
    }

    #[test]
    fn build_create_request_preserves_user_labels() {
        let cfg = DaytonaConfig {
            api_key: Some("dt_test".to_string()),
            ..Default::default()
        };
        let driver = DaytonaSandbox::new(cfg).unwrap();
        let mut opts = opts_for("alpine:3.19");
        opts.allow_internet = false;
        opts.labels.insert("tenant_id".to_string(), "t1".to_string());
        let req = driver.build_create_request(&opts).unwrap();
        assert_eq!(req.labels.get("tenant_id").map(String::as_str), Some("t1"));
    }

    #[test]
    fn compose_command_includes_cwd_and_env_but_skips_user_wrapping() {
        let mut env = HashMap::new();
        env.insert("FOO".to_string(), "bar".to_string());
        let req = ExecRequest {
            command: "echo $FOO".to_string(),
            cwd: Some("/work".to_string()),
            env,
            // user= is recorded for observability but doesn't affect
            // the composed command — see compose_command's docstring.
            user: Some("root".to_string()),
            timeout: None,
        };
        let composed = compose_command(&req);
        assert!(composed.starts_with("bash -lc"));
        assert!(composed.contains("cd /work"));
        assert!(composed.contains("FOO=bar"));
        assert!(composed.contains("echo $FOO"));
        assert!(!composed.contains("su "), "compose should not emit `su` wrapping");
    }

    #[test]
    fn url_encodes_spaces_and_unicode() {
        assert_eq!(urlencoding("/tmp/file"), "/tmp/file");
        assert_eq!(urlencoding("with spaces"), "with%20spaces");
        assert_eq!(urlencoding("café"), "caf%C3%A9");
    }
}
