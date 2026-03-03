use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};

use chronicle_auth::types::AuthUser;
use chronicle_domain::{ConnectionListResponse, ConnectionResponse};

use super::error::{ApiError, ApiResult};
use crate::saas_state::SaasAppState;

pub async fn list_connections(
    user: AuthUser,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<ConnectionListResponse>> {
    let connections = state.connections.list_by_tenant(&user.tenant_id).await?;
    Ok(Json(ConnectionListResponse { connections }))
}

pub async fn get_connection(
    user: AuthUser,
    State(state): State<SaasAppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<ConnectionResponse>> {
    let conn = state
        .connections
        .find_by_id(&id)
        .await?
        .ok_or_else(|| ApiError::not_found("Connection"))?;

    if conn.tenant_id != user.tenant_id {
        return Err(ApiError::not_found("Connection"));
    }

    Ok(Json(ConnectionResponse { connection: conn }))
}

pub async fn delete_connection(
    user: AuthUser,
    State(state): State<SaasAppState>,
    Path(id): Path<String>,
) -> ApiResult<StatusCode> {
    let conn = state
        .connections
        .find_by_id(&id)
        .await?
        .ok_or_else(|| ApiError::not_found("Connection"))?;

    if conn.tenant_id != user.tenant_id {
        return Err(ApiError::not_found("Connection"));
    }

    state.connections.delete(&id).await?;
    Ok(StatusCode::NO_CONTENT)
}
