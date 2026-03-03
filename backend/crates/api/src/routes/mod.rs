//! API Routes
//!
//! Defines all HTTP endpoints for the Events Manager API.

mod connections;
mod generators;
mod health;
mod ingest;
mod replay;
pub mod saas;
pub mod sandbox;
mod sources;
mod stream;

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
        // Ingest
        .route("/api/ingest", post(ingest::ingest_event))
        .route("/api/ingest/batch", post(ingest::ingest_batch))
        // Stream
        .route("/api/stream", get(stream::stream_events))
        .route("/api/events", get(stream::list_events))
        // Query API (tenant-based, advanced filtering)
        .route("/api/events/query", get(stream::query_events))
        .route("/api/events/sources", get(stream::list_sources))
        .route("/api/events/types", get(stream::list_event_types))
        // Legacy conversation-based timeline
        .route("/api/conversations/:id/timeline", get(stream::get_timeline))
        // Replay
        .route("/api/replay", post(replay::create_replay))
        .route("/api/replay/:session_id", get(replay::get_replay_status))
        .route("/api/replay/:session_id/stream", get(replay::stream_replay))
        .route("/api/replay/:session_id/step", post(replay::step_replay))
        .route(
            "/api/replay/:session_id/control",
            post(replay::control_replay),
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
        // Sandbox API (for AI agents)
        .route(
            "/api/sandbox/sessions",
            get(sandbox::list_sandbox_sessions).post(sandbox::create_sandbox_session),
        )
        .route(
            "/api/sandbox/sessions/:session_id",
            get(sandbox::get_sandbox_status).delete(sandbox::delete_sandbox_session),
        )
        .route(
            "/api/sandbox/sessions/:session_id/stream",
            get(sandbox::stream_sandbox),
        )
        // Add CORS layer
        .layer(cors)
        // State
        .with_state(state)
}
