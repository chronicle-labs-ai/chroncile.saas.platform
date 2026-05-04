use async_trait::async_trait;
use axum::{extract::FromRequestParts, http::request::Parts};

use chronicle_auth::middleware::extract_bearer_token;
use chronicle_auth::workos_jwt::WorkosClaims;
use chronicle_domain::{MembershipStatus, Tenant, TenantMembership, User, UserRole};

use crate::routes::saas::error::ApiError;
use crate::saas_state::SaasAppState;

#[derive(Debug, Clone)]
pub struct WorkosAuthUser {
    pub user: User,
    pub tenant: Tenant,
    pub membership: TenantMembership,
    pub claims: WorkosClaims,
}

impl WorkosAuthUser {
    /// Convenience: the local Chronicle tenant id (same as `self.tenant.id`).
    pub fn tenant_id(&self) -> &str {
        &self.tenant.id
    }

    /// Convenience: the local Chronicle user id.
    pub fn user_id(&self) -> &str {
        &self.user.id
    }

    /// Convenience: role within the active tenant. Comes from the membership
    /// row, not `User.role` (which is now legacy / informational only).
    pub fn role(&self) -> UserRole {
        self.membership.role
    }
}


#[derive(Debug, Clone)]
pub struct WorkosIdentityUser {
    pub user: User,
    pub claims: WorkosClaims,
}

#[async_trait]
impl FromRequestParts<SaasAppState> for WorkosIdentityUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &SaasAppState,
    ) -> Result<Self, Self::Rejection> {
        let token = extract_bearer_token(parts).map_err(|_| ApiError::unauthorized())?;
        let claims = state.workos_jwt.verify(token).await.map_err(|err| {
            tracing::warn!(error = %err, "WorkOS access token verification failed");
            ApiError::unauthorized()
        })?;
        let user = state
            .users
            .find_by_workos_user_id(&claims.sub)
            .await
            .map_err(|err| {
                tracing::error!(error = ?err, workos_user_id = %claims.sub, "user lookup failed");
                ApiError::internal()
            })?
            .ok_or_else(|| {
                tracing::warn!(workos_user_id = %claims.sub, "no local user for workos sub");
                ApiError::unauthorized()
            })?;
        Ok(WorkosIdentityUser { user, claims })
    }
}

#[async_trait]
impl FromRequestParts<SaasAppState> for WorkosAuthUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &SaasAppState,
    ) -> Result<Self, Self::Rejection> {
        let token = extract_bearer_token(parts).map_err(|_| ApiError::unauthorized())?;

        let claims = state.workos_jwt.verify(token).await.map_err(|err| {
            tracing::warn!(error = %err, "WorkOS access token verification failed");
            ApiError::unauthorized()
        })?;

        let user = state
            .users
            .find_by_workos_user_id(&claims.sub)
            .await
            .map_err(|err| {
                tracing::error!(error = ?err, workos_user_id = %claims.sub, "user lookup failed");
                ApiError::internal()
            })?
            .ok_or_else(|| {
                tracing::warn!(workos_user_id = %claims.sub, "no local user for workos sub");
                ApiError::unauthorized()
            })?;

      
        let org_id = claims.org_id.as_deref().ok_or_else(|| {
            tracing::warn!(workos_user_id = %claims.sub, "WorkOS access token has no org_id claim");
            ApiError::unauthorized()
        })?;

        let tenant = state
            .tenants
            .find_by_workos_organization_id(org_id)
            .await
            .map_err(|err| {
                tracing::error!(error = ?err, workos_organization_id = %org_id, "tenant lookup failed");
                ApiError::internal()
            })?
            .ok_or_else(|| {
                tracing::warn!(
                    workos_organization_id = %org_id,
                    "no local tenant for workos org_id — onboarding incomplete?",
                );
                ApiError::unauthorized()
            })?;

         let membership = state
            .memberships
            .find(&user.id, &tenant.id)
            .await
            .map_err(|err| {
                tracing::error!(error = ?err, user_id = %user.id, tenant_id = %tenant.id, "membership lookup failed");
                ApiError::internal()
            })?
            .ok_or_else(|| {
                tracing::warn!(
                    user_id = %user.id,
                    tenant_id = %tenant.id,
                    workos_organization_id = %org_id,
                    "WorkosAuthUser: no membership for (user, tenant) — rejecting",
                );
                ApiError::unauthorized()
            })?;

        if membership.status != MembershipStatus::Active {
            tracing::warn!(
                user_id = %user.id,
                tenant_id = %tenant.id,
                status = %membership.status,
                "WorkosAuthUser: membership not active — rejecting",
            );
            return Err(ApiError::unauthorized());
        }

        Ok(WorkosAuthUser {
            user,
            tenant,
            membership,
            claims,
        })
    }
}
