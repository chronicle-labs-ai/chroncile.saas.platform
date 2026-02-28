//! Health Check Endpoint

use axum::Json;
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub git_sha: Option<String>,
    pub git_tag: Option<String>,
    pub environment: Option<String>,
}

fn non_empty_env(key: &str) -> Option<String> {
    std::env::var(key).ok().filter(|v| !v.is_empty())
}

pub async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        git_sha: non_empty_env("GIT_SHA"),
        git_tag: non_empty_env("GIT_TAG"),
        environment: non_empty_env("ENVIRONMENT"),
    })
}
