//! Health Check Endpoints
//!
//! `/health` — liveness (process is up)
//! `/health/ready` — readiness (dependencies are reachable)

use std::collections::HashMap;
use std::time::Instant;

use axum::{extract::State, Json};
use serde::Serialize;

use crate::{AppState, SaasAppState};

// ---------------------------------------------------------------------------
// Liveness
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Readiness — deep dependency probes
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum OverallStatus {
    Healthy,
    Degraded,
    Unhealthy,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ServiceStatus {
    Up,
    Down,
    Unconfigured,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceHealth {
    pub status: ServiceStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeepHealthResponse {
    pub status: OverallStatus,
    pub version: String,
    pub git_sha: Option<String>,
    pub environment: Option<String>,
    pub services: HashMap<String, ServiceHealth>,
}

async fn timed_probe<F, E>(fut: F) -> ServiceHealth
where
    F: std::future::Future<Output = Result<(), E>>,
    E: std::fmt::Display,
{
    let start = Instant::now();
    match fut.await {
        Ok(()) => ServiceHealth {
            status: ServiceStatus::Up,
            latency_ms: Some(start.elapsed().as_millis() as u64),
            error: None,
        },
        Err(e) => ServiceHealth {
            status: ServiceStatus::Down,
            latency_ms: Some(start.elapsed().as_millis() as u64),
            error: Some(e.to_string()),
        },
    }
}

pub async fn deep_health_check(State(state): State<SaasAppState>) -> Json<DeepHealthResponse> {
    let store_probe = timed_probe(state.event_store.health_check());
    let stream_probe = timed_probe(state.event_stream.health_check());
    let email_probe = timed_probe(state.email.health_check());

    let nango_probe = async {
        match state.nango.as_ref() {
            Some(client) => timed_probe(client.health_check()).await,
            None => ServiceHealth {
                status: ServiceStatus::Unconfigured,
                latency_ms: None,
                error: None,
            },
        }
    };

    let (store, stream, email, nango) =
        tokio::join!(store_probe, stream_probe, email_probe, nango_probe);

    let mut services = HashMap::new();
    services.insert("eventStore".to_string(), store.clone());
    services.insert("eventStream".to_string(), stream.clone());
    services.insert("email".to_string(), email.clone());
    services.insert("nango".to_string(), nango.clone());

    let critical_down = store.status == ServiceStatus::Down;
    let any_configured_down = services.values().any(|s| s.status == ServiceStatus::Down);

    let overall = if critical_down {
        OverallStatus::Unhealthy
    } else if any_configured_down {
        OverallStatus::Degraded
    } else {
        OverallStatus::Healthy
    };

    Json(DeepHealthResponse {
        status: overall,
        version: env!("CARGO_PKG_VERSION").to_string(),
        git_sha: state.config.health.git_sha.clone(),
        environment: state.config.health.environment.clone(),
        services,
    })
}
