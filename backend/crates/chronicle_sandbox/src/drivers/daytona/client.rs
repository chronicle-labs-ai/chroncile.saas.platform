//! Thin reqwest wrapper for the Daytona REST API.
//!
//! Owns:
//!   * Auth header injection (Bearer + optional org id).
//!   * Status-code handling — translates 4xx → Configuration, 5xx +
//!     network errors → Transient.
//!   * Retry with jittered exponential backoff for transient failures
//!     (powered by `backon`).
//!
//! Doesn't own:
//!   * Endpoint URL paths (those live in `mod.rs::DaytonaSandbox` calls).
//!   * Wire-shape DTOs (those live in `types.rs`).

use crate::drivers::daytona::config::DaytonaConfig;
use crate::error::{SandboxError, SandboxResult};
use backon::{ExponentialBuilder, Retryable};
use reqwest::{Client, Method, RequestBuilder, Response, StatusCode, Url};
use serde::{de::DeserializeOwned, Serialize};
use std::time::Duration;

#[derive(Clone)]
pub struct DaytonaHttpClient {
    cfg: DaytonaConfig,
    inner: Client,
}

impl DaytonaHttpClient {
    pub fn new(cfg: DaytonaConfig) -> SandboxResult<Self> {
        let inner = Client::builder()
            .timeout(cfg.request_timeout)
            .user_agent(concat!("chronicle-sandbox/", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(|e| {
                SandboxError::Configuration(format!("daytona reqwest::Client::build: {e}"))
            })?;
        Ok(Self { cfg, inner })
    }

    pub fn cfg(&self) -> &DaytonaConfig {
        &self.cfg
    }

    /// Build a fully-formed `RequestBuilder` with auth headers attached.
    fn request(&self, method: Method, path: &str) -> SandboxResult<RequestBuilder> {
        let url = self
            .cfg
            .api_url
            .trim_end_matches('/')
            .to_string()
            + path;
        let url = Url::parse(&url).map_err(|e| {
            SandboxError::Configuration(format!("daytona invalid url '{url}': {e}"))
        })?;

        let api_key = self.cfg.api_key.as_deref().ok_or_else(|| {
            SandboxError::Configuration(
                "daytona request issued without DAYTONA_API_KEY (call preflight first)".to_string(),
            )
        })?;

        let mut rb = self
            .inner
            .request(method, url)
            .bearer_auth(api_key)
            .header("Content-Type", "application/json");
        if let Some(org) = self.cfg.organization_id.as_deref() {
            rb = rb.header("X-Daytona-Organization-ID", org);
        }
        Ok(rb)
    }

    /// JSON in / JSON out, with retry on transient errors.
    pub async fn json_in_json_out<Req, Resp>(
        &self,
        method: Method,
        path: &str,
        body: Option<&Req>,
    ) -> SandboxResult<Resp>
    where
        Req: Serialize + Sync,
        Resp: DeserializeOwned + Send,
    {
        let exec = || async {
            let body_json = body
                .map(|b| serde_json::to_string(b).unwrap_or_else(|_| "<unserializable>".into()));
            if let Some(j) = &body_json {
                tracing::debug!(?method, path, body = %j, "daytona request");
            } else {
                tracing::debug!(?method, path, "daytona request");
            }
            let mut rb = self.request(method.clone(), path)?;
            if let Some(b) = body {
                rb = rb.json(b);
            }
            let resp = rb.send().await.map_err(SandboxError::from)?;
            tracing::debug!(status = ?resp.status(), path, "daytona response");
            let resp = check_status(resp).await?;
            resp.json::<Resp>().await.map_err(SandboxError::from)
        };
        retry(exec).await
    }

    /// JSON in, no body out (DELETE / 204 endpoints).
    pub async fn json_in_no_body<Req>(
        &self,
        method: Method,
        path: &str,
        body: Option<&Req>,
    ) -> SandboxResult<()>
    where
        Req: Serialize + Sync,
    {
        let exec = || async {
            let mut rb = self.request(method.clone(), path)?;
            if let Some(b) = body {
                rb = rb.json(b);
            }
            let resp = rb.send().await.map_err(SandboxError::from)?;
            check_status(resp).await.map(|_| ())
        };
        retry(exec).await
    }

    /// Multipart upload. The Daytona endpoint takes `path` as a
    /// **query parameter** (not a multipart text field) and a single
    /// `file` part for the bytes. We append the query before sending
    /// so retries see the same URL.
    pub async fn upload_bytes(
        &self,
        path: &str,
        target_path: &str,
        bytes: Vec<u8>,
    ) -> SandboxResult<()> {
        let target_path = target_path.to_string();
        let bytes = bytes.clone();
        let exec = || async {
            let form = reqwest::multipart::Form::new().part(
                "file",
                reqwest::multipart::Part::bytes(bytes.clone()).file_name(
                    std::path::Path::new(&target_path)
                        .file_name()
                        .map(|s| s.to_string_lossy().into_owned())
                        .unwrap_or_else(|| "upload".to_string()),
                ),
            );
            let path_with_query = if path.contains('?') {
                format!("{path}&path={}", percent_encode(&target_path))
            } else {
                format!("{path}?path={}", percent_encode(&target_path))
            };
            tracing::debug!(method = ?Method::POST, path = %path_with_query, bytes = bytes.len(), "daytona multipart upload");
            let rb = self.request(Method::POST, &path_with_query)?;
            // reqwest's `multipart()` sets its own Content-Type with
            // the boundary; the default JSON header would clash, so
            // we let reqwest manage it.
            let resp = rb
                .multipart(form)
                .send()
                .await
                .map_err(SandboxError::from)?;
            check_status(resp).await.map(|_| ())
        };
        retry(exec).await
    }

    /// Download the response body as bytes (used for file download).
    pub async fn download_bytes(&self, path: &str) -> SandboxResult<Vec<u8>> {
        let exec = || async {
            let rb = self.request(Method::GET, path)?;
            let resp = rb.send().await.map_err(SandboxError::from)?;
            let resp = check_status(resp).await?;
            let bytes = resp.bytes().await.map_err(SandboxError::from)?;
            Ok(bytes.to_vec())
        };
        retry(exec).await
    }
}

/// Minimal percent-encoding for query string components. Mirrors the
/// helper in `mod.rs` so we don't have to thread it across modules.
fn percent_encode(s: &str) -> String {
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

/// Map an HTTP response to a SandboxError when the status isn't 2xx.
async fn check_status(resp: Response) -> SandboxResult<Response> {
    let status = resp.status();
    if status.is_success() {
        return Ok(resp);
    }
    // Capture the body for the error message — bounded to 4 KiB so a
    // chatty server doesn't blow up logs.
    let body = resp.text().await.unwrap_or_default();
    let snippet = body.chars().take(4096).collect::<String>();
    let msg = format!("HTTP {status}: {snippet}");
    Err(if status.is_server_error() || status == StatusCode::TOO_MANY_REQUESTS {
        SandboxError::Transient(msg)
    } else if status == StatusCode::UNAUTHORIZED || status == StatusCode::FORBIDDEN {
        SandboxError::Configuration(msg)
    } else if status == StatusCode::NOT_FOUND {
        SandboxError::Configuration(msg)
    } else {
        SandboxError::ExecFailed(msg)
    })
}

/// Retry helper. Only retries `SandboxError::Transient` — everything
/// else fails fast (Daytona's API errors are usually configuration
/// problems, not flakes).
async fn retry<T, Fut>(op: impl Fn() -> Fut + Send + Sync) -> SandboxResult<T>
where
    Fut: std::future::Future<Output = SandboxResult<T>> + Send,
    T: Send,
{
    let policy = ExponentialBuilder::default()
        .with_min_delay(Duration::from_millis(200))
        .with_max_delay(Duration::from_secs(5))
        .with_max_times(3)
        .with_jitter();
    op.retry(policy)
        .when(|e: &SandboxError| e.is_transient())
        .await
}
