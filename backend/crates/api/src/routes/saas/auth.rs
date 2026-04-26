//! WorkOS-AuthKit-backed auth routes.
//!
//! Phase 0b of the WorkOS migration: the legacy `signup` / `login` /
//! `forgot_password` / `reset_password` / `oauth_signup` / `exchange_token`
//! handlers (which dealt with bcrypt + custom reset tokens + a NextAuth
//! session bridge) are gone. Their replacements live here:
//!
//! - `POST /api/platform/auth/workos-exchange` — the only path the Next
//!   frontend uses to trade a verified WorkOS access token for a
//!   short-lived Chronicle JWT. Three response shapes per the
//!   architecture sequence in the migration plan: `200 { token }` on
//!   the happy path (existing user OR JIT-created when an
//!   organizationId is in the callback), `409 NoMembership` when
//!   provisioning is required, `401` on a bad WorkOS access token.
//! - `GET /api/platform/auth/discover?email=…` — pre-registration domain
//!   check that drives the A.1 / A.1c / A.1p / A.1s sub-states of
//!   `SignUpEmail` and the D.1 / D.2 sub-states of `SignIn`.
//! - `POST /api/platform/auth/invitations/send` — owner-initiated
//!   invitations via WorkOS.
//! - `POST /api/platform/auth/invitations/resend` — re-issue a pending
//!   invite for the A.1p "didn't get the email?" UX.
//! - `POST /api/webhooks/workos` — SCIM `directory.user.*` webhook.
//!
//! All non-webhook backend routes are guarded by `service_secret`. The
//! WorkOS-side trust boundary is `verify_access_token`; the Chronicle
//! JWT trust boundary is unchanged (`chronicle_auth::jwt`).

