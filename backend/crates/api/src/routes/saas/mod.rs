pub mod auth;
pub mod dashboard;
mod error;
pub mod settings;
pub mod connections;
pub mod runs;
pub mod audit;
pub mod tenant;
pub mod pipedream;
pub mod webhooks;

use axum::{
    routing::{get, post, put, delete},
    Router,
    middleware as axum_mw,
};

use crate::saas_state::SaasAppState;

pub fn build_saas_routes(state: SaasAppState) -> Router {
    let jwt = state.jwt.clone();

    let public = Router::new()
        .route("/api/platform/auth/signup", post(auth::signup))
        .route("/api/platform/auth/login", post(auth::login))
        .route("/api/platform/auth/token-exchange", post(auth::exchange_token))
        .route("/api/platform/auth/oauth-signup", post(auth::oauth_signup))
        .route("/api/webhooks/pipedream/:tenantId", post(webhooks::pipedream_webhook))
        .route("/api/webhooks/stripe", post(webhooks::stripe_webhook))
        .with_state(state.clone());

    let protected = Router::new()
        .route("/api/platform/dashboard/stats", get(dashboard::stats))
        .route("/api/platform/dashboard/activity", get(dashboard::activity))
        .route("/api/platform/settings/agent-endpoint", get(settings::get_agent_endpoint))
        .route("/api/platform/settings/agent-endpoint", put(settings::update_agent_endpoint))
        .route("/api/platform/connections", get(connections::list_connections))
        .route("/api/platform/connections/:id", get(connections::get_connection))
        .route("/api/platform/connections/:id", delete(connections::delete_connection))
        .route("/api/platform/runs", get(runs::list_runs))
        .route("/api/platform/runs", post(runs::create_run))
        .route("/api/platform/runs/:id", get(runs::get_run))
        .route("/api/platform/runs/:id", put(runs::update_run_status))
        .route("/api/platform/audit", get(audit::list_audit_logs))
        .route("/api/platform/tenant", get(tenant::get_tenant))
        .route("/api/platform/tenant/stripe", put(tenant::update_tenant_stripe))
        .route("/api/platform/pipedream/apps", get(pipedream::list_apps))
        .route("/api/platform/pipedream/triggers", get(pipedream::list_triggers))
        .route("/api/platform/pipedream/triggers/deploy", post(pipedream::deploy_trigger))
        .route("/api/platform/pipedream/triggers/deployed", get(pipedream::list_deployed))
        .route("/api/platform/pipedream/triggers/deployed/:deployment_id", get(pipedream::get_deployed).put(pipedream::update_deployed).delete(pipedream::delete_deployed))
        .route("/api/platform/pipedream/token", post(pipedream::create_token))
        .route("/api/platform/pipedream/accounts", get(pipedream::list_accounts))
        .layer(axum_mw::from_fn(move |mut req: axum::extract::Request, next: axum_mw::Next| {
            let jwt = jwt.clone();
            async move {
                req.extensions_mut().insert(jwt);
                next.run(req).await
            }
        }))
        .with_state(state);

    Router::new().merge(public).merge(protected)
}
