use axum::{body::Bytes, extract::State, http::HeaderMap, http::StatusCode};
use chronicle_auth::workos::{verify_webhook_signature, WebhookSignatureError};
use chronicle_domain::{
    CreateTenantMembershipInput, CreateUserInput, MembershipStatus, UserRole,
};
use serde::Deserialize;

use super::error::{ApiError, ApiResult};
use crate::saas_state::SaasAppState;

#[derive(Debug, Deserialize)]
struct WorkosEvent {
    #[serde(default)]
    event: Option<String>,
    #[serde(default)]
    data: Option<serde_json::Value>,
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

#[derive(Debug, Deserialize)]
struct OrganizationMembershipEventData {
    #[serde(default, rename = "user_id")]
    user_id: Option<String>,
    #[serde(default, rename = "userId")]
    user_id_camel: Option<String>,
    #[serde(default, rename = "organization_id")]
    organization_id: Option<String>,
    #[serde(default, rename = "organizationId")]
    organization_id_camel: Option<String>,
    /// `role` may be a bare string (e.g. `"admin"`) or an object
    /// `{"slug": "admin"}` — accept both.
    #[serde(default)]
    role: Option<serde_json::Value>,
    #[serde(default)]
    status: Option<String>,
}

impl OrganizationMembershipEventData {
    fn user_id(&self) -> Option<&str> {
        self.user_id
            .as_deref()
            .or(self.user_id_camel.as_deref())
    }

    fn organization_id(&self) -> Option<&str> {
        self.organization_id
            .as_deref()
            .or(self.organization_id_camel.as_deref())
    }

    fn role_slug(&self) -> Option<String> {
        match self.role.as_ref()? {
            serde_json::Value::String(s) => Some(s.clone()),
            serde_json::Value::Object(o) => o
                .get("slug")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            _ => None,
        }
    }
}

/// Payload of `invitation.accepted` events. Only the org id, user id, and
/// invitee email are needed for our sync logic.
#[derive(Debug, Deserialize)]
struct InvitationEventData {
    #[serde(default, rename = "organization_id")]
    organization_id: Option<String>,
    #[serde(default, rename = "organizationId")]
    organization_id_camel: Option<String>,
    /// Set on `invitation.accepted` after WorkOS auto-creates the membership.
    #[serde(default, rename = "accepted_user_id")]
    accepted_user_id: Option<String>,
    #[serde(default, rename = "acceptedUserId")]
    accepted_user_id_camel: Option<String>,
    #[serde(default)]
    email: Option<String>,
    #[serde(default, rename = "role_slug")]
    role_slug: Option<String>,
    #[serde(default, rename = "roleSlug")]
    role_slug_camel: Option<String>,
}

impl InvitationEventData {
    fn organization_id(&self) -> Option<&str> {
        self.organization_id
            .as_deref()
            .or(self.organization_id_camel.as_deref())
    }

    fn user_id(&self) -> Option<&str> {
        self.accepted_user_id
            .as_deref()
            .or(self.accepted_user_id_camel.as_deref())
    }

    fn role_slug(&self) -> Option<&str> {
        self.role_slug
            .as_deref()
            .or(self.role_slug_camel.as_deref())
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
        "organization_membership.created" | "organization_membership.updated" => {
            handle_membership_upsert(&state, &event).await?;
        }
        "organization_membership.deleted" => {
            handle_membership_deleted(&state, &event).await?;
        }
        "invitation.accepted" => {
            handle_invitation_accepted(&state, &event).await?;
        }
        other => {
            tracing::debug!(event = other, "Ignoring WorkOS event");
        }
    }

