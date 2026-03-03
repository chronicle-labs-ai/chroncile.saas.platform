use axum::{extract::State, http::HeaderMap, Json};

use chronicle_auth::types::AuthUser;
use chronicle_domain::{DashboardActivityResponse, DashboardStatsResponse};

use super::error::{ApiError, ApiResult};
use crate::saas_state::SaasAppState;

pub async fn stats(
    user: AuthUser,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<DashboardStatsResponse>> {
    let total_runs = state.runs.count_by_tenant(&user.tenant_id).await?;
    let pending_runs = state
        .runs
        .count_by_status(&user.tenant_id, "pending")
        .await
        .unwrap_or(0);
    let completed_runs = state
        .runs
        .count_by_status(&user.tenant_id, "completed")
        .await
        .unwrap_or(0);
    let failed_runs = state
        .runs
        .count_by_status(&user.tenant_id, "failed")
        .await
        .unwrap_or(0);
    let connections = state.connections.list_by_tenant(&user.tenant_id).await?;

    Ok(Json(DashboardStatsResponse {
        total_runs,
        pending_runs,
        completed_runs,
        failed_runs,
        total_connections: connections.len(),
        active_connections: connections.iter().filter(|c| c.status == "active").count(),
    }))
}

/// Aggregate stats for the env-manager admin dashboard.
/// Authenticated via X-Service-Secret header (server-to-server only).
/// Returns what's available without per-tenant scope.
pub async fn admin_stats(
    headers: HeaderMap,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<serde_json::Value>> {
    let expected = std::env::var("SERVICE_SECRET").unwrap_or_default();
    let provided = headers
        .get("x-service-secret")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if expected.is_empty() || provided != expected {
        return Err(ApiError::unauthorized());
    }

    let tenant_count = state.tenants.count_all().await.unwrap_or(0);

    Ok(Json(serde_json::json!({
        "tenants": tenant_count,
        "users": null,
        "events": null,
        "runs": null,
        "connections": null,
    })))
}

pub async fn activity(
    user: AuthUser,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<DashboardActivityResponse>> {
    let logs = state
        .audit_logs
        .list_by_tenant(&user.tenant_id, 20, 0)
        .await?;
    Ok(Json(DashboardActivityResponse { activity: logs }))
}
