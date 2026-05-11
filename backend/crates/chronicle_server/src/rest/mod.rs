//! REST API routes.
//!
//! Each module defines handlers for one domain. All routes are
//! assembled into a single axum [`Router`] via [`build_router`].

pub mod discovery;
mod error;
pub mod ingest;
pub mod links;
pub mod queries;
pub mod sdk;
pub mod web;

use crate::ServerState;
use axum::Router;

/// Build the full REST API router with all routes.
pub fn build_router(state: ServerState) -> Router {
    Router::new()
        .merge(ingest::routes())
        .merge(queries::routes())
        .merge(links::routes())
        .merge(discovery::routes())
        .merge(sdk::routes())
        .merge(web::routes())
        .with_state(state)
}
