//! API Routes
//!
//! Defines all HTTP endpoints for the Events Manager API.

mod connections;
mod generators;
mod health;
mod native;
pub mod saas;
mod sources;

pub use generators::GeneratorManager;

use axum::{
    routing::{get, head, post},
    Router,
};
use tower_http::cors::{Any, CorsLayer};

use crate::AppState;

/// Build all API routes with CORS support
pub fn build_routes(state: AppState) -> Router {
    // Configure CORS for web UI
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .merge(native::build_native_routes())
        // Health check
        .route("/health", get(health::health_check))
        .route("/api/health", get(health::health_check))
        // Connections
        .route("/api/connections", get(connections::list_connections))
        .route("/api/connections", post(connections::create_connection))
        .route(
            "/api/connections/:id",
            get(connections::get_connection).delete(connections::delete_connection),
        )
        .route(
            "/api/connections/:id/generate",
            post(connections::generate_events),
        )
        // Scenarios
        .route("/api/scenarios", get(connections::list_scenarios))
        .route(
            "/api/scenarios/:name/load",
            post(connections::load_scenario),
        )
        // Sources API - Discovery and management
        .route("/api/sources", get(sources::list_sources))
        .route("/api/sources/:id", get(sources::get_source_by_id))
        .route("/api/sources/:id/catalog", get(sources::get_source_catalog))
        // Dynamic webhook routing (uses source registry)
        .route(
            "/api/webhooks/:source_id",
            head(sources::verify_webhook).post(sources::handle_webhook),
        )
        // Generators - control mock/simulation event sources
        .route("/api/generators", get(generators::list_generators))
        .route(
            "/api/generators/running",
            get(generators::list_running_generators),
        )
        .route(
            "/api/generators/:source_id",
            get(generators::get_generator_status),
        )
        .route(
            "/api/generators/:source_id/start",
            post(generators::start_generator),
        )
        .route(
            "/api/generators/:source_id/stop",
            post(generators::stop_generator),
        )
        // Add CORS layer
        .layer(cors)
        // State
        .with_state(state)
}