    Ok(StatusCode::ACCEPTED)
}

fn parse_event_data<T: serde::de::DeserializeOwned>(
    raw: Option<&serde_json::Value>,
) -> Option<T> {
    let raw = raw?;
    serde_json::from_value(raw.clone()).ok()
}

async fn handle_directory_user_upsert(
    state: &SaasAppState,
    event: &WorkosEvent,
    created_via: &str,
) -> ApiResult<()> {
    let Some(data) = parse_event_data::<DirectoryUserEventData>(event.data.as_ref()) else {
        tracing::warn!("directory.user event payload missing or malformed");
        return Ok(());
    };
    let (Some(workos_user_id), Some(email)) = (data.id.as_deref(), data.email.as_deref()) else {
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

    if let Some(existing) = state.users.find_by_workos_user_id(workos_user_id).await? {
        tracing::debug!(user_id = %existing.id, "directory.user event already provisioned");
        return Ok(());
    }

    if let Some(existing_by_email) = state.users.find_by_email(email).await? {
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
    let Some(data) = parse_event_data::<DirectoryUserEventData>(event.data.as_ref()) else {
        return Ok(());
    };
    let Some(workos_user_id) = data.id.as_deref() else {
        return Ok(());
    };
    if let Some(existing) = state.users.find_by_workos_user_id(workos_user_id).await? {
        state.users.delete(&existing.id).await?;
        tracing::info!(user_id = %existing.id, workos_user_id, "SCIM-deleted user");
    }
    Ok(())
}

fn parse_role(slug: Option<&str>) -> UserRole {
    match slug {
        Some("owner") => UserRole::Owner,
        Some("admin") => UserRole::Admin,
        _ => UserRole::Member,
    }
}

fn parse_status(value: Option<&str>) -> MembershipStatus {
    match value {
        Some("pending") => MembershipStatus::Pending,
        Some("inactive") => MembershipStatus::Inactive,
        _ => MembershipStatus::Active,
    }
}

async fn handle_membership_upsert(
    state: &SaasAppState,
    event: &WorkosEvent,
) -> ApiResult<()> {
    let Some(data) = parse_event_data::<OrganizationMembershipEventData>(event.data.as_ref())
    else {
        tracing::warn!("organization_membership event payload missing or malformed");
        return Ok(());
    };
    let Some(workos_user_id) = data.user_id() else {
        tracing::warn!("organization_membership event missing user_id");
        return Ok(());
    };
    let Some(workos_org_id) = data.organization_id() else {
        tracing::warn!("organization_membership event missing organization_id");
        return Ok(());
    };

    let Some(tenant) = state
        .tenants
        .find_by_workos_organization_id(workos_org_id)
        .await?
    else {
        tracing::warn!(
            workos_org_id,
            "organization_membership event for unknown tenant; ignoring"
        );
        return Ok(());
    };

    let Some(user) = state.users.find_by_workos_user_id(workos_user_id).await? else {
        tracing::warn!(
            workos_user_id,
            workos_org_id,
            "organization_membership event for unknown user; ignoring (user should have been created via directory.user.* first)"
        );
        return Ok(());
    };

    let role = parse_role(data.role_slug().as_deref());
    let status = parse_status(data.status.as_deref());

    // upsert is a no-op if the row already exists; we explicitly call update
    // so that the .updated event can move status/role.
    state
        .memberships
        .upsert(CreateTenantMembershipInput {
            user_id: user.id.clone(),
            tenant_id: tenant.id.clone(),
            role,
            status,
        })
        .await?;
    state
        .memberships
        .update(&user.id, &tenant.id, Some(status), Some(role))
        .await?;

    tracing::info!(
        user_id = %user.id,
        tenant_id = %tenant.id,
        role = %role,
        status = %status,
        "Synced organization_membership from WorkOS webhook",
    );
    Ok(())
}

async fn handle_membership_deleted(
    state: &SaasAppState,
    event: &WorkosEvent,
) -> ApiResult<()> {
    let Some(data) = parse_event_data::<OrganizationMembershipEventData>(event.data.as_ref())
    else {
        return Ok(());
    };
    let (Some(workos_user_id), Some(workos_org_id)) =
        (data.user_id(), data.organization_id())
    else {
        tracing::warn!("organization_membership.deleted missing ids");
        return Ok(());
    };

    let Some(tenant) = state
        .tenants
        .find_by_workos_organization_id(workos_org_id)
        .await?
    else {
        return Ok(());
    };
    let Some(user) = state.users.find_by_workos_user_id(workos_user_id).await? else {
        return Ok(());
    };

    // Idempotent: ignore "not found" so retries are safe.
    if let Err(err) = state.memberships.delete(&user.id, &tenant.id).await {
        match err {
            chronicle_interfaces::RepoError::NotFound(_) => {
                tracing::debug!(
                    user_id = %user.id,
                    tenant_id = %tenant.id,
                    "Membership already gone — webhook is idempotent",
                );
            }
            other => return Err(other.into()),
        }
    } else {
        tracing::info!(
            user_id = %user.id,
            tenant_id = %tenant.id,
            "Deleted organization_membership from WorkOS webhook",
        );
    }
    Ok(())
}

async fn handle_invitation_accepted(
    state: &SaasAppState,
    event: &WorkosEvent,
) -> ApiResult<()> {
    let Some(data) = parse_event_data::<InvitationEventData>(event.data.as_ref()) else {
        tracing::warn!("invitation.accepted event payload missing or malformed");
        return Ok(());
    };
    let Some(workos_org_id) = data.organization_id() else {
        // Application-wide invitations don't have an org and don't create
        // memberships — nothing to do locally.
        return Ok(());
    };
    let Some(workos_user_id) = data.user_id() else {
        tracing::warn!(
            workos_org_id,
            "invitation.accepted missing accepted_user_id; cannot sync membership",
        );
        return Ok(());
    };

    let Some(tenant) = state
        .tenants
        .find_by_workos_organization_id(workos_org_id)
        .await?
    else {
        tracing::warn!(
            workos_org_id,
            "invitation.accepted for unknown tenant; ignoring"
        );
        return Ok(());
    };

    let Some(user) = state.users.find_by_workos_user_id(workos_user_id).await? else {
        tracing::warn!(
            workos_user_id,
            workos_org_id,
            email = ?data.email,
            "invitation.accepted for unknown user; will be reconciled by organization_membership.created",
        );
        return Ok(());
    };

    let role = parse_role(data.role_slug());

    state
        .memberships
        .upsert(CreateTenantMembershipInput {
            user_id: user.id.clone(),
            tenant_id: tenant.id.clone(),
            role,
            status: MembershipStatus::Active,
        })
        .await?;

    tracing::info!(
        user_id = %user.id,
        tenant_id = %tenant.id,
        role = %role,
        "Synced invitation.accepted from WorkOS webhook",
    );
    Ok(())
}
