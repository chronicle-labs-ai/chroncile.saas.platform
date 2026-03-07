//! Health Check Endpoint

use axum::{extract::State, Json};
use serde::Serialize;

use crate::AppState;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub git_sha: Option<String>,
    pub git_tag: Option<String>,
    pub environment: Option<String>,
}

pub async fn health_check(State(state): State<AppState>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        git_sha: state.config.health.git_sha.clone(),
        git_tag: state.config.health.git_tag.clone(),
        environment: state.config.health.environment.clone(),
    })
}
