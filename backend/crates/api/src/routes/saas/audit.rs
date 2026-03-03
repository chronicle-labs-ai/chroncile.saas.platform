use axum::{
    extract::{Query, State},
    Json,
};

use chronicle_auth::types::AuthUser;
use chronicle_domain::{AuditLogListResponse, AuditLogParams};

use super::error::ApiResult;
use crate::saas_state::SaasAppState;

pub async fn list_audit_logs(
    user: AuthUser,
    State(state): State<SaasAppState>,
    Query(params): Query<AuditLogParams>,
) -> ApiResult<Json<AuditLogListResponse>> {
    let limit = params.limit.unwrap_or(50);
    let offset = params.offset.unwrap_or(0);

    let audit_logs = state.audit_logs.list_by_tenant(&user.tenant_id, limit, offset).await?;

    Ok(Json(AuditLogListResponse { audit_logs, limit, offset }))
}
