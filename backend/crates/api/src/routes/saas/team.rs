use axum::{
    extract::{Path, State},
    Json,
};
use chronicle_domain::{CreateInvitationInput, CreateUserInput, Invitation, User, UserRole};
use chronicle_interfaces::email::{EmailTag, TemplateEmailParams};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::error::{ApiError, ApiResult};
use crate::saas_state::SaasAppState;
use crate::workos_user::WorkosAuthUser;

fn require_admin(user: &WorkosAuthUser) -> Result<(), ApiError> {
    if !user.role().has_admin_access() {
        return Err(ApiError::forbidden("Admin or Owner role required"));
    }
    Ok(())
}

fn require_owner(user: &WorkosAuthUser) -> Result<(), ApiError> {
    if !user.role().is_owner() {
        return Err(ApiError::forbidden("Owner role required"));
    }
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamMembersResponse {
    pub members: Vec<User>,
    pub invitations: Vec<Invitation>,
}

pub async fn list_members(
    user: WorkosAuthUser,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<TeamMembersResponse>> {
    let tenant_id = user.tenant_id();
    // List by membership rather than User.tenantId so the surface reflects
    // the multi-org model (active members of *this* tenant only).
    let memberships = state.memberships.list_by_tenant(tenant_id).await?;
    let mut members = Vec::with_capacity(memberships.len());
    for m in memberships {
        if m.status != chronicle_domain::MembershipStatus::Active {
            continue;
        }
        if let Some(u) = state.users.find_by_id(&m.user_id).await? {
            members.push(u);
        }
    }
    let invitations = state.invitations.list_by_tenant(tenant_id).await?;
    Ok(Json(TeamMembersResponse {
        members,
        invitations,
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InviteRequest {
    pub email: String,
    pub role: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InviteResponse {
    pub invitation: Invitation,
    pub email_sent: bool,
}

pub async fn invite_member(
    user: WorkosAuthUser,
    State(state): State<SaasAppState>,
    Json(input): Json<InviteRequest>,
) -> ApiResult<Json<InviteResponse>> {
    require_admin(&user)?;

    let tenant_id = user.tenant_id().to_string();

    if input.email.trim().is_empty() || !input.email.contains('@') {
        return Err(ApiError::bad_request("A valid email address is required"));
    }

    // Block re-invite if the user is *already a member of this tenant*.
    // Multi-org is allowed, so being in another tenant is fine.
    if let Some(existing) = state.users.find_by_email(&input.email).await? {
        if state
            .memberships
            .find(&existing.id, &tenant_id)
            .await?
            .map(|m| m.status == chronicle_domain::MembershipStatus::Active)
            .unwrap_or(false)
        {
            return Err(ApiError::conflict(
                "User is already a member of this organization",
            ));
        }
    }

    let role = input
        .role
        .and_then(|r| r.parse().ok())
        .unwrap_or(UserRole::Member);

    if role.is_owner() {
        return Err(ApiError::bad_request("Cannot invite with Owner role"));
    }

    let invitation = state
        .invitations
        .create(CreateInvitationInput {
            tenant_id: tenant_id.clone(),
            email: input.email.clone(),
            role: role.clone(),
            invited_by: user.user.id.clone(),
        })
        .await?;

    let app_url = state.config.app_url.clone();
    let accept_url = format!("{app_url}/invite/{}", invitation.token);

    let inviter_name = user
        .user
        .name
        .clone()
        .unwrap_or_else(|| user.user.email.clone());

    let tenant_name = user.tenant.name.clone();

    let mut variables = HashMap::new();
    variables.insert("ORG_NAME".to_string(), tenant_name.clone());
    variables.insert("INVITER_NAME".to_string(), inviter_name);
    variables.insert("ACCEPT_URL".to_string(), accept_url);
    variables.insert("ROLE".to_string(), role.as_str().to_string());
    variables.insert("INVITEE_EMAIL".to_string(), input.email.clone());

    let email_sent = state
        .email
        .send_template_email(TemplateEmailParams {
            to: input.email,
            subject: format!(
                "You've been invited to join {} on Chronicle Labs",
                tenant_name
            ),
            template_key: "team-invite".to_string(),
            variables,
            idempotency_key: Some(format!("team-invite/{}", invitation.id)),
            tags: vec![
                EmailTag {
                    name: "email_type".to_string(),
                    value: "team-invite".to_string(),
                },
                EmailTag {
                    name: "tenant_id".to_string(),
                    value: tenant_id,
                },
                EmailTag {
                    name: "invitation_id".to_string(),
                    value: invitation.id.clone(),
                },
            ],
        })
        .await
        .is_ok();

    Ok(Json(InviteResponse {
        invitation,
        email_sent,
    }))
}

pub async fn remove_member(
    user: WorkosAuthUser,
    State(state): State<SaasAppState>,
    Path(user_id): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    require_admin(&user)?;

    if user_id == user.user.id {
        return Err(ApiError::bad_request("Cannot remove yourself"));
    }

    let tenant_id = user.tenant_id().to_string();

    // Target must have an active membership in *this* tenant.
    let target_membership = state
        .memberships
        .find(&user_id, &tenant_id)
        .await?
        .ok_or_else(|| ApiError::not_found("User"))?;

    if target_membership.role.is_owner() {
        return Err(ApiError::bad_request(
            "Cannot remove the organization owner",
        ));
    }

    // The user's *primary* org (User.tenantId) is the workspace they were
    // assigned to at account creation. It cannot be removed from them — it's
    // their permanent home. Other memberships are detachable freely.
    let target_user = state
        .users
        .find_by_id(&user_id)
        .await?
        .ok_or_else(|| ApiError::not_found("User"))?;
    if target_user.tenant_id == tenant_id {
        return Err(ApiError::bad_request(
            "Cannot remove a member from their primary organization",
        ));
    }

    // Multi-org: removing from this tenant deletes only the membership row.
    // The User record stays so they retain access to their other tenants.
    state.memberships.delete(&user_id, &tenant_id).await?;
    Ok(Json(serde_json::json!({ "removed": true })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRoleRequest {
    pub role: String,
}

pub async fn update_member_role(
    user: WorkosAuthUser,
    State(state): State<SaasAppState>,
    Path(user_id): Path<String>,
    Json(input): Json<UpdateRoleRequest>,
) -> ApiResult<Json<User>> {
    require_owner(&user)?;

    if user_id == user.user.id {
        return Err(ApiError::bad_request("Cannot change your own role"));
    }

    let tenant_id = user.tenant_id().to_string();

    // Target must be an active member of this tenant.
    state
        .memberships
        .find(&user_id, &tenant_id)
        .await?
        .ok_or_else(|| ApiError::not_found("User"))?;

    let new_role: UserRole = input
        .role
        .parse()
        .map_err(|_| ApiError::bad_request("Invalid role. Must be: owner, admin, or member"))?;

    state
        .memberships
        .update(&user_id, &tenant_id, None, Some(new_role))
        .await?;

    let updated = state
        .users
        .find_by_id(&user_id)
        .await?
        .ok_or_else(|| ApiError::not_found("User"))?;
    Ok(Json(updated))
}

#[derive(Deserialize)]
pub struct AcceptInviteParams {
    pub token: String,
}

pub async fn accept_invite(
    State(state): State<SaasAppState>,
    Path(token): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    let invitation = state
        .invitations
        .find_by_token(&token)
        .await?
        .ok_or_else(|| ApiError::not_found("Invitation"))?;

    if invitation.accepted_at.is_some() {
        return Err(ApiError::bad_request(
            "Invitation has already been accepted",
        ));
    }

    if invitation.expires_at < chrono::Utc::now() {
        return Err(ApiError::bad_request("Invitation has expired"));
    }

    if let Some(existing) = state.users.find_by_email(&invitation.email).await? {
        if existing.tenant_id == invitation.tenant_id {
            state.invitations.mark_accepted(&invitation.id).await?;
            return Ok(Json(
                serde_json::json!({ "accepted": true, "existing_member": true }),
            ));
        }
        return Err(ApiError::bad_request(
            "Email is already registered to a different organization",
        ));
    }

    state
        .users
        .create(CreateUserInput {
            email: invitation.email.clone(),
            name: None,
            password_hash: None,
            auth_provider: "google".to_string(),
            role: invitation.role.clone(),
            tenant_id: invitation.tenant_id.clone(),
            workos_user_id: None,
            created_via: Some("invite".to_string()),
        })
        .await?;

    state.invitations.mark_accepted(&invitation.id).await?;

    Ok(Json(
        serde_json::json!({ "accepted": true, "existing_member": false }),
    ))
}
