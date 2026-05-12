//! In-process mock driver. Records every interaction and returns
//! programmable canned responses. Used by:
//!
//! * Unit tests (sandbox-dependent code paths get to skip Docker).
//! * The `chronicle` CLI's `--driver mock` smoke commands.
//! * The orchestrator's pure-logic test fixtures.
//!
//! Design notes:
//!
//! * Filesystem is in-memory (`HashMap<String, Vec<u8>>` for files,
//!   `HashSet<String>` for declared directories). Path semantics mirror
//!   POSIX — `/foo/bar` and `/foo/bar/` are the same file; directories
//!   are tracked separately so `is_dir` can be honest.
//! * The exec handler is a closure callers can swap to drive
//!   command-specific behavior. Default behavior: every command
//!   succeeds with empty stdout/stderr.

use crate::capabilities::SandboxCapabilities;
use crate::error::{SandboxError, SandboxResult};
use crate::traits::Sandbox;
use crate::types::{ExecRequest, ExecResult, SandboxId, StartOpts};
use async_trait::async_trait;
use parking_lot::Mutex;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Arc;

/// Test-only stub of one execution: matches a command prefix and
/// returns the canned `ExecResult`.
pub struct ExecStub {
    pub command_prefix: String,
    pub result: ExecResult,
}

type ExecHandler = Arc<dyn Fn(&ExecRequest) -> ExecResult + Send + Sync>;

#[derive(Default)]
struct MockState {
    /// `Some(id)` after `start()`; `None` before / after `stop(delete=true)`.
    id: Option<SandboxId>,

    /// Last `StartOpts`. Useful for tests asserting "did the
    /// orchestrator pass the right resources/labels".
    last_start_opts: Option<StartOpts>,

    /// Recorded exec calls in order. Tests use this to assert
    /// "the orchestrator ran X then Y".
    exec_calls: Vec<ExecRequest>,

    /// In-memory filesystem.
    files: HashMap<String, Vec<u8>>,

    /// Directories that have been declared (via `upload_dir` or
    /// `mkdir`-via-exec). `is_dir` checks this set first, then falls
    /// back to "is `path/` a file-key prefix".
    dirs: HashSet<String>,
}

#[derive(Clone)]
pub struct MockSandbox {
    state: Arc<Mutex<MockState>>,
    /// User-overridable exec dispatcher. Default returns
    /// `ExecResult { return_code: 0, … }`.
    exec_handler: ExecHandler,
}

impl Default for MockSandbox {
    fn default() -> Self {
        Self::new()
    }
}

impl MockSandbox {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(MockState::default())),
            exec_handler: Arc::new(|_req: &ExecRequest| ExecResult::ok("")),
        }
    }

    /// Replace the default exec handler.
    ///
    /// ```ignore
    /// let sb = MockSandbox::new().with_exec_handler(|req| {
    ///     if req.command.starts_with("echo ") {
    ///         ExecResult::ok(req.command.trim_start_matches("echo "))
    ///     } else {
    ///         ExecResult::ok("")
    ///     }
    /// });
    /// ```
    pub fn with_exec_handler<F>(mut self, handler: F) -> Self
    where
        F: Fn(&ExecRequest) -> ExecResult + Send + Sync + 'static,
    {
        self.exec_handler = Arc::new(handler);
        self
    }

    /// Convenience: install a handler driven by an ordered list of
    /// stubs. The first stub whose `command_prefix` matches wins.
    pub fn with_stubs(self, stubs: Vec<ExecStub>) -> Self {
        let stubs = Arc::new(stubs);
        self.with_exec_handler(move |req| {
            for stub in stubs.iter() {
                if req.command.starts_with(&stub.command_prefix) {
                    return stub.result.clone();
                }
            }
            ExecResult::ok("")
        })
    }

    /// Snapshot of every `exec` request received. Cheap clone — used
    /// by tests for assertions.
    pub fn exec_calls(&self) -> Vec<ExecRequest> {
        self.state.lock().exec_calls.clone()
    }

    /// Last `StartOpts` passed to `start()`. None before start.
    pub fn last_start_opts(&self) -> Option<StartOpts> {
        self.state.lock().last_start_opts.clone()
    }

    /// Read a file from the in-memory FS. Tests use this to verify
    /// the verifier produced the right `reward.json`.
    pub fn read_file(&self, path: &str) -> Option<Vec<u8>> {
        self.state.lock().files.get(path).cloned()
    }

    /// Inject a file into the in-memory FS without going through
    /// `upload_file`. Useful for seeding tests.
    pub fn put_file(&self, path: impl Into<String>, contents: impl Into<Vec<u8>>) {
        self.state.lock().files.insert(path.into(), contents.into());
    }

    fn ensure_started(&self) -> SandboxResult<()> {
        if self.state.lock().id.is_none() {
            return Err(SandboxError::Internal(
                "MockSandbox: operation called before start()".to_string(),
            ));
        }
        Ok(())
    }

    fn record_dir(state: &mut MockState, dir: &str) {
        let normalized = normalize_path(dir);
        if !normalized.is_empty() {
            state.dirs.insert(normalized);
        }
    }
}