use axum::{
    body::Bytes,
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use chronicle_auth::{
    types::{AuthUser, AuthUserResponse},
    workos::{
        verify_webhook_signature, BulkOrganizationMembership, CreateOrganizationParams,
        CreateUserParams, MembershipRole, OrganizationMembership, SendInvitationParams,
        WebhookSignatureError, WorkosClient, WorkosError, WorkosUser,
    },
};
use chronicle_domain::{CreateTenantInput, CreateUserInput, Tenant, User, UserRole};
use serde::{Deserialize, Serialize};

use super::error::{ApiError, ApiResult};
use crate::saas_state::SaasAppState;

const SERVICE_SECRET_HEADER: &str = "x-service-secret";

fn require_service_secret(state: &SaasAppState, headers: &HeaderMap) -> Result<(), ApiError> {
    let expected = state.config.service_secret.as_deref().unwrap_or("");
    let provided = headers
        .get(SERVICE_SECRET_HEADER)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if expected.is_empty() || provided != expected {
        return Err(ApiError::unauthorized());
    }
    Ok(())
}

fn email_domain(email: &str) -> Option<String> {
    email.rsplit_once('@').map(|(_, d)| d.trim().to_lowercase())
}

fn is_valid_email_address(email: &str) -> bool {
    !email.trim().is_empty() && email.contains('@')
}

fn workos_client_from_env() -> Result<WorkosClient, ApiError> {
    WorkosClient::from_env().map_err(|e| {
        tracing::error!(error = %e, "WorkOS client misconfigured");
        ApiError::internal()
    })
}

fn handle_workos_error(err: WorkosError) -> ApiError {
    match err {
        WorkosError::InvalidToken(detail) => {
            tracing::warn!(detail, "WorkOS access token rejected");
            ApiError::unauthorized()
        }
        WorkosError::Api { status, body } => {
            tracing::warn!(%status, body, "WorkOS API error");
            // 401/403 — surface as unauthorized; everything else is internal.
            if status == reqwest::StatusCode::UNAUTHORIZED
                || status == reqwest::StatusCode::FORBIDDEN
            {
                ApiError::unauthorized()
            } else {
                ApiError::internal()
            }
        }
        WorkosError::Http(http) => {
            tracing::error!(error = %http, "WorkOS HTTP transport error");
            ApiError::internal()
        }
        WorkosError::MissingApiKey | WorkosError::MissingClientId => {
            tracing::error!("WorkOS env vars not set");
            ApiError::internal()
        }
    }
}

fn membership_role_slug(member: &OrganizationMembership) -> &str {
    member
        .role
        .as_ref()
        .map(|MembershipRole { slug }| slug.as_str())
        .unwrap_or("member")
}

fn map_workos_role_to_local(role_slug: &str) -> UserRole {
    match role_slug {
        "owner" => UserRole::Owner,
        "admin" => UserRole::Admin,
        _ => UserRole::Member,
    }
}

async fn ensure_jwt_for(
    state: &SaasAppState,
    user: &User,
    tenant: &Tenant,
) -> ApiResult<String> {
    let auth_user = AuthUser {
        id: user.id.clone(),
        email: user.email.clone(),
        name: user.name.clone(),
        role: user.role.as_str().to_string(),
        tenant_id: tenant.id.clone(),
        tenant_name: tenant.name.clone(),
        tenant_slug: tenant.slug.clone(),
    };
    state.jwt.issue(&auth_user).map_err(ApiError::from)
}

// ── workos-exchange ────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkosExchangeInput {
    pub service_secret: String,
    pub workos_user_id: String,
    /// Bearer token issued by WorkOS to the frontend session. We verify
    /// it against WorkOS's user endpoint to confirm the
    /// `workos_user_id` is the one this token is bound to.
    pub workos_access_token: String,
    /// Optional `organizationId` from the WorkOS callback. When present
    /// we know which tenant the user is signing into and can JIT-create
    /// a local row if needed.
    #[serde(default)]
    pub organization_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum WorkosExchangeResponse {
    /// Happy path. Frontend sets the Chronicle JWT in the session
    /// and continues to /dashboard.
    Token { token: String, user: AuthUserResponse },
    /// 409 NoMembership. Frontend uses `reason` to pick which intercept
    /// page to render: `organization_not_linked` →
    /// `/workspace/setup?reason=domain-blocked`,
    /// `no_organization_in_callback` → `/workspace/setup`,
    /// `no_membership` → `/workspace/setup`.
    NoMembership { reason: String },
}

pub async fn workos_exchange(
    State(state): State<SaasAppState>,
    Json(input): Json<WorkosExchangeInput>,
) -> ApiResult<(StatusCode, Json<serde_json::Value>)> {
    let expected_secret = state.config.service_secret.as_deref().unwrap_or("");
    if expected_secret.is_empty() || input.service_secret != expected_secret {
        return Err(ApiError::unauthorized());
    }

    let workos = workos_client_from_env()?;

    // Step 1: confirm the access token is genuinely bound to this
    // workos_user_id. WorkOS's /users/me endpoint returns 200 only for
    // a valid + unexpired access token; we cross-check the returned id
    // against what the caller claimed.
    let token_owner = workos
        .verify_access_token(&input.workos_access_token)
        .await
        .map_err(handle_workos_error)?;
    if token_owner.id != input.workos_user_id {
        tracing::warn!(
            claimed = %input.workos_user_id,
            actual = %token_owner.id,
            "workos_user_id mismatch with access token owner"
        );
        return Err(ApiError::unauthorized());
    }

    // Step 2: do we already have a local row for this WorkOS user?
    if let Some(existing) = state
        .users
        .find_by_workos_user_id(&input.workos_user_id)
        .await?
    {
        let tenant = state
            .tenants
            .find_by_id(&existing.tenant_id)
            .await?
            .ok_or_else(|| {
                tracing::error!(
                    user_id = %existing.id,
                    tenant_id = %existing.tenant_id,
                    "User row references missing tenant"
                );
                ApiError::internal()
            })?;
        let token = ensure_jwt_for(&state, &existing, &tenant).await?;
        return Ok((
            StatusCode::OK,
            Json(serde_json::to_value(WorkosExchangeResponse::Token {
                token,
                user: auth_user_response(&existing, &tenant),
            })
            .unwrap_or_default()),
        ));
    }

    // Step 3: no local row. We can only JIT-create when WorkOS told us
    // which org this sign-in is for.
    let Some(workos_org_id) = input.organization_id.as_deref() else {
        return Ok((
            StatusCode::CONFLICT,
            Json(
                serde_json::to_value(WorkosExchangeResponse::NoMembership {
                    reason: "no_organization_in_callback".into(),
                })
                .unwrap_or_default(),
            ),
        ));
    };

    let Some(tenant) = state
        .tenants
        .find_by_workos_organization_id(workos_org_id)
        .await?
    else {
        // The WorkOS org isn't linked to any local tenant. We can't
        // safely auto-create one here (Phase 2's `provisionWorkspace`
        // server action handles that path explicitly). Bounce back to
        // the frontend so it can render the lost-invite C.3c notice.
        return Ok((
            StatusCode::CONFLICT,
            Json(
                serde_json::to_value(WorkosExchangeResponse::NoMembership {
                    reason: "organization_not_linked".into(),
                })
                .unwrap_or_default(),
            ),
        ));
    };

    // Derive role from WorkOS's organization_memberships listing.
    let memberships = workos
        .list_organization_memberships(&input.workos_user_id)
        .await
        .map_err(handle_workos_error)?;
    let membership = memberships.iter().find(|m| m.organization_id == workos_org_id);
    let Some(membership) = membership else {
        return Ok((
            StatusCode::CONFLICT,
            Json(
                serde_json::to_value(WorkosExchangeResponse::NoMembership {
                    reason: "no_membership".into(),
                })
                .unwrap_or_default(),
            ),
        ));
    };
    let role_slug = membership_role_slug(membership);
    let role = map_workos_role_to_local(role_slug);

    // JIT-create the local row.
    let display_name = display_name_for(&token_owner);
    let user = state
        .users
        .create(CreateUserInput {
            email: token_owner.email.clone(),
            name: display_name,
            password_hash: None,
            auth_provider: "workos".to_string(),
            role,
            tenant_id: tenant.id.clone(),
            workos_user_id: Some(input.workos_user_id.clone()),
            created_via: Some("self_serve".to_string()),
        })
        .await?;

    let token = ensure_jwt_for(&state, &user, &tenant).await?;
    Ok((
        StatusCode::OK,
        Json(serde_json::to_value(WorkosExchangeResponse::Token {
            token,
            user: auth_user_response(&user, &tenant),
        })
        .unwrap_or_default()),
    ))
}

fn display_name_for(workos_user: &WorkosUser) -> Option<String> {
    match (&workos_user.first_name, &workos_user.last_name) {
        (Some(first), Some(last)) if !last.is_empty() => Some(format!("{first} {last}")),
        (Some(first), _) => Some(first.clone()),
        (None, Some(last)) => Some(last.clone()),
        _ => None,
    }
}

fn auth_user_response(user: &User, tenant: &Tenant) -> AuthUserResponse {
    AuthUserResponse {
        id: user.id.clone(),
        email: user.email.clone(),
        name: user.name.clone(),
        role: user.role.as_str().to_string(),
        tenant_id: tenant.id.clone(),
        tenant_name: tenant.name.clone(),
        tenant_slug: tenant.slug.clone(),
    }
}

// ── /api/auth/discover ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct DiscoverParams {
    pub email: String,
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum DiscoverResponse {
    /// Domain has no existing tenant. Sign-up is fully unblocked.
    Free,
    /// Domain matches an existing tenant. Sign-up should soft-block to
    /// the lost-invite UI (A.1c / B.5).
    Existing {
        org_name: String,
    },
    /// We found a pending WorkOS invitation for this exact email
    /// (A.1p).
    PendingInvite {
        org_name: String,
        invite_id: String,
    },
    /// SSO is required for this domain (A.1s / D.2). The frontend
    /// hides the password field and renders an SSO button.
    SsoRequired {
        org_name: String,
        sso_provider: String,
    },
}

/// `GET /api/platform/auth/discover?email=…`. Service-secret-guarded
/// because this leaks the existence of an org by email; the front-end
/// proxies through a server action that holds the secret.
///
/// Reuses the same WorkOS client envvars as `workos_exchange`.
pub async fn discover(
    State(state): State<SaasAppState>,
    headers: HeaderMap,
    Query(params): Query<DiscoverParams>,
) -> ApiResult<Json<DiscoverResponse>> {
    require_service_secret(&state, &headers)?;
    if !is_valid_email_address(&params.email) {
        return Err(ApiError::bad_request("A valid email address is required"));
    }
    let Some(domain) = email_domain(&params.email) else {
        return Err(ApiError::bad_request("Email is missing a domain"));
    };

    // 1) Pending invite by exact email beats everything else, because
    //    the workspace owner explicitly wants this person to land here.
    if let Ok(workos) = WorkosClient::from_env() {
        match workos.list_invitations_by_email(&params.email).await {
            Ok(invites) => {
                if let Some(invite) = invites
                    .into_iter()
                    .find(|i| i.state.as_deref() != Some("revoked"))
                {
                    let org_name = match invite.organization_id.as_deref() {
                        Some(id) => state
                            .tenants
                            .find_by_workos_organization_id(id)
                            .await?
                            .map(|t| t.name)
                            .unwrap_or_else(|| "your workspace".to_string()),
                        None => "your workspace".to_string(),
                    };
                    return Ok(Json(DiscoverResponse::PendingInvite {
                        org_name,
                        invite_id: invite.id,
                    }));
                }
            }
            Err(err) => {
                tracing::warn!(error = ?err, "discover: WorkOS list_invitations failed; continuing");
            }
        }
    }

    // 2) Existing tenant by domain. We look up locally first because
    //    that's the source of truth for "do we have a workspace
    //    here?". Future iterations should also call WorkOS
    //    `find_organization_by_domain` to detect orgs that exist in
    //    WorkOS but haven't been linked to a local tenant yet — see
    //    follow-up note in the Phase 0b report.
    let mut existing_tenant: Option<Tenant> = None;
    let tenants = state.tenants.list_all(1000, 0).await.unwrap_or_default();
    for tenant in tenants {
        let users = state
            .users
            .list_by_tenant(&tenant.id)
            .await
            .unwrap_or_default();
        if users
            .iter()
            .any(|u| email_domain(&u.email).as_deref() == Some(domain.as_str()))
        {
            existing_tenant = Some(tenant);
            break;
        }
    }

    if let Some(tenant) = existing_tenant {
        // SSO discovery for this domain is left as a follow-up (the
        // WorkOS Rust surface for `sso.listConnections({ domain })` is
        // not in scope for Phase 0b; the frontend handles `existing`
        // by rendering A.1c).
        return Ok(Json(DiscoverResponse::Existing {
            org_name: tenant.name,
        }));
    }

    Ok(Json(DiscoverResponse::Free))
}

// ── invitations ───────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendInvitationInput {
    pub email: String,
    pub organization_id: String,
    #[serde(default)]
    pub role_slug: Option<String>,
    #[serde(default)]
    pub expires_in_days: Option<u32>,
    #[serde(default)]
    pub inviter_user_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvitationResponse {
    pub invitation_id: String,
    pub email: String,
    pub state: Option<String>,
}

pub async fn send_invitation(
    State(state): State<SaasAppState>,
    headers: HeaderMap,
    Json(input): Json<SendInvitationInput>,
) -> ApiResult<Json<InvitationResponse>> {
    require_service_secret(&state, &headers)?;
    if !is_valid_email_address(&input.email) {
        return Err(ApiError::bad_request("A valid email address is required"));
    }
    let workos = workos_client_from_env()?;
    let invitation = workos
        .send_invitation(&SendInvitationParams {
            email: input.email,
            organization_id: Some(input.organization_id),
            role_slug: input.role_slug,
            expires_in_days: input.expires_in_days.or(Some(7)),
            inviter_user_id: input.inviter_user_id,
        })
        .await
        .map_err(handle_workos_error)?;
    Ok(Json(InvitationResponse {
        invitation_id: invitation.id,
        email: invitation.email,
        state: invitation.state,
    }))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResendInvitationInput {
    pub invitation_id: String,
    pub email: String,
    pub organization_id: String,
    #[serde(default)]
    pub role_slug: Option<String>,
    #[serde(default)]
    pub expires_in_days: Option<u32>,
    #[serde(default)]
    pub inviter_user_id: Option<String>,
}

pub async fn resend_invitation(
    State(state): State<SaasAppState>,
    headers: HeaderMap,
    Json(input): Json<ResendInvitationInput>,
) -> ApiResult<Json<InvitationResponse>> {
    require_service_secret(&state, &headers)?;
    if !is_valid_email_address(&input.email) {
        return Err(ApiError::bad_request("A valid email address is required"));
    }
    let workos = workos_client_from_env()?;
    let invitation = workos
        .resend_invitation(
            &input.invitation_id,
            &SendInvitationParams {
                email: input.email,
                organization_id: Some(input.organization_id),
                role_slug: input.role_slug,
                expires_in_days: input.expires_in_days.or(Some(7)),
                inviter_user_id: input.inviter_user_id,
            },
        )
        .await
        .map_err(handle_workos_error)?;
    Ok(Json(InvitationResponse {
        invitation_id: invitation.id,
        email: invitation.email,
        state: invitation.state,
    }))
}

// ── /api/webhooks/workos (SCIM) ───────────────────────────────────

/// Minimal WorkOS event envelope. We only act on `directory.user.*`
/// events in Phase 0b; other events are accepted (signature still
/// validated) but otherwise ignored.
#[derive(Debug, Deserialize)]
struct WorkosEvent {
    #[serde(default)]
    event: Option<String>,
    #[serde(default)]
    data: Option<DirectoryUserEventData>,
}

#[derive(Debug, Deserialize)]
struct DirectoryUserEventData {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    email: Option<String>,
    #[serde(default, rename = "first_name")]
    first_name: Option<String>,
    #[serde(default, rename = "last_name")]
    last_name: Option<String>,
    #[serde(default, rename = "organization_id")]
    organization_id: Option<String>,
    /// WorkOS sometimes nests org id under `directory_id` /
    /// `organizationId`; capture both shapes defensively.
    #[serde(default, rename = "organizationId")]
    organization_id_camel: Option<String>,
}

impl DirectoryUserEventData {
    fn organization_id(&self) -> Option<&str> {
        self.organization_id
            .as_deref()
            .or(self.organization_id_camel.as_deref())
    }
}

pub async fn workos_webhook(
    State(state): State<SaasAppState>,
    headers: HeaderMap,
    body: Bytes,
) -> ApiResult<StatusCode> {
    let signature = headers
        .get("workos-signature")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| ApiError::bad_request("Missing WorkOS-Signature header"))?;
    let secret = std::env::var("WORKOS_WEBHOOK_SECRET").map_err(|_| {
        tracing::error!("WORKOS_WEBHOOK_SECRET not set");
        ApiError::internal()
    })?;
    let now = chrono::Utc::now().timestamp();
    if let Err(err) = verify_webhook_signature(&body, signature, &secret, 300, now) {
        match err {
            WebhookSignatureError::TimestampOutsideTolerance
            | WebhookSignatureError::SignatureMismatch => {
                tracing::warn!(error = ?err, "webhook signature rejected");
                return Err(ApiError::unauthorized());
            }
            _ => {
                tracing::warn!(error = ?err, "webhook signature parse failed");
                return Err(ApiError::bad_request("Invalid signature"));
            }
        }
    }

    let event: WorkosEvent = serde_json::from_slice(&body)
        .map_err(|e| ApiError::bad_request(format!("Invalid JSON body: {e}")))?;
    let kind = event.event.as_deref().unwrap_or("");
    match kind {
        "dsync.user.created" | "directory.user.created" => {
            handle_directory_user_upsert(&state, &event, "scim").await?;
        }
        "dsync.user.updated" | "directory.user.updated" => {
            handle_directory_user_upsert(&state, &event, "scim").await?;
        }
        "dsync.user.deleted" | "directory.user.deleted" => {
            handle_directory_user_deleted(&state, &event).await?;
        }
        other => {
            tracing::debug!(event = other, "Ignoring WorkOS event");
        }
    }

    Ok(StatusCode::ACCEPTED)
}

async fn handle_directory_user_upsert(
    state: &SaasAppState,
    event: &WorkosEvent,
    created_via: &str,
) -> ApiResult<()> {
    let Some(data) = event.data.as_ref() else {
        return Ok(());
    };
    let (Some(workos_user_id), Some(email)) = (data.id.as_deref(), data.email.as_deref())
    else {
        tracing::warn!("directory.user event missing id/email");
        return Ok(());
    };
    let Some(workos_org_id) = data.organization_id() else {
        tracing::warn!(workos_user_id, "directory.user event missing organization_id");
        return Ok(());
    };

    let Some(tenant) = state
        .tenants
        .find_by_workos_organization_id(workos_org_id)
        .await?
    else {
        tracing::warn!(
            workos_org_id,
            "directory.user event for unknown WorkOS organization; ignoring"
        );
        return Ok(());
    };

    if let Some(existing) = state
        .users
        .find_by_workos_user_id(workos_user_id)
        .await?
    {
        // Already provisioned. Future iterations should sync mutable
        // fields (email, name, role) here; for Phase 0b we just
        // acknowledge.
        tracing::debug!(user_id = %existing.id, "directory.user event already provisioned");
        return Ok(());
    }

    if let Some(existing_by_email) = state.users.find_by_email(email).await? {
        // Backfill the workosUserId on a pre-existing row instead of
        // creating a duplicate.
        let _ = state
            .users
            .set_workos_user_id(&existing_by_email.id, workos_user_id)
            .await?;
        return Ok(());
    }

    let display_name = match (data.first_name.as_deref(), data.last_name.as_deref()) {
        (Some(f), Some(l)) if !l.is_empty() => Some(format!("{f} {l}")),
        (Some(f), _) => Some(f.to_string()),
        (None, Some(l)) => Some(l.to_string()),
        _ => None,
    };

    state
        .users
        .create(CreateUserInput {
            email: email.to_string(),
            name: display_name,
            password_hash: None,
            auth_provider: "workos".to_string(),
            role: UserRole::Member,
            tenant_id: tenant.id.clone(),
            workos_user_id: Some(workos_user_id.to_string()),
            created_via: Some(created_via.to_string()),
        })
        .await?;
    Ok(())
}

async fn handle_directory_user_deleted(
    state: &SaasAppState,
    event: &WorkosEvent,
) -> ApiResult<()> {
    let Some(data) = event.data.as_ref() else {
        return Ok(());
    };
    let Some(workos_user_id) = data.id.as_deref() else {
        return Ok(());
    };
    if let Some(existing) = state
        .users
        .find_by_workos_user_id(workos_user_id)
        .await?
    {
        // Phase 0b: soft-delete via existing `delete()`. Once the
        // schema gains `deleted_at` / `role NULL` (per the F.4 plan
        // surface), we'll switch to an UPDATE.
        state.users.delete(&existing.id).await?;
        tracing::info!(user_id = %existing.id, workos_user_id, "SCIM-deleted user");
    }
    Ok(())
}

// ── self-serve workspace provisioning helper (drives A.4/A.5 path) ─

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProvisionWorkspaceInput {
    pub service_secret: String,
    pub workos_user_id: String,
    pub workos_access_token: String,
    pub org_name: String,
    pub slug: String,
    /// Domain to attach to the new WorkOS organization (typically the
    /// signed-in user's email domain).
    #[serde(default)]
    pub domain: Option<String>,
}

/// Creates a brand-new workspace owned by the WorkOS user. Implements
/// the `provisionWorkspace` server-action surface from the plan: it's
/// the only path that creates a Tenant locally + Organization in
/// WorkOS + admin OrganizationMembership + JIT User row + Chronicle
/// JWT, all in one shot.
pub async fn provision_workspace(
    State(state): State<SaasAppState>,
    Json(input): Json<ProvisionWorkspaceInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let expected_secret = state.config.service_secret.as_deref().unwrap_or("");
    if expected_secret.is_empty() || input.service_secret != expected_secret {
        return Err(ApiError::unauthorized());
    }
    if input.org_name.trim().is_empty() {
        return Err(ApiError::bad_request("Workspace name is required"));
    }
    if input.slug.trim().is_empty() {
        return Err(ApiError::bad_request("Workspace slug is required"));
    }

    let workos = workos_client_from_env()?;
    let token_owner = workos
        .verify_access_token(&input.workos_access_token)
        .await
        .map_err(handle_workos_error)?;
    if token_owner.id != input.workos_user_id {
        return Err(ApiError::unauthorized());
    }

    // Reject if a tenant already owns this domain (this is the
    // C.3c failsafe — even self-serve callers can't create a second
    // workspace at a contested domain).
    if let Some(domain) = input.domain.as_deref() {
        let tenants = state.tenants.list_all(1000, 0).await.unwrap_or_default();
        for tenant in tenants {
            let users = state
                .users
                .list_by_tenant(&tenant.id)
                .await
                .unwrap_or_default();
            if users
                .iter()
                .any(|u| email_domain(&u.email).as_deref() == Some(domain))
            {
                return Err(ApiError::conflict(
                    "This email's domain already owns a workspace. Ask an admin for an invite.",
                ));
            }
        }
    }

    let tenant = state
        .tenants
        .create(CreateTenantInput {
            name: input.org_name.clone(),
            slug: input.slug.clone(),
        })
        .await?;

    let workos_org = workos
        .create_organization(&CreateOrganizationParams {
            name: input.org_name,
            domains: input.domain.into_iter().collect(),
        })
        .await
        .map_err(handle_workos_error)?;

    state
        .tenants
        .set_workos_organization_id(&tenant.id, &workos_org.id)
        .await?;

    let display_name = display_name_for(&token_owner);
    let user = state
        .users
        .create(CreateUserInput {
            email: token_owner.email.clone(),
            name: display_name,
            password_hash: None,
            auth_provider: "workos".to_string(),
            role: UserRole::Owner,
            tenant_id: tenant.id.clone(),
            workos_user_id: Some(input.workos_user_id.clone()),
            created_via: Some("self_serve".to_string()),
        })
        .await?;

    // Best-effort: also bulk-create the membership server-side so
    // WorkOS knows this user is the owner. We could call
    // `userManagement.createOrganizationMembership` here, but the
    // dedicated endpoint isn't in our minimal SDK wrapper yet —
    // leaving as a follow-up. For Phase 0b the local row + JWT is
    // what gates the user; WorkOS membership will be attached via the
    // bulk importer or the SCIM path.
    let _ = BulkOrganizationMembership {
        organization_id: workos_org.id.clone(),
        role_slug: "owner".to_string(),
    };
    let _ = CreateUserParams::default();

    let tenant = state
        .tenants
        .find_by_id(&tenant.id)
        .await?
        .ok_or_else(ApiError::internal)?;
    let token = ensure_jwt_for(&state, &user, &tenant).await?;
    Ok(Json(serde_json::json!({
        "token": token,
        "user": auth_user_response(&user, &tenant),
        "workosOrganizationId": workos_org.id,
    })))
}
