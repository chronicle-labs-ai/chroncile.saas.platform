//! `GET /api/saas/me` — returns the current user's identity by way of the
//! [`WorkosAuthUser`] extractor, plus the full list of tenants the user is a
//! member of (active memberships only) so the frontend can render an
//! org-switcher without an extra round-trip.
//!
//! This is the validation endpoint for the WorkOS JWKS path: if hitting it
//! with a WorkOS access token returns a populated body, the whole new auth
//! stack (verifier → repo lookups → membership gate → tenant scoping) is
//! wired correctly.

use axum::{extract::State, Json};
use serde::Serialize;

use chronicle_domain::{MembershipStatus, UserRole};

use super::error::{ApiError, ApiResult};
use crate::saas_state::SaasAppState;
use crate::workos_user::{WorkosAuthUser, WorkosIdentityUser};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeOrganization {
    pub tenant_id: String,
    pub tenant_name: String,
    pub tenant_slug: String,
    pub workos_organization_id: Option<String>,
    pub role: UserRole,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeResponse {
    pub user_id: String,
    pub email: String,
    pub name: Option<String>,
    /// Role within the *active* tenant. Comes from the membership row, not
    /// `User.role`. Always matches `organizations[active].role`.
    pub role: UserRole,
    pub tenant_id: String,
    pub tenant_name: String,
    pub tenant_slug: String,
    pub workos_user_id: Option<String>,
    pub workos_organization_id: Option<String>,
    pub workos_session_id: String,
    /// The user's *primary* tenant id (`User.tenantId`). Assigned at account
    /// creation — either the workspace they self-served, or the first
    /// organization they were invited to. Cannot be removed from them.
    /// The frontend uses this to (a) auto-pick at login when WorkOS asks for
    /// org selection, and (b) flag the primary visually in the switcher.
    pub primary_tenant_id: String,
    /// All active memberships for the user. Used by the frontend to render
    /// the org-switcher in the dashboard header.
    pub organizations: Vec<MeOrganization>,
}

pub async fn get_me(
    user: WorkosAuthUser,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<MeResponse>> {
    let memberships = state
        .memberships
        .list_by_user(&user.user.id)
        .await
        .map_err(|err| {
            tracing::error!(error = ?err, user_id = %user.user.id, "list_by_user failed in /me");
            ApiError::internal()
        })?;

    let mut organizations = Vec::with_capacity(memberships.len());
    for membership in memberships {
        if membership.status != MembershipStatus::Active {
            continue;
        }
        if let Some(tenant) = state
            .tenants
            .find_by_id(&membership.tenant_id)
            .await
            .map_err(|err| {
                tracing::error!(error = ?err, tenant_id = %membership.tenant_id, "tenant lookup failed in /me");
                ApiError::internal()
            })?
        {
            organizations.push(MeOrganization {
                tenant_id: tenant.id,
                tenant_name: tenant.name,
                tenant_slug: tenant.slug,
                workos_organization_id: tenant.workos_organization_id,
                role: membership.role,
            });
        }
    }

    Ok(Json(MeResponse {
        user_id: user.user.id.clone(),
        email: user.user.email.clone(),
        name: user.user.name.clone(),
        role: user.role(),
        tenant_id: user.tenant.id.clone(),
        tenant_name: user.tenant.name.clone(),
        tenant_slug: user.tenant.slug.clone(),
        workos_user_id: user.user.workos_user_id.clone(),
        workos_organization_id: user.tenant.workos_organization_id.clone(),
        workos_session_id: user.claims.sid.clone(),
        primary_tenant_id: user.user.tenant_id.clone(),
        organizations,
    }))
}

// ---------------------------------------------------------------------------
// `GET /api/saas/identity` — like /me but org-agnostic.
//
// Used by the frontend `auth()` helper as a fallback when the sealed
// session is authenticated but lacks an `org_id` claim (most commonly
// after a token refresh that didn't preserve the org binding). Returns
// just enough info — primary + memberships — for the dashboard layout to
// pick a primary and rebind the cookie via /api/auth/switch-org. No
// active-tenant-shaped fields, by design: if you have an `org_id` you
// should be using /me instead.
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentityResponse {
    pub user_id: String,
    pub email: String,
    pub name: Option<String>,
    pub workos_user_id: Option<String>,
    /// Primary tenant id (`User.tenantId`). May be empty for users who
    /// have no primary yet (e.g. invited but never self-served).
    pub primary_tenant_id: String,
    /// All active memberships, same shape as `/me.organizations`.
    pub organizations: Vec<MeOrganization>,
}

pub async fn get_identity(
    user: WorkosIdentityUser,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<IdentityResponse>> {
    let memberships = state
        .memberships
        .list_by_user(&user.user.id)
        .await
        .map_err(|err| {
            tracing::error!(error = ?err, user_id = %user.user.id, "list_by_user failed in /identity");
            ApiError::internal()
        })?;

    let mut organizations = Vec::with_capacity(memberships.len());
    for membership in memberships {
        if membership.status != MembershipStatus::Active {
            continue;
        }
        if let Some(tenant) = state
            .tenants
            .find_by_id(&membership.tenant_id)
            .await
            .map_err(|err| {
                tracing::error!(error = ?err, tenant_id = %membership.tenant_id, "tenant lookup failed in /identity");
                ApiError::internal()
            })?
        {
            organizations.push(MeOrganization {
                tenant_id: tenant.id,
                tenant_name: tenant.name,
                tenant_slug: tenant.slug,
                workos_organization_id: tenant.workos_organization_id,
                role: membership.role,
            });
        }
    }

    Ok(Json(IdentityResponse {
        user_id: user.user.id.clone(),
        email: user.user.email.clone(),
        name: user.user.name.clone(),
        workos_user_id: user.user.workos_user_id.clone(),
        primary_tenant_id: user.user.tenant_id.clone(),
        organizations,
    }))
}
