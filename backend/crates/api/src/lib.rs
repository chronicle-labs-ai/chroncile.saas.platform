//! Events Manager HTTP API
//!
//! Axum-based HTTP server with SSE streaming endpoints.

pub mod error;
pub mod feature_access;
pub mod routes;
pub mod runtime_config;
pub mod saas_state;
pub mod state;
pub mod workos_user;

pub use error::{ApiError, ApiResult};
pub use feature_access::{FeatureAccessService, ResolvedFeatureAccess};
pub use runtime_config::{
    EventsRuntimeConfig, FeatureAccessRuntimeConfig, HealthMetadata, NangoRuntimeConfig,
    SaasRuntimeConfig,
};
pub use saas_state::SaasAppState;
pub use state::AppState;

use axum::Router;

/// Build the API router with all routes (chronicle-backend)
pub fn build_router(state: AppState) -> Router {
    routes::build_routes(state)
}

/// Build the SaaS API router (auth, dashboard, runs, connections, etc.)
pub fn build_saas_router(state: SaasAppState) -> Router {
    routes::saas::build_saas_routes(state)
}

pub fn init_metrics_start_time() {
    routes::saas::metrics::init_start_time();
}
