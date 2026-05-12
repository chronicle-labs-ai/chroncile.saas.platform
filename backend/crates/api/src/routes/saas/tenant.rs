use axum::{extract::State, Json};

use chronicle_domain::{
    CreateTenantInput, CreateTenantMembershipInput, CreateUserInput, MembershipStatus,
    TenantResponse, UpdateStripeRequest, UserRole,
};

use super::error::{ApiError, ApiResult};
use crate::saas_state::SaasAppState;
use crate::workos_user::WorkosAuthUser;

pub async fn get_tenant(
    user: WorkosAuthUser,
    State(_state): State<SaasAppState>,
) -> ApiResult<Json<TenantResponse>> {
    Ok(Json(TenantResponse {
        tenant: Some(user.tenant.clone()),
    }))
}

pub async fn update_tenant_stripe(
    user: WorkosAuthUser,
    State(state): State<SaasAppState>,
    Json(input): Json<UpdateStripeRequest>,
) -> ApiResult<Json<TenantResponse>> {
    let tenant = state
        .tenants
        .update_stripe_fields(
            user.tenant_id(),
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
    user: WorkosAuthUser,
    State(state): State<SaasAppState>,
    Json(input): Json<UpdateTenantNameRequest>,
) -> ApiResult<Json<TenantResponse>> {
    if !user.role().is_owner() {
        return Err(ApiError::forbidden(
            "Only the organization owner can rename the organization",
        ));
    }

    if input.name.trim().is_empty() {
        return Err(ApiError::bad_request("Organization name cannot be empty"));
    }

    let tenant = state
        .tenants
        .update_name(user.tenant_id(), &input.name)
        .await?;
    Ok(Json(TenantResponse {
        tenant: Some(tenant),
    }))
}

pub async fn delete_tenant(
    user: WorkosAuthUser,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<serde_json::Value>> {
    if !user.role().is_owner() {
        return Err(ApiError::forbidden(
            "Only the organization owner can delete the organization",
        ));
    }

    state.tenants.delete(user.tenant_id()).await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ---------------------------------------------------------------------------
// Lookup the primary tenant of a user by email (server-to-server).
//
// Used by the frontend login route when WorkOS replies with
// `organization_selection_required` (i.e. the user has multiple
// memberships). Each Chronicle user has a "primary" tenant — the one
// recorded on `User.tenantId` at account creation. By passing this org
// to `authenticateWithPassword({ organizationId })`, the frontend can
// transparently land the user in their primary workspace without a UI
// picker. Other workspaces remain reachable via the org-switcher.
//
// Auth: same `service_secret` pattern as `register_workos_tenant`.
// ---------------------------------------------------------------------------

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LookupPrimaryOrgInput {
    pub service_secret: String,
    pub email: String,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LookupPrimaryOrgResponse {
    pub tenant_id: Option<String>,
    pub workos_organization_id: Option<String>,
}

pub async fn lookup_primary_org(
    State(state): State<SaasAppState>,
    Json(input): Json<LookupPrimaryOrgInput>,
) -> ApiResult<Json<LookupPrimaryOrgResponse>> {
    let expected = state.config.service_secret.as_deref().unwrap_or("");
    if expected.is_empty() || input.service_secret != expected {
        return Err(ApiError::unauthorized());
    }
    if input.email.trim().is_empty() {
        return Err(ApiError::bad_request("email is required"));
    }

    let user = match state.users.find_by_email(&input.email).await? {
        Some(u) => u,
        None => {
            // No local user yet — caller will fall back to WorkOS's org list.
            return Ok(Json(LookupPrimaryOrgResponse {
                tenant_id: None,
                workos_organization_id: None,
            }));
        }
    };

    if user.tenant_id.trim().is_empty() {
        return Ok(Json(LookupPrimaryOrgResponse {
            tenant_id: None,
            workos_organization_id: None,
        }));
    }

    let tenant = state.tenants.find_by_id(&user.tenant_id).await?;
    Ok(Json(LookupPrimaryOrgResponse {
        tenant_id: Some(user.tenant_id),
        workos_organization_id: tenant.and_then(|t| t.workos_organization_id),
    }))
}

// ---------------------------------------------------------------------------
// Register a Tenant for an existing WorkOS Organization (CP 7.1).
//
// Called by the frontend's /api/onboarding/workspace route after it creates
// the Organization in WorkOS. The frontend already minted the Org via the
// WorkOS SDK; this endpoint just registers the local Chronicle counterpart
// (Tenant row + JIT User) and links them via `workos_organization_id`.
//
// Auth is server-to-server via `service_secret`. There is intentionally no
// JWT issuance here — that's the whole point of the WorkOS migration. The
// frontend already has the WorkOS access token and uses it directly when
// calling protected backend endpoints (validated by WorkosAuthUser, CP 7.4).
//
// Idempotent: re-running with the same `workos_organization_id` returns the
// existing tenant + user without creating duplicates.
// ---------------------------------------------------------------------------

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterWorkosTenantInput {
    pub service_secret: String,
    pub workos_user_id: String,
    pub workos_organization_id: String,
    pub email: String,
    /// Workspace display name (e.g. "Acme Industries").
    pub name: String,
    /// URL slug (e.g. "acme-industries"). Lowercase, alphanumeric + hyphens.
    pub slug: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterWorkosTenantResponse {
    pub tenant_id: String,
    pub user_id: String,
    /// True if this call created the tenant; false if it already existed.
    pub created: bool,
}

pub async fn register_workos_tenant(
    State(state): State<SaasAppState>,
    Json(input): Json<RegisterWorkosTenantInput>,
) -> ApiResult<Json<RegisterWorkosTenantResponse>> {
    // 1. Service-secret auth.
    let expected = state.config.service_secret.as_deref().unwrap_or("");
    if expected.is_empty() || input.service_secret != expected {
        return Err(ApiError::unauthorized());
    }

    // 2. Identity validation (always required).
    if input.workos_organization_id.trim().is_empty() {
        return Err(ApiError::bad_request("workosOrganizationId is required"));
    }
    if input.workos_user_id.trim().is_empty() {
        return Err(ApiError::bad_request("workosUserId is required"));
    }
    if input.email.trim().is_empty() {
        return Err(ApiError::bad_request("email is required"));
    }

    if let Some(existing_tenant) = state
        .tenants
        .find_by_workos_organization_id(&input.workos_organization_id)
        .await?
    {
        // Tenant already linked to this WorkOS org. We need to ensure the
        // user exists locally AND has an active membership in that tenant.
        // Membership upsert is idempotent — re-registering is a no-op.
        if let Some(existing_user) = state
            .users
            .find_by_workos_user_id(&input.workos_user_id)
            .await?
        {
            state
                .memberships
                .upsert(CreateTenantMembershipInput {
                    user_id: existing_user.id.clone(),
                    tenant_id: existing_tenant.id.clone(),
                    role: UserRole::Member,
                    status: MembershipStatus::Active,
                })
                .await?;
            return Ok(Json(RegisterWorkosTenantResponse {
                tenant_id: existing_tenant.id,
                user_id: existing_user.id,
                created: false,
            }));
        }

        if let Some(existing_user_by_email) =
            state.users.find_by_email(&input.email).await?
        {
            let resolved_user_id = match existing_user_by_email.workos_user_id.as_deref() {
                None => {
                    state
                        .users
                        .set_workos_user_id(&existing_user_by_email.id, &input.workos_user_id)
                        .await?;
                    tracing::info!(
                        user_id = %existing_user_by_email.id,
                        tenant_id = %existing_tenant.id,
                        workos_user_id = %input.workos_user_id,
                        workos_organization_id = %input.workos_organization_id,
                        "Linked existing User row to WorkOS user via invitation accept",
                    );
                    existing_user_by_email.id.clone()
                }
                Some(linked) if linked == input.workos_user_id => {
                    existing_user_by_email.id.clone()
                }
                Some(linked) => {
                    tracing::warn!(
                        user_id = %existing_user_by_email.id,
                        email = %input.email,
                        existing_workos_user_id = linked,
                        incoming_workos_user_id = %input.workos_user_id,
                        "Email already linked to a different WorkOS user — refusing to overwrite",
                    );
                    return Err(ApiError::bad_request(
                        "email_already_registered_to_different_workos_user",
                    ));
                }
            };

            state
                .memberships
                .upsert(CreateTenantMembershipInput {
                    user_id: resolved_user_id.clone(),
                    tenant_id: existing_tenant.id.clone(),
                    role: UserRole::Member,
                    status: MembershipStatus::Active,
                })
                .await?;

            return Ok(Json(RegisterWorkosTenantResponse {
                tenant_id: existing_tenant.id,
                user_id: resolved_user_id,
                created: false,
            }));
        }

        let display_name = match (input.first_name.as_deref(), input.last_name.as_deref()) {
            (Some(f), Some(l)) if !f.is_empty() && !l.is_empty() => Some(format!("{f} {l}")),
            (Some(f), _) if !f.is_empty() => Some(f.to_string()),
            (_, Some(l)) if !l.is_empty() => Some(l.to_string()),
            _ => None,
        };

        let user = state
            .users
            .create(CreateUserInput {
                email: input.email.clone(),
                name: display_name,
                password_hash: None,
                auth_provider: "workos".to_string(),
                role: UserRole::Member,
                tenant_id: existing_tenant.id.clone(),
                workos_user_id: Some(input.workos_user_id.clone()),
                created_via: Some("invitation".to_string()),
            })
            .await?;

        state
            .memberships
            .upsert(CreateTenantMembershipInput {
                user_id: user.id.clone(),
                tenant_id: existing_tenant.id.clone(),
                role: UserRole::Member,
                status: MembershipStatus::Active,
            })
            .await?;

        tracing::info!(
            user_id = %user.id,
            tenant_id = %existing_tenant.id,
            workos_user_id = %input.workos_user_id,
            workos_organization_id = %input.workos_organization_id,
            "Provisioned local User row + membership for invitation accept",
        );

        return Ok(Json(RegisterWorkosTenantResponse {
            tenant_id: existing_tenant.id,
            user_id: user.id,
            created: false,
        }));
    }

    if let Some(existing_user) = state.users.find_by_email(&input.email).await? {
        match existing_user.workos_user_id.as_deref() {
            None => {
                state
                    .users
                    .set_workos_user_id(&existing_user.id, &input.workos_user_id)
                    .await?;
                tracing::warn!(
                    user_id = %existing_user.id,
                    email = %input.email,
                    "Email pre-existed without WorkOS link; backfilled workos_user_id and reusing the user's current tenant — the freshly created WorkOS Organization will not be linked to this Chronicle Tenant. Investigate / clean up manually if this is unexpected."
                );
                state
                    .memberships
                    .upsert(CreateTenantMembershipInput {
                        user_id: existing_user.id.clone(),
                        tenant_id: existing_user.tenant_id.clone(),
                        role: existing_user.role,
                        status: MembershipStatus::Active,
                    })
                    .await?;
                return Ok(Json(RegisterWorkosTenantResponse {
                    tenant_id: existing_user.tenant_id,
                    user_id: existing_user.id,
                    created: false,
                }));
            }
            Some(linked) if linked == input.workos_user_id => {
                state
                    .memberships
                    .upsert(CreateTenantMembershipInput {
                        user_id: existing_user.id.clone(),
                        tenant_id: existing_user.tenant_id.clone(),
                        role: existing_user.role,
                        status: MembershipStatus::Active,
                    })
                    .await?;
                return Ok(Json(RegisterWorkosTenantResponse {
                    tenant_id: existing_user.tenant_id,
                    user_id: existing_user.id,
                    created: false,
                }));
            }
            Some(linked) => {
                tracing::warn!(
                    user_id = %existing_user.id,
                    email = %input.email,
                    existing_workos_user_id = linked,
                    incoming_workos_user_id = %input.workos_user_id,
                    "Email already linked to a different WorkOS user — refusing to overwrite",
                );
                return Err(ApiError::bad_request(
                    "email_already_registered_to_different_workos_user",
                ));
            }
        }
    }

    if input.name.trim().is_empty() {
        return Err(ApiError::bad_request("Workspace name is required"));
    }
    if input.slug.trim().is_empty() {
        return Err(ApiError::bad_request("Workspace slug is required"));
    }

    let tenant = state
        .tenants
        .create(CreateTenantInput {
            name: input.name.clone(),
            slug: input.slug.clone(),
        })
        .await?;

    state
        .tenants
        .set_workos_organization_id(&tenant.id, &input.workos_organization_id)
        .await?;

    let user = if let Some(existing) = state
        .users
        .find_by_workos_user_id(&input.workos_user_id)
        .await?
    {

        if existing.tenant_id != tenant.id {
            state
                .users
                .set_tenant_id(&existing.id, &tenant.id)
                .await?;
            tracing::info!(
                user_id = %existing.id,
                old_tenant_id = %existing.tenant_id,
                new_tenant_id = %tenant.id,
                "Promoted self-serve workspace to user's primary tenant",
            );
        }
        // Re-fetch so downstream code (membership upsert, role) sees the
        // updated tenant_id. This is cheap and keeps the function simple.
        state
            .users
            .find_by_workos_user_id(&input.workos_user_id)
            .await?
            .unwrap_or(existing)
    } else {
        let display_name = match (input.first_name.as_deref(), input.last_name.as_deref()) {
            (Some(f), Some(l)) if !f.is_empty() && !l.is_empty() => Some(format!("{f} {l}")),
            (Some(f), _) if !f.is_empty() => Some(f.to_string()),
            (_, Some(l)) if !l.is_empty() => Some(l.to_string()),
            _ => None,
        };

        state
            .users
            .create(CreateUserInput {
                email: input.email.clone(),
                name: display_name,
                password_hash: None,
                auth_provider: "workos".to_string(),
                role: UserRole::Owner,
                tenant_id: tenant.id.clone(),
                workos_user_id: Some(input.workos_user_id.clone()),
                created_via: Some("self_serve".to_string()),
            })
            .await?
    };

    // Self-serve: the workspace creator is the Owner.
    state
        .memberships
        .upsert(CreateTenantMembershipInput {
            user_id: user.id.clone(),
            tenant_id: tenant.id.clone(),
            role: UserRole::Owner,
            status: MembershipStatus::Active,
        })
        .await?;

    Ok(Json(RegisterWorkosTenantResponse {
        tenant_id: tenant.id,
        user_id: user.id,
        created: true,
    }))
}

#[cfg(test)]
mod register_workos_tenant_tests {
    use super::{register_workos_tenant, RegisterWorkosTenantInput};
    use std::sync::Arc;

    use async_trait::async_trait;
    use axum::extract::State;
    use axum::Json;

    use chronicle_infra::{
        memory::{
            InMemoryAgentEndpointConfigRepo, InMemoryAuditLogRepo, InMemoryConnectionRepo,
            InMemoryFeatureFlagRepo, InMemoryIntegrationSyncRepo, InMemoryInvitationRepo,
            InMemoryRunRepo, InMemoryTenantMembershipRepo, InMemoryTenantRepo, InMemoryUserRepo,
            MemoryStore, MemoryStream,
        },
        StoreBackend, StreamBackend,
    };
    use chronicle_interfaces::email::{EmailError, EmailService, TemplateEmailParams};
    use chronicle_interfaces::{TenantRepository, UserRepository};

    use crate::runtime_config::SaasRuntimeConfig;
    use crate::saas_state::SaasAppState;

    #[derive(Default)]
    struct StubEmailService;

    #[async_trait]
    impl EmailService for StubEmailService {
        async fn send_template_email(
            &self,
            _params: TemplateEmailParams,
        ) -> Result<String, EmailError> {
            Ok("stub-email".to_string())
        }
    }

    const TEST_SERVICE_SECRET: &str = "test-secret-do-not-use-in-prod";

    fn build_state() -> (
        SaasAppState,
        Arc<InMemoryTenantRepo>,
        Arc<InMemoryUserRepo>,
    ) {
        let tenants = Arc::new(InMemoryTenantRepo::default());
        let users = Arc::new(InMemoryUserRepo::default());
        let runs = Arc::new(InMemoryRunRepo::default());
        let connections = Arc::new(InMemoryConnectionRepo::default());
        let audit_logs = Arc::new(InMemoryAuditLogRepo::default());
        let agent_configs = Arc::new(InMemoryAgentEndpointConfigRepo::default());
        let feature_flags = Arc::new(InMemoryFeatureFlagRepo::default());
        let invitations = Arc::new(InMemoryInvitationRepo::default());
        let memberships = Arc::new(InMemoryTenantMembershipRepo::default());
        let integration_syncs = Arc::new(InMemoryIntegrationSyncRepo::default());
        let event_store = Arc::new(StoreBackend::Memory(MemoryStore::new()));
        let event_stream = Arc::new(StreamBackend::Memory(MemoryStream::new(16, 16)));
        let mut config = SaasRuntimeConfig::default();
        config.service_secret = Some(TEST_SERVICE_SECRET.to_string());

        let state = SaasAppState::new(
            "client_test",
            tenants.clone(),
            users.clone(),
            runs,
            connections,
            audit_logs,
            agent_configs,
            integration_syncs,
            feature_flags,
            invitations,
            memberships,
            None,
            Arc::new(StubEmailService),
            None,
            event_store,
            event_stream,
            config,
        );

        (state, tenants, users)
    }

    fn input(
        workos_user_id: &str,
        workos_organization_id: &str,
        email: &str,
        name: &str,
        slug: &str,
    ) -> RegisterWorkosTenantInput {
        RegisterWorkosTenantInput {
            service_secret: TEST_SERVICE_SECRET.to_string(),
            workos_user_id: workos_user_id.to_string(),
            workos_organization_id: workos_organization_id.to_string(),
            email: email.to_string(),
            name: name.to_string(),
            slug: slug.to_string(),
            first_name: None,
            last_name: None,
        }
    }

    #[tokio::test]
    async fn case_a_onboarding_creates_tenant_and_user_as_owner() {
        let (state, tenants, users) = build_state();

        let response = register_workos_tenant(
            State(state.clone()),
            Json(input(
                "user_admin",
                "org_admin",
                "admin@example.com",
                "Acme",
                "acme",
            )),
        )
        .await
        .expect("onboarding should succeed");

        assert!(response.0.created, "expected created=true on first call");

        let tenant = tenants
            .find_by_workos_organization_id("org_admin")
            .await
            .unwrap()
            .expect("tenant should exist");
        assert_eq!(tenant.name, "Acme");
        assert_eq!(tenant.slug, "acme");

        let user = users
            .find_by_workos_user_id("user_admin")
            .await
            .unwrap()
            .expect("user should exist");
        assert_eq!(user.email, "admin@example.com");
        assert_eq!(user.tenant_id, tenant.id);
        assert_eq!(user.role.as_str(), "owner", "creator must be Owner");
    }

    #[tokio::test]
    async fn case_b_invitation_creates_user_as_member_when_tenant_already_exists() {
        let (state, tenants, users) = build_state();

        let _ = register_workos_tenant(
            State(state.clone()),
            Json(input(
                "user_admin",
                "org_acme",
                "admin@example.com",
                "Acme",
                "acme",
            )),
        )
        .await
        .expect("admin onboarding");

        let response = register_workos_tenant(
            State(state.clone()),
            Json(input(
                "user_invitee",
                "org_acme",
                "invitee@example.com",
                "",
                "",
            )),
        )
        .await
        .expect(
            "invited user provisioning should succeed even when tenant exists and \
             name/slug are empty (only required when creating a new tenant)",
        );

        assert!(
            !response.0.created,
            "expected created=false because tenant already exists",
        );

        let invitee = users
            .find_by_workos_user_id("user_invitee")
            .await
            .unwrap()
            .expect("invited user must be created in our backend");
        assert_eq!(invitee.email, "invitee@example.com");

        let tenant = tenants
            .find_by_workos_organization_id("org_acme")
            .await
            .unwrap()
            .expect("tenant must still exist");
        assert_eq!(invitee.tenant_id, tenant.id);
        assert_eq!(
            invitee.role.as_str(),
            "member",
            "invitee must be Member, not Owner",
        );
    }

    #[tokio::test]
    async fn case_c_idempotent_when_user_already_exists() {
        let (state, _tenants, users) = build_state();

        let _ = register_workos_tenant(
            State(state.clone()),
            Json(input(
                "user_admin",
                "org_acme",
                "admin@example.com",
                "Acme",
                "acme",
            )),
        )
        .await
        .unwrap();

        let _ = register_workos_tenant(
            State(state.clone()),
            Json(input(
                "user_invitee",
                "org_acme",
                "invitee@example.com",
                "",
                "",
            )),
        )
        .await
        .unwrap();

        let response = register_workos_tenant(
            State(state.clone()),
            Json(input(
                "user_invitee",
                "org_acme",
                "invitee@example.com",
                "",
                "",
            )),
        )
        .await
        .expect("re-registering existing user must not 500");

        assert!(!response.0.created);

        let invitee = users
            .find_by_workos_user_id("user_invitee")
            .await
            .unwrap()
            .expect("invited user must still exist");
        assert_eq!(
            invitee.role.as_str(),
            "member",
            "role must not get overwritten on re-register",
        );
    }

    #[tokio::test]
    async fn rejects_call_with_wrong_service_secret() {
        let (state, _tenants, _users) = build_state();

        let mut bad = input("u", "org", "e@example.com", "n", "s");
        bad.service_secret = "wrong-secret".to_string();

        let result = register_workos_tenant(State(state), Json(bad)).await;
        assert!(
            result.is_err(),
            "wrong service_secret must return Unauthorized",
        );
    }

    #[tokio::test]
    async fn rejects_creation_with_empty_name_when_tenant_is_new() {
        let (state, _tenants, _users) = build_state();

        let result = register_workos_tenant(
            State(state),
            Json(input(
                "user_x",
                "org_brand_new",
                "x@example.com",
                "",
                "valid-slug",
            )),
        )
        .await;

        assert!(
            result.is_err(),
            "creating a new tenant with empty name must error",
        );
    }

    #[tokio::test]
    async fn case_d_invitation_links_existing_user_row_with_orphan_email() {
        use chronicle_domain::CreateUserInput;
        use chronicle_interfaces::UserRepository;

        let (state, _tenants, users) = build_state();

        let _ = register_workos_tenant(
            State(state.clone()),
            Json(input(
                "user_admin",
                "org_acme",
                "admin@example.com",
                "Acme",
                "acme",
            )),
        )
        .await
        .expect("admin onboarding");

        let admin_tenant_id = users
            .find_by_workos_user_id("user_admin")
            .await
            .unwrap()
            .unwrap()
            .tenant_id
            .clone();

        let orphan = users
            .create(CreateUserInput {
                email: "orphan@example.com".to_string(),
                name: Some("Orphan".to_string()),
                password_hash: None,
                auth_provider: "legacy".to_string(),
                role: chronicle_domain::UserRole::Member,
                tenant_id: admin_tenant_id.clone(),
                workos_user_id: None,
                created_via: Some("legacy".to_string()),
            })
            .await
            .expect("create legacy User row with no workos_user_id");

        let response = register_workos_tenant(
            State(state.clone()),
            Json(input(
                "user_invitee",
                "org_acme",
                "orphan@example.com",
                "",
                "",
            )),
        )
        .await
        .expect(
            "invitation accept with email collision should backfill workos_user_id, not 500",
        );

        assert!(!response.0.created);
        assert_eq!(
            response.0.user_id, orphan.id,
            "must reuse the legacy User row, not create a new one",
        );

        let linked = users
            .find_by_workos_user_id("user_invitee")
            .await
            .unwrap()
            .expect("workos_user_id must now be findable");
        assert_eq!(linked.id, orphan.id);
        assert_eq!(linked.email, "orphan@example.com");
    }

    #[tokio::test]
    async fn case_e_invitation_rejects_email_already_linked_to_different_workos_user() {
        let (state, _tenants, _users) = build_state();

        let _ = register_workos_tenant(
            State(state.clone()),
            Json(input(
                "user_admin",
                "org_acme",
                "admin@example.com",
                "Acme",
                "acme",
            )),
        )
        .await
        .expect("admin onboarding");

        let _ = register_workos_tenant(
            State(state.clone()),
            Json(input(
                "user_first",
                "org_acme",
                "shared@example.com",
                "",
                "",
            )),
        )
        .await
        .expect("first invitee provisioned");

        let result = register_workos_tenant(
            State(state.clone()),
            Json(input(
                "user_second",
                "org_acme",
                "shared@example.com",
                "",
                "",
            )),
        )
        .await;

        assert!(
            result.is_err(),
            "second WorkOS user trying to claim the same email must be rejected",
        );
    }
}