#[async_trait]
impl Sandbox for MockSandbox {
    fn capabilities(&self) -> SandboxCapabilities {
        SandboxCapabilities {
            // Mock supports everything from the orchestrator's POV; it's
            // up to test assertions to check what actually happened.
            gpus: true,
            disable_internet: true,
            windows: true,
            mounted: false,
            attach: false,
        }
    }

    fn driver(&self) -> &'static str {
        "mock"
    }

    fn id(&self) -> Option<&SandboxId> {
        // Locking and returning a borrow doesn't compose with Arc<Mutex<_>>
        // here — callers that need the id should `Sandbox::start`'s
        // return value or `MockSandbox::current_id()`.
        None
    }

    async fn start(&mut self, opts: StartOpts) -> SandboxResult<SandboxId> {
        let mut state = self.state.lock();
        if state.id.is_some() {
            return Err(SandboxError::Internal(
                "MockSandbox: start() called twice".to_string(),
            ));
        }
        let id = SandboxId::new(format!("mock_{}", ulid::Ulid::new()));
        state.id = Some(id.clone());
        state.last_start_opts = Some(opts);
        Ok(id)
    }

    async fn stop(&mut self, delete: bool) -> SandboxResult<()> {
        let mut state = self.state.lock();
        if delete {
            state.id = None;
            state.files.clear();
            state.dirs.clear();
        }
        Ok(())
    }

    async fn exec(&self, req: ExecRequest) -> SandboxResult<ExecResult> {
        self.ensure_started()?;
        let result = (self.exec_handler)(&req);
        self.state.lock().exec_calls.push(req);
        Ok(result)
    }

    async fn upload_file(&self, src: &Path, dst: &str) -> SandboxResult<()> {
        self.ensure_started()?;
        let contents = std::fs::read(src).map_err(|e| {
            SandboxError::FileTransfer(format!(
                "MockSandbox::upload_file({}): {e}",
                src.display()
            ))
        })?;
        let mut state = self.state.lock();
        state.files.insert(normalize_path(dst), contents);
        if let Some(parent) = Path::new(dst).parent() {
            Self::record_dir(&mut state, &parent.to_string_lossy());
        }
        Ok(())
    }

    async fn upload_dir(&self, src: &Path, dst: &str) -> SandboxResult<()> {
        self.ensure_started()?;
        let mut state = self.state.lock();
        Self::record_dir(&mut state, dst);
        // Walk src; each file becomes a `dst/relative_path` entry.
        for entry in walk_files(src).map_err(|e| {
            SandboxError::FileTransfer(format!(
                "MockSandbox::upload_dir({}): {e}",
                src.display()
            ))
        })? {
            let rel = entry
                .strip_prefix(src)
                .map_err(|e| {
                    SandboxError::FileTransfer(format!("MockSandbox::upload_dir strip: {e}"))
                })?
                .to_string_lossy()
                .replace('\\', "/");
            let target = format!("{}/{rel}", dst.trim_end_matches('/'));
            let contents = std::fs::read(&entry).map_err(|e| {
                SandboxError::FileTransfer(format!(
                    "MockSandbox::upload_dir read({}): {e}",
                    entry.display()
                ))
            })?;
            state.files.insert(normalize_path(&target), contents);
        }
        Ok(())
    }

    async fn download_file(&self, src: &str, dst: &Path) -> SandboxResult<()> {
        self.ensure_started()?;
        let contents = self
            .state
            .lock()
            .files
            .get(&normalize_path(src))
            .cloned()
            .ok_or_else(|| {
                SandboxError::FileTransfer(format!(
                    "MockSandbox::download_file: not found: {src}"
                ))
            })?;
        if let Some(parent) = dst.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                SandboxError::FileTransfer(format!(
                    "MockSandbox::download_file create_dir_all: {e}"
                ))
            })?;
        }
        std::fs::write(dst, contents).map_err(|e| {
            SandboxError::FileTransfer(format!(
                "MockSandbox::download_file write({}): {e}",
                dst.display()
            ))
        })
    }

    async fn download_dir(&self, src: &str, dst: &Path) -> SandboxResult<()> {
        self.ensure_started()?;
        let prefix = format!("{}/", normalize_path(src).trim_end_matches('/'));
        let entries: Vec<(String, Vec<u8>)> = self
            .state
            .lock()
            .files
            .iter()
            .filter(|(path, _)| path.starts_with(&prefix))
            .map(|(path, contents)| (path.clone(), contents.clone()))
            .collect();
        for (path, contents) in entries {
            let rel = path.trim_start_matches(&prefix);
            let target = dst.join(rel);
            if let Some(parent) = target.parent() {
                std::fs::create_dir_all(parent).map_err(|e| {
                    SandboxError::FileTransfer(format!(
                        "MockSandbox::download_dir create_dir_all: {e}"
                    ))
                })?;
            }
            std::fs::write(&target, &contents).map_err(|e| {
                SandboxError::FileTransfer(format!(
                    "MockSandbox::download_dir write({}): {e}",
                    target.display()
                ))
            })?;
        }
        Ok(())
    }

    async fn is_dir(&self, path: &str) -> SandboxResult<bool> {
        self.ensure_started()?;
        let normalized = normalize_path(path);
        let state = self.state.lock();
        if state.dirs.contains(&normalized) {
            return Ok(true);
        }
        // Fallback: treat path as directory if it's a prefix of any
        // file key. Matches the "implicit" dir case after upload_dir.
        let prefix = format!("{normalized}/");
        Ok(state.files.keys().any(|k| k.starts_with(&prefix)))
    }

    async fn is_file(&self, path: &str) -> SandboxResult<bool> {
        self.ensure_started()?;
        Ok(self.state.lock().files.contains_key(&normalize_path(path)))
    }
}

