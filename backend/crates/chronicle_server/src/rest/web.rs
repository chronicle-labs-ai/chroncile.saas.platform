//! Web event tracking ingestion routes.
//!
//! Accepts events from browser/server-side SDKs and converts them
//! into Chronicle events via [`WebEventConverter`]. Designed to work
//! behind event gateways like Hookdeck without modification.

use axum::extract::State;
use axum::routing::post;
use axum::{Json, Router};
use serde::Serialize;

use chronicle_core::error::ChronicleError;
use chronicle_web::{
    BatchPayload, GroupRequest, IdentifyRequest, IncomingWebEvent, PageRequest, TrackRequest,
    WebEventConverter,
};

use super::error::ApiError;
use crate::ServerState;

pub fn routes() -> Router<ServerState> {
    Router::new()
        .route("/v1/web/track", post(track))
        .route("/v1/web/page", post(page))
        .route("/v1/web/identify", post(identify))
        .route("/v1/web/group", post(group))
        .route("/v1/web/batch", post(batch))
}

#[derive(Debug, Serialize)]
pub struct WebResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct WebBatchResponse {
    pub success: bool,
    pub accepted: usize,
    pub rejected: usize,
}

async fn track(
    State(state): State<ServerState>,
    Json(req): Json<TrackRequest>,
) -> Result<Json<WebResponse>, ApiError> {
    ingest_single(state, req.into()).await
}

async fn page(
    State(state): State<ServerState>,
    Json(req): Json<PageRequest>,
) -> Result<Json<WebResponse>, ApiError> {
    ingest_single(state, req.into()).await
}

async fn identify(
    State(state): State<ServerState>,
    Json(req): Json<IdentifyRequest>,
) -> Result<Json<WebResponse>, ApiError> {
    ingest_single(state, req.into()).await
}

async fn group(
    State(state): State<ServerState>,
    Json(req): Json<GroupRequest>,
) -> Result<Json<WebResponse>, ApiError> {
    ingest_single(state, req.into()).await
}

async fn batch(
    State(state): State<ServerState>,
    Json(payload): Json<BatchPayload>,
) -> Result<Json<WebBatchResponse>, ApiError> {
    let converter = WebEventConverter::new();
    let org_id = "default";

    let results = converter.convert_batch(&payload.batch, org_id);

    let mut events = Vec::with_capacity(results.len());
    let mut rejected = 0usize;
    for result in results {
        match result {
            Ok(event) => events.push(event),
            Err(_) => rejected += 1,
        }
    }

    let accepted = events.len();
    if !events.is_empty() {
        state
            .engine
            .events
            .insert_events(&events)
            .await
            .map_err(ChronicleError::from)?;
    }

    Ok(Json(WebBatchResponse {
        success: true,
        accepted,
        rejected,
    }))
}

async fn ingest_single(
    state: ServerState,
    incoming: IncomingWebEvent,
) -> Result<Json<WebResponse>, ApiError> {
    let converter = WebEventConverter::new();
    let org_id = "default";

    let event = converter
        .convert(&incoming, org_id)
        .map_err(ChronicleError::from)?;

    let ids = state
        .engine
        .events
        .insert_events(&[event])
        .await
        .map_err(ChronicleError::from)?;

    Ok(Json(WebResponse {
        success: true,
        event_id: ids.first().map(ToString::to_string),
    }))
}
