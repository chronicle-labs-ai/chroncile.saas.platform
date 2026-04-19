pub mod admin;
pub mod audit;
pub mod auth;
pub mod connections;
pub mod dashboard;
mod error;
pub mod feature_access;
pub mod integrations;
pub mod intercom;
pub mod klaviyo;
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
    let jwt = state.jwt.clone();
    let feature_access = state.feature_access.clone();

    let public = Router::new()
        .route("/api/platform/auth/signup", post(auth::signup))
        .route("/api/platform/auth/login", post(auth::login))
        .route(
            "/api/platform/auth/forgot-password",
            post(auth::forgot_password),
        )
        .route(
            "/api/platform/auth/reset-password",
            post(auth::reset_password),
        )
        .route(
            "/api/platform/auth/token-exchange",
            post(auth::exchange_token),
        )
        .route("/api/platform/auth/oauth-signup", post(auth::oauth_signup))
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
        .layer(axum_mw::from_fn(
            move |mut req: axum::extract::Request, next: axum_mw::Next| {
                let jwt = jwt.clone();
                let feature_access = feature_access.clone();
                async move {
                    req.extensions_mut().insert(jwt.clone());

                    let maybe_token = req
                        .headers()
                        .get("authorization")
                        .and_then(|value| value.to_str().ok())
                        .and_then(|header| header.strip_prefix("Bearer "))
                        .map(str::to_string);

                    if let Some(token) = maybe_token {
                        match jwt.validate(&token) {
                            Ok(user) => {
                                req.extensions_mut().insert(user.clone());
                                match feature_access.resolve_for_user(&user).await {
                                    Ok(access) => {
                                        req.extensions_mut().insert(ResolvedFeatureAccess(access));
                                    }
                                    Err(error) => {
                                        tracing::warn!(
                                            tenant_id = %user.tenant_id,
                                            user_id = %user.id,
                                            error = %error,
                                            "Failed to resolve feature access during request bootstrap"
                                        );
                                    }
                                }
                            }
                            Err(error) => {
                                tracing::debug!(error = %error, "Skipping feature access bootstrap due to invalid auth token");
                            }
                        }
                    }

                    next.run(req).await
                }
            },
        ))
        .with_state(state);

    Router::new().merge(public).merge(protected)
}