/// Strip trailing slash + collapse duplicate slashes.
fn normalize_path(p: &str) -> String {
    let trimmed = p.trim_end_matches('/');
    let mut out = String::with_capacity(trimmed.len());
    let mut prev_slash = false;
    for ch in trimmed.chars() {
        if ch == '/' {
            if prev_slash {
                continue;
            }
            prev_slash = true;
        } else {
            prev_slash = false;
        }
        out.push(ch);
    }
    out
}

/// Recursive file walker. Returns absolute paths only (no dir entries).
fn walk_files(root: &Path) -> std::io::Result<Vec<PathBuf>> {
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
    use std::time::Duration;

    fn opts() -> StartOpts {
        StartOpts {
            session_id: "test_job__test_trial".to_string(),
            ..Default::default()
        }
    }

    #[tokio::test]
    async fn start_returns_unique_id_and_records_opts() {
        let mut sb = MockSandbox::new();
        let id1 = sb.start(opts()).await.unwrap();
        assert!(id1.as_str().starts_with("mock_"));
        assert_eq!(sb.last_start_opts().unwrap().session_id, "test_job__test_trial");

        // Calling start twice on the same instance fails.
        let err = sb.start(opts()).await.unwrap_err();
        assert!(err.to_string().contains("twice"));
    }

    #[tokio::test]
    async fn exec_records_calls_and_runs_default_handler() {
        let mut sb = MockSandbox::new();
        sb.start(opts()).await.unwrap();
        let r = sb.exec(ExecRequest::new("echo hi")).await.unwrap();
        assert_eq!(r.return_code, 0);
        assert_eq!(sb.exec_calls().len(), 1);
        assert_eq!(sb.exec_calls()[0].command, "echo hi");
    }

    #[tokio::test]
    async fn stub_handler_drives_per_command_responses() {
        let mut sb = MockSandbox::new().with_stubs(vec![
            ExecStub {
                command_prefix: "test -d".to_string(),
                result: ExecResult::failed(1, ""),
            },
            ExecStub {
                command_prefix: "echo".to_string(),
                result: ExecResult::ok("ok"),
            },
        ]);
        sb.start(opts()).await.unwrap();
        let r = sb.exec(ExecRequest::new("echo hello")).await.unwrap();
        assert_eq!(r.stdout, "ok");
        let r = sb.exec(ExecRequest::new("test -d /nope")).await.unwrap();
        assert_eq!(r.return_code, 1);
    }

    #[tokio::test]
    async fn exec_before_start_errors() {
        let sb = MockSandbox::new();
        let err = sb.exec(ExecRequest::new("noop")).await.unwrap_err();
        assert!(err.to_string().contains("before start"));
    }

    #[tokio::test]
    async fn upload_then_download_round_trip() {
        let tmp = tempdir().unwrap();
        let src = tmp.path().join("payload.txt");
        std::fs::write(&src, b"hello world").unwrap();

        let mut sb = MockSandbox::new();
        sb.start(opts()).await.unwrap();
        sb.upload_file(&src, "/work/payload.txt").await.unwrap();

        let dl = tmp.path().join("dl.txt");
        sb.download_file("/work/payload.txt", &dl).await.unwrap();
        assert_eq!(std::fs::read(&dl).unwrap(), b"hello world");
    }

    #[tokio::test]
    async fn upload_dir_preserves_tree() {
        let tmp = tempdir().unwrap();
        let src = tmp.path().join("src");
        std::fs::create_dir_all(src.join("nested")).unwrap();
        std::fs::write(src.join("a.txt"), b"A").unwrap();
        std::fs::write(src.join("nested").join("b.txt"), b"B").unwrap();

        let mut sb = MockSandbox::new();
        sb.start(opts()).await.unwrap();
        sb.upload_dir(&src, "/work/files").await.unwrap();

        assert_eq!(sb.read_file("/work/files/a.txt").unwrap(), b"A");
        assert_eq!(sb.read_file("/work/files/nested/b.txt").unwrap(), b"B");
        assert!(sb.is_dir("/work/files").await.unwrap());
        assert!(sb.is_dir("/work/files/nested").await.unwrap());
        assert!(sb.is_file("/work/files/a.txt").await.unwrap());
        assert!(!sb.is_file("/work/files").await.unwrap());
    }

    #[tokio::test]
    async fn download_dir_writes_relative_tree() {
        let tmp = tempdir().unwrap();
        let mut sb = MockSandbox::new();
        sb.start(opts()).await.unwrap();
        sb.put_file("/logs/agent/run.log", b"AGENT".to_vec());
        sb.put_file("/logs/agent/sub/extra.txt", b"EXTRA".to_vec());
        // Sibling file not under /logs/agent must be excluded.
        sb.put_file("/logs/verifier/reward.txt", b"1".to_vec());

        let dl = tmp.path().join("dl");
        sb.download_dir("/logs/agent", &dl).await.unwrap();

        assert_eq!(std::fs::read(dl.join("run.log")).unwrap(), b"AGENT");
        assert_eq!(
            std::fs::read(dl.join("sub").join("extra.txt")).unwrap(),
            b"EXTRA"
        );
        // Sibling not pulled in.
        assert!(!dl.join("..").join("verifier").join("reward.txt").exists());
    }

    #[tokio::test]
    async fn stop_with_delete_clears_state() {
        let mut sb = MockSandbox::new();
        sb.start(opts()).await.unwrap();
        sb.put_file("/foo", b"1".to_vec());
        sb.stop(true).await.unwrap();
        assert!(sb.read_file("/foo").is_none());
        // Re-start works after delete.
        sb.start(opts()).await.unwrap();
    }

    #[tokio::test]
    async fn stop_without_delete_keeps_state() {
        let mut sb = MockSandbox::new();
        sb.start(opts()).await.unwrap();
        sb.put_file("/foo", b"1".to_vec());
        sb.stop(false).await.unwrap();
        // State preserved.
        assert_eq!(sb.read_file("/foo").unwrap(), b"1");
    }

    #[tokio::test]
    async fn exec_with_options_round_trips() {
        let mut sb = MockSandbox::new();
        sb.start(opts()).await.unwrap();
        let req = ExecRequest::new("ls")
            .with_cwd("/work")
            .with_user("agent")
            .with_env("FOO", "bar")
            .with_timeout(Duration::from_secs(10));
        sb.exec(req.clone()).await.unwrap();
        let recorded = &sb.exec_calls()[0];
        assert_eq!(recorded.cwd.as_deref(), Some("/work"));
        assert_eq!(recorded.user.as_deref(), Some("agent"));
        assert_eq!(recorded.env.get("FOO").map(String::as_str), Some("bar"));
        assert_eq!(recorded.timeout, Some(Duration::from_secs(10)));
    }

    /// Tiny tempdir helper so the crate doesn't need `tempfile` as a
    /// dev-dep purely for these tests.
    fn tempdir() -> std::io::Result<TempDir> {
        let path = std::env::temp_dir().join(format!(
            "chronicle_sandbox_mock_{}",
            ulid::Ulid::new()
        ));
        std::fs::create_dir_all(&path)?;
        Ok(TempDir(path))
    }

    struct TempDir(PathBuf);
    impl TempDir {
        fn path(&self) -> &Path {
            &self.0
        }
    }
    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
}
