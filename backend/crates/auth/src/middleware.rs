use async_trait::async_trait;
use axum::{extract::FromRequestParts, http::request::Parts};
use std::sync::Arc;

use chronicle_domain::{Tenant, User, UserRole};
use chronicle_interfaces::{TenantRepository, UserRepository};

use crate::error::AuthError;
use crate::types::AuthUser;
use crate::workos_jwt::WorkosJwtVerifier;

pub fn extract_bearer_token(parts: &Parts) -> Result<&str, AuthError> {
    let auth_header = parts
        .headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or(AuthError::MissingAuth)?;

    auth_header
        .strip_prefix("Bearer ")
        .ok_or(AuthError::InvalidToken(
            "expected 'Bearer <token>' format".to_string(),
        ))
}

/// Application states that can authenticate a Chronicle request must expose
/// the dependencies needed to validate a WorkOS access token end-to-end:
///
///   - `workos_jwt`  → verifies the JWT signature against the JWKS keyset
///   - `users`       → resolves the JWT `sub` claim to a local Chronicle User
///   - `tenants`     → resolves the JWT `org_id` claim to a local Chronicle Tenant
///
/// `SaasAppState` (in the `chronicle_api` crate) implements this. The trait
/// lives here so that the `FromRequestParts<S> for AuthUser` impl can be
/// generic over any state that satisfies it without the auth crate having to
/// know about the API crate.
pub trait HasAuthDeps: Send + Sync {
    fn workos_jwt(&self) -> &Arc<WorkosJwtVerifier>;
    fn users(&self) -> &Arc<dyn UserRepository>;
    fn tenants(&self) -> &Arc<dyn TenantRepository>;
}

/// Build the legacy `AuthUser` shape (flat fields) from the new
/// `User` + `Tenant` rows we resolve from the WorkOS JWT. Keeps every
/// existing handler signature (`fn handler(user: AuthUser, ...)`) working
/// without a single change in the 20+ route files.
fn build_auth_user(user: User, tenant: Tenant) -> AuthUser {
    let role = match user.role {
        UserRole::Owner => "owner",
        UserRole::Admin => "admin",
        UserRole::Member => "member",
    }
    .to_string();

    AuthUser {
        id: user.id,
        email: user.email,
        name: user.name,
        role,
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        tenant_slug: tenant.slug,
    }
}

/// Extractor for authenticated users. Validates the bearer token against
/// WorkOS via JWKS, resolves the WorkOS user/org to local Chronicle records,
/// and returns the legacy-shaped `AuthUser` so that existing handlers work
/// unchanged.
///
/// Failures all surface as `AuthError::InvalidToken` / `AuthError::MissingAuth`
/// without leaking detail; the underlying cause is logged at WARN level.
#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: HasAuthDeps,
{
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        // Allow middleware/test code to short-circuit by injecting an
        // already-resolved AuthUser into request extensions.
        if let Some(user) = parts.extensions.get::<AuthUser>() {
            return Ok(user.clone());
        }

        let token = extract_bearer_token(parts)?;

        // 1. Verify signature + issuer + expiry.
        let claims = state.workos_jwt().verify(token).await.map_err(|err| {
            tracing::warn!(error = %err, "WorkOS access token verification failed");
            AuthError::InvalidToken("invalid_token".to_string())
        })?;

        // 2. Resolve `sub` → local User.
        let user = state
            .users()
            .find_by_workos_user_id(&claims.sub)
            .await
            .map_err(|err| {
                tracing::error!(error = ?err, workos_user_id = %claims.sub, "user lookup failed");
                AuthError::Internal("user lookup failed".to_string())
            })?
            .ok_or_else(|| {
                tracing::warn!(workos_user_id = %claims.sub, "no local user for workos sub");
                AuthError::InvalidToken("user_not_provisioned".to_string())
            })?;

        // 3. Org context required for tenant-scoped endpoints.
        let org_id = claims.org_id.as_deref().ok_or_else(|| {
            tracing::warn!(workos_user_id = %claims.sub, "WorkOS access token has no org_id");
            AuthError::InvalidToken("no_organization_in_token".to_string())
        })?;

        // 4. Resolve `org_id` → local Tenant.
        let tenant = state
            .tenants()
            .find_by_workos_organization_id(org_id)
            .await
            .map_err(|err| {
                tracing::error!(error = ?err, workos_organization_id = %org_id, "tenant lookup failed");
                AuthError::Internal("tenant lookup failed".to_string())
            })?
            .ok_or_else(|| {
                tracing::warn!(
                    workos_organization_id = %org_id,
                    "no local tenant for workos org_id — onboarding incomplete?",
                );
                AuthError::InvalidToken("tenant_not_provisioned".to_string())
            })?;

        // 5. Defense-in-depth: the user row's tenant_id must match the
        //    tenant we resolved from the org_id claim.
        if user.tenant_id != tenant.id {
            tracing::warn!(
                user_id = %user.id,
                user_tenant_id = %user.tenant_id,
                resolved_tenant_id = %tenant.id,
                "user/tenant mismatch via WorkOS claims — rejecting",
            );
            return Err(AuthError::InvalidToken("user_tenant_mismatch".to_string()));
        }

        Ok(build_auth_user(user, tenant))
    }
}
