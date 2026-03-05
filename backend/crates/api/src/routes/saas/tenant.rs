use axum::{extract::State, Json};

use chronicle_auth::types::AuthUser;
use chronicle_domain::{TenantResponse, UpdateStripeRequest, UserRole};

use super::error::{ApiError, ApiResult};
use crate::saas_state::SaasAppState;

pub async fn get_tenant(
    user: AuthUser,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<TenantResponse>> {
    let tenant = state.tenants.find_by_id(&user.tenant_id).await?;
    Ok(Json(TenantResponse { tenant }))
}

pub async fn update_tenant_stripe(
    user: AuthUser,
    State(state): State<SaasAppState>,
    Json(input): Json<UpdateStripeRequest>,
) -> ApiResult<Json<TenantResponse>> {
    let tenant = state
        .tenants
        .update_stripe_fields(
            &user.tenant_id,
            input.stripe_customer_id.as_deref(),
            input.stripe_subscription_status.as_deref(),
            input.stripe_price_id.as_deref(),
        )
        .await?;

    Ok(Json(TenantResponse {
        tenant: Some(tenant),
    }))
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTenantNameRequest {
    pub name: String,
}

pub async fn update_tenant_name(
    user: AuthUser,
    State(state): State<SaasAppState>,
    Json(input): Json<UpdateTenantNameRequest>,
) -> ApiResult<Json<TenantResponse>> {
    let role = user.role.parse().unwrap_or(UserRole::Member);
    if !role.is_owner() {
        return Err(ApiError::forbidden(
            "Only the organization owner can rename the organization",
        ));
    }

    if input.name.trim().is_empty() {
        return Err(ApiError::bad_request("Organization name cannot be empty"));
    }

    let tenant = state
        .tenants
        .update_name(&user.tenant_id, &input.name)
        .await?;
    Ok(Json(TenantResponse {
        tenant: Some(tenant),
    }))
}

pub async fn delete_tenant(
    user: AuthUser,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<serde_json::Value>> {
    let role = user.role.parse().unwrap_or(UserRole::Member);
    if !role.is_owner() {
        return Err(ApiError::forbidden(
            "Only the organization owner can delete the organization",
        ));
    }

    state.tenants.delete(&user.tenant_id).await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}
