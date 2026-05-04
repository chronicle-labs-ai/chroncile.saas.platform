pub mod admin;
pub mod audit;
pub mod auth;
pub mod connections;
pub mod dashboard;
pub(crate) mod error;
pub mod feature_access;
pub mod integrations;
pub mod intercom;
pub mod klaviyo;
pub mod me;
pub mod metrics;
pub mod runs;
pub mod sandboxes;
pub mod settings;
pub mod shopify;
pub mod team;
pub mod tenant;
pub mod trellus;
pub mod webhooks;

use axum::{
    middleware as axum_mw,
    routing::{delete, get, patch, post, put},
    Router,
};

use crate::feature_access::ResolvedFeatureAccess;
use crate::saas_state::SaasAppState;

pub fn build_saas_routes(state: SaasAppState) -> Router {

    let public = Router::new()
        // CP 7.1 — register a Tenant for an Organization the frontend just
        // created in WorkOS (server-to-server, service_secret auth).
        .route(
            "/api/platform/tenants/register-workos",
            post(tenant::register_workos_tenant),
        )
        .route(
            "/api/platform/users/primary-org",
            post(tenant::lookup_primary_org),
        )
        // CP 7.5 — current user via WorkOS JWKS path. Self-protected by the
        // WorkosAuthUser extractor (no JWT middleware).
        .route("/api/saas/me", get(me::get_me))
        // Org-agnostic identity probe. Used by the frontend when the
        // sealed session is authenticated but has no `org_id` claim
        // (typically right after a token refresh) so the dashboard guard
        // can recover by switching to the user's primary workspace.
        .route("/api/saas/identity", get(me::get_identity))
        .route("/api/webhooks/workos", post(auth::workos_webhook))
        .route("/api/platform/admin/stats", get(dashboard::admin_stats))
        .route(
            "/api/platform/admin/feature-flags",
            get(admin::list_feature_flags),
        )
        .route("/api/platform/admin/tenants", get(admin::list_tenants))
        .route(
            "/api/platform/admin/tenants/:tenant_id/users",
            get(admin::list_tenant_users),
        )
        .route(
            "/api/platform/admin/tenants/:tenant_id/invite",
            post(admin::invite_user),
        )
        .route(
            "/api/platform/admin/tenants/:tenant_id/feature-access",
            get(admin::get_tenant_feature_access),
        )
        .route(
            "/api/platform/admin/tenants/:tenant_id/feature-flags/:flag_key",
            put(admin::upsert_tenant_feature_flag_override)
                .delete(admin::delete_tenant_feature_flag_override),
        )
        .route("/api/platform/admin/orgs", post(admin::create_org))
        .route("/api/webhooks/stripe", post(webhooks::stripe_webhook))
        .route("/api/webhooks/nango", post(webhooks::nango_webhook))
        .route(
            "/api/webhooks/intercom",
            get(intercom::webhook_head).post(intercom::webhook),
        )
        .route("/api/webhooks/klaviyo", post(klaviyo::webhook))
        .route(
            "/api/webhooks/trellus/:connection_id",
            post(trellus::webhook),
        )
        .route("/api/webhooks/shopify", post(shopify::webhook))
        .route(
            "/api/platform/auth/accept-invite/:token",
            post(team::accept_invite),
        )
        .route("/health/ready", get(super::health::deep_health_check))
        .route("/api/platform/metrics", get(metrics::platform_metrics))
        .with_state(state.clone());

    let protected = Router::new()
        .route("/api/platform/dashboard/stats", get(dashboard::stats))
        .route("/api/platform/dashboard/activity", get(dashboard::activity))
        .route(
            "/api/platform/settings/agent-endpoint",
            get(settings::get_agent_endpoint),
        )
        .route(
            "/api/platform/settings/agent-endpoint",
            put(settings::update_agent_endpoint),
        )
        .route(
            "/api/platform/sandboxes/ai/chat",
            post(sandboxes::chat_graph),
        )
        .route(
            "/api/platform/connections",
            get(connections::list_connections),
        )
        .route(
            "/api/platform/connections/:id",
            get(connections::get_connection),
        )
        .route(
            "/api/platform/connections/:id",
            delete(connections::delete_connection),
        )
        .route("/api/platform/runs", get(runs::list_runs))
        .route("/api/platform/runs", post(runs::create_run))
        .route("/api/platform/runs/:id", get(runs::get_run))
        .route("/api/platform/runs/:id", put(runs::update_run_status))
        .route("/api/platform/audit", get(audit::list_audit_logs))
        .route(
            "/api/platform/feature-access",
            get(feature_access::get_feature_access),
        )
        .route(
            "/api/platform/tenant",
            get(tenant::get_tenant)
                .patch(tenant::update_tenant_name)
                .delete(tenant::delete_tenant),
        )
        .route(
            "/api/platform/tenant/stripe",
            put(tenant::update_tenant_stripe),
        )
        .route(
            "/api/platform/integrations/providers",
            get(integrations::list_providers),
        )
        .route(
            "/api/platform/integrations/connections",
            get(integrations::list_nango_connections),
        )
        .route(
            "/api/platform/integrations/connect-session",
            post(integrations::create_connect_session),
        )
        .route(
            "/api/platform/integrations/connections/sync",
            post(integrations::sync_connection),
        )
        .route(
            "/api/platform/integrations/sync",
            post(integrations::trigger_sync),
        )
        .route(
            "/api/platform/integrations/disconnect",
            post(integrations::disconnect),
        )
        .route(
            "/api/platform/integrations/intercom",
            get(intercom::get_integration),
        )
        .route(
            "/api/platform/integrations/intercom/authorize",
            post(intercom::authorize),
        )
        .route(
            "/api/platform/integrations/intercom/callback",
            get(intercom::callback),
        )
        .route(
            "/api/platform/integrations/intercom/disconnect",
            post(intercom::disconnect),
        )
        .route(
            "/api/platform/integrations/klaviyo",
            get(klaviyo::get_integration),
        )
        .route(
            "/api/platform/integrations/klaviyo/authorize",
            post(klaviyo::authorize),
        )
        .route(
            "/api/platform/integrations/klaviyo/callback",
            get(klaviyo::callback),
        )
        .route(
            "/api/platform/integrations/klaviyo/disconnect",
            post(klaviyo::disconnect),
        )
        .route(
            "/api/platform/integrations/trellus",
            get(trellus::get_integration),
        )
        .route(
            "/api/platform/integrations/trellus/setup",
            post(trellus::setup),
        )
        .route(
            "/api/platform/integrations/trellus/rotate-secret",
            post(trellus::rotate_secret),
        )
        .route(
            "/api/platform/integrations/trellus/disconnect",
            post(trellus::disconnect),
        )
        .route(
            "/api/platform/integrations/shopify",
            get(shopify::get_integration),
        )
        .route(
            "/api/platform/integrations/shopify/authorize",
            post(shopify::authorize),
        )
        .route(
            "/api/platform/integrations/shopify/callback",
            get(shopify::callback),
        )
        .route(
            "/api/platform/integrations/shopify/disconnect",
            post(shopify::disconnect),
        )
        .route("/api/platform/team/members", get(team::list_members))
        .route("/api/platform/team/invite", post(team::invite_member))
        .route(
            "/api/platform/team/members/:user_id",
            delete(team::remove_member),
        )
        .route(
            "/api/platform/team/members/:user_id/role",
            patch(team::update_member_role),
        )
        .layer(axum_mw::from_fn_with_state(
            state.clone(),
            |axum::extract::State(state): axum::extract::State<SaasAppState>,
             mut req: axum::extract::Request,
             next: axum_mw::Next| async move {
                if let Some(token) = req
                    .headers()
                    .get("authorization")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|h| h.strip_prefix("Bearer "))
                    .map(str::to_string)
                {
                    if let Ok(claims) = state.workos_jwt.verify(&token).await {
                        if let (Ok(Some(user_row)), Some(org_id)) = (
                            state.users.find_by_workos_user_id(&claims.sub).await,
                            claims.org_id.as_deref(),
                        ) {
                            if let Ok(Some(tenant_row)) = state
                                .tenants
                                .find_by_workos_organization_id(org_id)
                                .await
                            {
                                if user_row.tenant_id == tenant_row.id {
                                    let role = match user_row.role {
                                        chronicle_domain::UserRole::Owner => "owner",
                                        chronicle_domain::UserRole::Admin => "admin",
                                        chronicle_domain::UserRole::Member => "member",
                                    }
                                    .to_string();
                                    let auth_user = chronicle_auth::types::AuthUser {
                                        id: user_row.id,
                                        email: user_row.email,
                                        name: user_row.name,
                                        role,
                                        tenant_id: tenant_row.id,
                                        tenant_name: tenant_row.name,
                                        tenant_slug: tenant_row.slug,
                                    };

                                    if let Ok(access) =
                                        state.feature_access.resolve_for_user(&auth_user).await
                                    {
                                        req.extensions_mut()
                                            .insert(ResolvedFeatureAccess(access));
                                    }
                                    req.extensions_mut().insert(auth_user);
                                }
                            }
                        }
                    }
                }

                next.run(req).await
            },
        ))
        .with_state(state);

    Router::new().merge(public).merge(protected)
}
