use std::sync::Arc;

use axum::http::{request::Parts, HeaderMap};
use chronicle_auth::{
    types::AuthUser,
    workos_jwt::WorkosJwtVerifier,
};
use chronicle_domain::UserRole;
use chronicle_interfaces::{TenantRepository, UserRepository};
use serde::Serialize;

use crate::error::ChronicleMcpError;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpSessionContext {
    pub user_id: String,
    pub email: String,
    pub name: Option<String>,
    pub role: String,
    pub tenant_id: String,
    pub tenant_name: String,
    pub tenant_slug: String,
    pub org_id: String,
}

/// Validates WorkOS access tokens and resolves them to local Chronicle
/// `User` + `Tenant` rows. Mirrors the logic in
/// `chronicle_auth::middleware::AuthUser` but exposed for the MCP transport,
/// which doesn't go through Axum extractors.
#[derive(Clone)]
pub struct ChronicleMcpAuthResolver {
    workos_jwt: Arc<WorkosJwtVerifier>,
    users: Arc<dyn UserRepository>,
    tenants: Arc<dyn TenantRepository>,
    stdio_user: Option<AuthUser>,
}

impl ChronicleMcpAuthResolver {
    pub fn for_http(
        workos_jwt: Arc<WorkosJwtVerifier>,
        users: Arc<dyn UserRepository>,
        tenants: Arc<dyn TenantRepository>,
    ) -> Self {
        Self {
            workos_jwt,
            users,
            tenants,
            stdio_user: None,
        }
    }

    pub async fn for_stdio(
        workos_jwt: Arc<WorkosJwtVerifier>,
        users: Arc<dyn UserRepository>,
        tenants: Arc<dyn TenantRepository>,
        token: &str,
    ) -> Result<Self, ChronicleMcpError> {
        let user = validate_workos_token(&workos_jwt, &users, &tenants, token).await?;
        Ok(Self {
            workos_jwt,
            users,
            tenants,
            stdio_user: Some(user),
        })
    }

    pub async fn resolve_from_parts(
        &self,
        parts: Option<&Parts>,
    ) -> Result<McpSessionContext, ChronicleMcpError> {
        if let Some(parts) = parts {
            if let Some(user) = parts.extensions.get::<AuthUser>() {
                return Ok(McpSessionContext::from(user.clone()));
            }

            if let Some(token) = bearer_token(&parts.headers) {
                let user = validate_workos_token(
                    &self.workos_jwt,
                    &self.users,
                    &self.tenants,
                    token,
                )
                .await?;
                return Ok(McpSessionContext::from(user));
            }
        }

        self.stdio_user
            .clone()
            .map(McpSessionContext::from)
            .ok_or_else(|| {
                ChronicleMcpError::unauthorized(
                    "Chronicle MCP request is missing a valid Chronicle bearer token",
                )
            })
    }

    pub fn workos_jwt(&self) -> &Arc<WorkosJwtVerifier> {
        &self.workos_jwt
    }
    pub fn users(&self) -> &Arc<dyn UserRepository> {
        &self.users
    }
    pub fn tenants(&self) -> &Arc<dyn TenantRepository> {
        &self.tenants
    }
}

/// Verify the bearer token via JWKS and resolve it to a fully-populated
/// `AuthUser`. Returns a 401-equivalent error on any failure.
pub async fn validate_workos_token(
    workos_jwt: &Arc<WorkosJwtVerifier>,
    users: &Arc<dyn UserRepository>,
    tenants: &Arc<dyn TenantRepository>,
    token: &str,
) -> Result<AuthUser, ChronicleMcpError> {
    let claims = workos_jwt
        .verify(token)
        .await
        .map_err(|err| ChronicleMcpError::unauthorized(err.to_string()))?;

    let user = users
        .find_by_workos_user_id(&claims.sub)
        .await
        .map_err(|err| ChronicleMcpError::unauthorized(err.to_string()))?
        .ok_or_else(|| ChronicleMcpError::unauthorized("user_not_provisioned".to_string()))?;

    let org_id = claims
        .org_id
        .as_deref()
        .ok_or_else(|| ChronicleMcpError::unauthorized("no_organization_in_token".to_string()))?;

    let tenant = tenants
        .find_by_workos_organization_id(org_id)
        .await
        .map_err(|err| ChronicleMcpError::unauthorized(err.to_string()))?
        .ok_or_else(|| {
            ChronicleMcpError::unauthorized("tenant_not_provisioned".to_string())
        })?;

    if user.tenant_id != tenant.id {
        return Err(ChronicleMcpError::unauthorized(
            "user_tenant_mismatch".to_string(),
        ));
    }

    let role = match user.role {
        UserRole::Owner => "owner",
        UserRole::Admin => "admin",
        UserRole::Member => "member",
    }
    .to_string();

    Ok(AuthUser {
        id: user.id,
        email: user.email,
        name: user.name,
        role,
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        tenant_slug: tenant.slug,
    })
}

impl From<AuthUser> for McpSessionContext {
    fn from(user: AuthUser) -> Self {
        Self {
            org_id: user.tenant_id.clone(),
            user_id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            tenant_id: user.tenant_id,
            tenant_name: user.tenant_name,
            tenant_slug: user.tenant_slug,
        }
    }
}

fn bearer_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .and_then(|header| header.strip_prefix("Bearer "))
}
