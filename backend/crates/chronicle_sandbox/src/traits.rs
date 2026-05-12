//! The `Sandbox` trait — the only seam between the Chronicle
//! orchestrator and any container/microVM runtime.
//!
//! Modeled after Harbor's `BaseEnvironment`, recast in idiomatic
//! async-trait Rust. Drivers ship as concrete types implementing this
//! trait; the orchestrator dispatches dynamically via
//! `Box<dyn Sandbox>` (see `factory::build`).

use crate::capabilities::SandboxCapabilities;
use crate::error::SandboxResult;
use crate::types::{ExecRequest, ExecResult, SandboxId, StartOpts};
use async_trait::async_trait;
use std::path::Path;

/// The narrow contract every sandbox driver implements.
///
/// Lifecycle:
/// 1. Construct via `factory::build(driver, config)` — pure, no I/O.
/// 2. `start(opts)` provisions the sandbox; returns its driver-issued
///    id. Idempotent on the *same instance* — calling start() twice
///    returns an error from the second call.
/// 3. `exec` / `upload_*` / `download_*` are issued against the live
///    sandbox.
/// 4. `stop(delete=true)` tears down. Implementations MUST be safe to
///    call from a cancellation path; the orchestrator wraps cleanup
///    in `tokio::spawn` (Rust analog of Harbor's `asyncio.shield`).
#[async_trait]
pub trait Sandbox: Send + Sync {
    /// Static capabilities this driver supports. Read once at
    /// orchestrator preflight; never changes for the lifetime of an
    /// instance.
    fn capabilities(&self) -> SandboxCapabilities;

    /// Driver name for logs and `BacktestJob.sandboxDriver`. Match
    /// `chronicle_domain::SandboxDriver::as_str()`: `"docker"`,
    /// `"daytona"`, `"mock"`.
    fn driver(&self) -> &'static str;

    /// The driver-issued id, available after `start()` has succeeded.
    /// Returns `None` before start or after stop.
    fn id(&self) -> Option<&SandboxId>;

    /// Provision the sandbox.
    async fn start(&mut self, opts: StartOpts) -> SandboxResult<SandboxId>;

    /// Tear down the sandbox.
    ///
    /// `delete=true` removes provider-side resources. `delete=false`
    /// keeps them (useful for post-mortem debugging — the CLI will
    /// expose this via `--no-delete`).
    async fn stop(&mut self, delete: bool) -> SandboxResult<()>;

    /// Run a command inside the sandbox.
    ///
    /// A non-zero `ExecResult.return_code` is NOT an error — it's
    /// signaled on the result. Errors are reserved for driver-level
    /// failures (timeout exceeded, sandbox dead, network).
    async fn exec(&self, req: ExecRequest) -> SandboxResult<ExecResult>;

    /// Upload a single file from the host into the sandbox.
    async fn upload_file(&self, src: &Path, dst: &str) -> SandboxResult<()>;

    /// Upload a directory tree (recursive) from the host into the sandbox.
    /// `dst` becomes the parent of the directory's contents.
    async fn upload_dir(&self, src: &Path, dst: &str) -> SandboxResult<()>;

    /// Download a single file from the sandbox to the host.
    async fn download_file(&self, src: &str, dst: &Path) -> SandboxResult<()>;

    /// Download a directory tree (recursive) from the sandbox to the host.
    async fn download_dir(&self, src: &str, dst: &Path) -> SandboxResult<()>;

    /// Check if the remote path is a directory. Default impl runs
    /// `test -d` via `exec`; drivers MAY override with a native API
    /// call (e.g. Daytona's `fs.get_file_info`).
    async fn is_dir(&self, path: &str) -> SandboxResult<bool> {
        let result = self
            .exec(ExecRequest::new(format!(
                "test -d {}",
                shell_escape(path)
            )))
            .await?;
        Ok(result.return_code == 0)
    }

    /// Check if the remote path is a regular file. See `is_dir`.
    async fn is_file(&self, path: &str) -> SandboxResult<bool> {
        let result = self
            .exec(ExecRequest::new(format!(
                "test -f {}",
                shell_escape(path)
            )))
            .await?;
        Ok(result.return_code == 0)
    }
}

/// Single-quote-escape for a POSIX shell.
/// Used by the default `is_dir` / `is_file` impls.
fn shell_escape(s: &str) -> String {
    if s.is_empty() {
        return "''".to_string();
    }
    if s.chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '/' | '.' | ':'))
    {
        return s.to_string();
    }
    let escaped = s.replace('\'', "'\\''");
    format!("'{escaped}'")
}

#[cfg(test)]
mod tests {
    use super::shell_escape;

    #[test]
    fn safe_paths_pass_through() {
        assert_eq!(shell_escape("/tmp/test"), "/tmp/test");
        assert_eq!(shell_escape("foo.txt"), "foo.txt");
        assert_eq!(shell_escape("a-b_c"), "a-b_c");
    }

    #[test]
    fn unsafe_paths_get_quoted() {
        assert_eq!(shell_escape("hello world"), "'hello world'");
        assert_eq!(shell_escape(""), "''");
        assert_eq!(shell_escape("foo;rm -rf /"), "'foo;rm -rf /'");
        // Embedded single-quote: closes, escapes, reopens.
        assert_eq!(shell_escape("can't"), "'can'\\''t'");
    }
}
