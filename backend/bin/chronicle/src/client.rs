//! Thin reqwest wrapper used by every command.
//!
//! Owns:
//!   * `Authorization: Bearer <token>` header injection.
//!   * Status-code → `CliError` mapping (401/403/404 special-cased so
//!     users see actionable messages instead of "HTTP 401").
//!   * SSE byte streaming via `bytes_stream()`.

use crate::config::Config;
use crate::error::{CliError, Result};
use reqwest::{Client, Method, RequestBuilder, Response, StatusCode};
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::time::Duration;

/// Default request timeout. SSE responses bypass this — see
/// `request_streaming`.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

/// SSE / long-poll connect timeout (vs total request timeout, which is
/// uncapped for streams).
const STREAM_CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Clone)]
pub struct ChronicleClient {
    inner: Client,
    streaming: Client,
    cfg: Config,
}

impl ChronicleClient {
    pub fn new(cfg: Config) -> Result<Self> {
        let inner = Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .user_agent(concat!("chronicle-cli/", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(|e| CliError::Internal(format!("reqwest::Client::build: {e}")))?;
        let streaming = Client::builder()
            .connect_timeout(STREAM_CONNECT_TIMEOUT)
            // No total timeout — SSE streams stay open until the
            // server closes them.
            .user_agent(concat!("chronicle-cli/", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(|e| CliError::Internal(format!("reqwest::Client::build (streaming): {e}")))?;
        Ok(Self {
            inner,
            streaming,
            cfg,
        })
    }

    pub fn config(&self) -> &Config {
        &self.cfg
    }

    fn request(&self, method: Method, path: &str, streaming: bool) -> RequestBuilder {
        let url = self.cfg.url(path);
        let client = if streaming { &self.streaming } else { &self.inner };
        let mut rb = client.request(method, url);
        if let Some(token) = self.cfg.auth_token.as_deref() {
            rb = rb.bearer_auth(token);
        }
        rb
    }

    /// JSON GET → typed response.
    pub async fn get_json<R: DeserializeOwned>(&self, path: &str) -> Result<R> {
        let resp = self.request(Method::GET, path, false).send().await?;
        json_or_error(resp).await
    }

    /// JSON POST with body.
    pub async fn post_json<B: Serialize, R: DeserializeOwned>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<R> {
        let resp = self
            .request(Method::POST, path, false)
            .json(body)
            .send()
            .await?;
        json_or_error(resp).await
    }

    /// POST with no response body (cancel, ack, etc.). Kept on the
    /// public API so future endpoints (`/jobs/:id/pause`,
    /// `/jobs/:id/resume`) don't have to re-implement it.
    #[allow(dead_code)]
    pub async fn post_no_body<B: Serialize>(&self, path: &str, body: Option<&B>) -> Result<()> {
        let mut rb = self.request(Method::POST, path, false);
        if let Some(b) = body {
            rb = rb.json(b);
        }
        let resp = rb.send().await?;
        ok_or_error(resp).await
    }

    /// SSE GET — returns the live response so the caller can stream.
    pub async fn sse_get(&self, path: &str) -> Result<Response> {
        let resp = self
            .request(Method::GET, path, true)
            .header("Accept", "text/event-stream")
            .send()
            .await?;
        let status = resp.status();
        if !status.is_success() {
            return Err(map_status(status, resp.text().await.unwrap_or_default()));
        }
        Ok(resp)
    }
}

async fn json_or_error<R: DeserializeOwned>(resp: Response) -> Result<R> {
    let status = resp.status();
    if !status.is_success() {
        return Err(map_status(status, resp.text().await.unwrap_or_default()));
    }
    resp.json::<R>().await.map_err(Into::into)
}

#[allow(dead_code)]
async fn ok_or_error(resp: Response) -> Result<()> {
    let status = resp.status();
    if !status.is_success() {
        return Err(map_status(status, resp.text().await.unwrap_or_default()));
    }
    Ok(())
}

fn map_status(status: StatusCode, body: String) -> CliError {
    match status.as_u16() {
        401 => CliError::Unauthenticated,
        403 => CliError::Forbidden(parse_body_error(&body, "forbidden")),
        404 => CliError::NotFound(parse_body_error(&body, "not found")),
        _ => CliError::Http {
            status: status.as_u16(),
            body: parse_body_error(&body, "request failed"),
        },
    }
}

/// Backend errors come back as `{"error": "msg"}`. Pull the message
/// out so users don't see raw JSON in their terminal.
fn parse_body_error(body: &str, fallback: &str) -> String {
    if body.is_empty() {
        return fallback.to_string();
    }
    serde_json::from_str::<serde_json::Value>(body)
        .ok()
        .and_then(|v| v.get("error").and_then(|e| e.as_str()).map(str::to_string))
        .unwrap_or_else(|| body.chars().take(512).collect())
}
