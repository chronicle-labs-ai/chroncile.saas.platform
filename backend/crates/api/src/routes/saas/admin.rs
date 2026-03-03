use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use chronicle_domain::{CreateTenantInput, CreateUserInput, Tenant, User, UserRole};
use serde::{Deserialize, Serialize};

use super::error::{ApiError, ApiResult};
use crate::saas_state::SaasAppState;

fn verify_service_secret(headers: &HeaderMap) -> Result<(), ApiError> {
    let expected = std::env::var("SERVICE_SECRET").unwrap_or_default();
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
    verify_service_secret(&headers)?;

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
    verify_service_secret(&headers)?;

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
    verify_service_secret(&headers)?;

    state
        .tenants
        .find_by_id(&tenant_id)
        .await?
        .ok_or_else(|| ApiError::not_found(&format!("tenant: {tenant_id}")))?;

    if let Some(existing) = state.users.find_by_email(&input.email).await? {
        if existing.tenant_id == tenant_id {
            let app_url = std::env::var("NEXT_PUBLIC_APP_URL")
                .unwrap_or_else(|_| "https://app.chronicle-labs.com".to_string());
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
        })
        .await?;

    let app_url = std::env::var("NEXT_PUBLIC_APP_URL")
        .unwrap_or_else(|_| "https://app.chronicle-labs.com".to_string());
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
    verify_service_secret(&headers)?;

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
        })
        .await?;

    let app_url = std::env::var("NEXT_PUBLIC_APP_URL")
        .unwrap_or_else(|_| "https://app.chronicle-labs.com".to_string());

    Ok(Json(CreateOrgResponse {
        tenant,
        user,
        login_url: format!("{app_url}/login"),
    }))
}
