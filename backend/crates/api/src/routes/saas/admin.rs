use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use chronicle_domain::{
    AdminTenantFeatureAccessResponse, CreateTenantInput, CreateUserInput,
    FeatureFlagDefinitionsResponse, FeatureFlagKey, Tenant, UpsertFeatureFlagOverrideRequest, User,
    UserRole,
};
use serde::{Deserialize, Serialize};

use super::error::{ApiError, ApiResult};
use crate::saas_state::SaasAppState;

fn verify_service_secret(state: &SaasAppState, headers: &HeaderMap) -> Result<(), ApiError> {
    let expected = state.config.service_secret.as_deref().unwrap_or("");
    let provided = headers
        .get("x-service-secret")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if expected.is_empty() || provided != expected {
        Err(ApiError::unauthorized())
    } else {
        Ok(())
    }
}

fn admin_actor(headers: &HeaderMap) -> Option<String> {
    headers
        .get("x-admin-actor")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

// ── List all tenants ─────────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminTenantEntry {
    #[serde(flatten)]
    pub tenant: Tenant,
    pub user_count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminTenantsResponse {
    pub tenants: Vec<AdminTenantEntry>,
    pub total: usize,
}

pub async fn list_tenants(
    headers: HeaderMap,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<AdminTenantsResponse>> {
    verify_service_secret(&state, &headers)?;

    let total = state.tenants.count_all().await.unwrap_or(0);
    let tenants = state.tenants.list_all(100, 0).await.unwrap_or_default();

    let mut entries: Vec<AdminTenantEntry> = Vec::with_capacity(tenants.len());
    for tenant in tenants {
        let users = state
            .users
            .list_by_tenant(&tenant.id)
            .await
            .unwrap_or_default();
        entries.push(AdminTenantEntry {
            user_count: users.len(),
            tenant,
        });
    }

    Ok(Json(AdminTenantsResponse {
        tenants: entries,
        total,
    }))
}

// ── List users for a tenant ──────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminUsersResponse {
    pub users: Vec<User>,
}

pub async fn list_tenant_users(
    headers: HeaderMap,
    Path(tenant_id): Path<String>,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<AdminUsersResponse>> {
    verify_service_secret(&state, &headers)?;

    let users = state
        .users
        .list_by_tenant(&tenant_id)
        .await
        .unwrap_or_default();
    Ok(Json(AdminUsersResponse { users }))
}

// ── Invite user to existing tenant ──────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InviteUserRequest {
    pub email: String,
    pub name: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InviteUserResponse {
    pub user: User,
    pub login_url: String,
}

pub async fn invite_user(
    headers: HeaderMap,
    Path(tenant_id): Path<String>,
    State(state): State<SaasAppState>,
    Json(input): Json<InviteUserRequest>,
) -> ApiResult<Json<InviteUserResponse>> {
    verify_service_secret(&state, &headers)?;

    state
        .tenants
        .find_by_id(&tenant_id)
        .await?
        .ok_or_else(|| ApiError::not_found(&format!("tenant: {tenant_id}")))?;

    if let Some(existing) = state.users.find_by_email(&input.email).await? {
        if existing.tenant_id == tenant_id {
            let app_url = state.config.app_url.clone();
            return Ok(Json(InviteUserResponse {
                login_url: format!("{app_url}/login"),
                user: existing,
            }));
        }
        return Err(ApiError::bad_request(
            "Email already registered to a different org",
        ));
    }

    let user = state
        .users
        .create(CreateUserInput {
            email: input.email.clone(),
            name: input.name,
            password_hash: None,
            auth_provider: "google".to_string(),
            role: UserRole::Member,
            tenant_id: tenant_id.clone(),
            workos_user_id: None,
            created_via: Some("invite".to_string()),
        })
        .await?;

    let app_url = state.config.app_url.clone();
    let login_url = format!("{app_url}/login");

    Ok(Json(InviteUserResponse { user, login_url }))
}

// ── Create organization + first user ────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOrgRequest {
    pub org_name: String,
    pub org_slug: String,
    pub admin_email: String,
    pub admin_name: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOrgResponse {
    pub tenant: Tenant,
    pub user: User,
    pub login_url: String,
}

pub async fn create_org(
    headers: HeaderMap,
    State(state): State<SaasAppState>,
    Json(input): Json<CreateOrgRequest>,
) -> ApiResult<Json<CreateOrgResponse>> {
    verify_service_secret(&state, &headers)?;

    if let Some(_existing) = state.tenants.find_by_slug(&input.org_slug).await? {
        return Err(ApiError::bad_request(
            "An organization with this slug already exists",
        ));
    }

    if let Some(_existing) = state.users.find_by_email(&input.admin_email).await? {
        return Err(ApiError::bad_request(
            "Email already registered to another organization",
        ));
    }

    let tenant = state
        .tenants
        .create(CreateTenantInput {
            name: input.org_name,
            slug: input.org_slug,
        })
        .await?;

    let user = state
        .users
        .create(CreateUserInput {
            email: input.admin_email,
            name: input.admin_name,
            password_hash: None,
            auth_provider: "google".to_string(),
            role: UserRole::Owner,
            tenant_id: tenant.id.clone(),
            workos_user_id: None,
            created_via: Some("self_serve".to_string()),
        })
        .await?;

    let app_url = state.config.app_url.clone();

    Ok(Json(CreateOrgResponse {
        tenant,
        user,
        login_url: format!("{app_url}/login"),
    }))
}

// ── Feature flag definitions ────────────────────────────────────────────────

pub async fn list_feature_flags(
    headers: HeaderMap,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<FeatureFlagDefinitionsResponse>> {
    verify_service_secret(&state, &headers)?;
    let flags = state.feature_access.list_flag_definitions().await?;
    Ok(Json(FeatureFlagDefinitionsResponse { flags }))
}

// ── Tenant feature access ───────────────────────────────────────────────────

pub async fn get_tenant_feature_access(
    headers: HeaderMap,
    Path(tenant_id): Path<String>,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<AdminTenantFeatureAccessResponse>> {
    verify_service_secret(&state, &headers)?;
    let (tenant, access, overrides) = state.feature_access.resolve_admin_view(&tenant_id).await?;
    Ok(Json(AdminTenantFeatureAccessResponse {
        tenant,
        access,
        overrides,
    }))
}

pub async fn upsert_tenant_feature_flag_override(
    headers: HeaderMap,
    Path((tenant_id, flag_key)): Path<(String, String)>,
    State(state): State<SaasAppState>,
    Json(input): Json<UpsertFeatureFlagOverrideRequest>,
) -> ApiResult<Json<AdminTenantFeatureAccessResponse>> {
    verify_service_secret(&state, &headers)?;

    let parsed_flag_key: FeatureFlagKey = flag_key
        .parse()
        .map_err(|_| ApiError::bad_request("Unknown feature flag key"))?;

    state
        .feature_access
        .upsert_tenant_override(
            &tenant_id,
            parsed_flag_key,
            input.enabled,
            input.reason.clone(),
        )
        .await?;

    let actor = admin_actor(&headers);
    state
        .audit_logs
        .create(
            &tenant_id,
            "feature_flag_override_upserted",
            actor.as_deref(),
            None,
            None,
            None,
            Some(serde_json::json!({
                "flagKey": parsed_flag_key.as_str(),
                "enabled": input.enabled,
                "reason": input.reason,
            })),
        )
        .await
        .ok();

    let (tenant, access, overrides) = state.feature_access.resolve_admin_view(&tenant_id).await?;
    Ok(Json(AdminTenantFeatureAccessResponse {
        tenant,
        access,
        overrides,
    }))
}

pub async fn delete_tenant_feature_flag_override(
    headers: HeaderMap,
    Path((tenant_id, flag_key)): Path<(String, String)>,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<AdminTenantFeatureAccessResponse>> {
    verify_service_secret(&state, &headers)?;

    let parsed_flag_key: FeatureFlagKey = flag_key
        .parse()
        .map_err(|_| ApiError::bad_request("Unknown feature flag key"))?;

    state
        .feature_access
        .delete_tenant_override(&tenant_id, parsed_flag_key)
        .await?;

    let actor = admin_actor(&headers);
    state
        .audit_logs
        .create(
            &tenant_id,
            "feature_flag_override_deleted",
            actor.as_deref(),
            None,
            None,
            None,
            Some(serde_json::json!({
                "flagKey": parsed_flag_key.as_str(),
            })),
        )
        .await
        .ok();

    let (tenant, access, overrides) = state.feature_access.resolve_admin_view(&tenant_id).await?;
    Ok(Json(AdminTenantFeatureAccessResponse {
        tenant,
        access,
        overrides,
    }))
}
