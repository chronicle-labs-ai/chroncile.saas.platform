//! Event ingestion routes.

use axum::extract::State;
use axum::http::HeaderMap;
use axum::routing::post;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};

use chronicle_core::event::EventBuilder;

use super::error::ApiError;
use super::sdk::{backend_metadata, require_sdk_key};
use crate::ServerState;
use crate::VerifiedSdkKey;

pub fn routes() -> Router<ServerState> {
    Router::new()
        .route("/v1/events", post(ingest_event))
        .route("/v1/events/batch", post(ingest_batch))
}

/// Request body for ingesting a single event.
#[derive(Debug, Deserialize)]
pub struct IngestRequest {
    pub org_id: String,
    pub source: String,
    pub topic: String,
    pub event_type: String,
    #[serde(default)]
    pub entities: std::collections::HashMap<String, String>,
    #[serde(default)]
    pub payload: Option<serde_json::Value>,
    #[serde(default)]
    pub timestamp: Option<chrono::DateTime<chrono::Utc>>,
}

/// Response body after ingesting events.
#[derive(Debug, Serialize)]
pub struct IngestResponse {
    pub event_ids: Vec<String>,
    pub count: usize,
}

/// `POST /v1/events` -- ingest a single event.
async fn ingest_event(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Json(req): Json<IngestRequest>,
) -> Result<Json<IngestResponse>, ApiError> {
    let verified = require_sdk_key(&state, &headers, &req.org_id, "events:write").await?;
    let ingested_at = chrono::Utc::now();

    let event = build_event(req, verified.as_ref(), ingested_at);
    let ids = state
        .engine
        .events
        .insert_events(&[event])
        .await
        .map_err(chronicle_core::error::ChronicleError::from)?;

    Ok(Json(IngestResponse {
        count: ids.len(),
        event_ids: ids.iter().map(ToString::to_string).collect(),
    }))
}

/// `POST /v1/events/batch` -- ingest multiple events.
async fn ingest_batch(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Json(requests): Json<Vec<IngestRequest>>,
) -> Result<Json<IngestResponse>, ApiError> {
    let ingested_at = chrono::Utc::now();
    let mut verified_by_org = std::collections::HashMap::new();
    if state.sdk_auth.enabled() {
        for req in &requests {
            let verified = require_sdk_key(&state, &headers, &req.org_id, "events:write").await?;
            verified_by_org.insert(req.org_id.clone(), verified);
        }
    }

    let events: Vec<_> = requests
        .into_iter()
        .map(|req| {
            let verified = verified_by_org.get(&req.org_id).and_then(Option::as_ref);
            build_event(req, verified, ingested_at)
        })
        .collect();
    let ids = state
        .engine
        .events
        .insert_events(&events)
        .await
        .map_err(chronicle_core::error::ChronicleError::from)?;

    Ok(Json(IngestResponse {
        count: ids.len(),
        event_ids: ids.iter().map(ToString::to_string).collect(),
    }))
}

/// Convert an HTTP request into a domain Event.
fn build_event(
    req: IngestRequest,
    verified: Option<&VerifiedSdkKey>,
    ingested_at: chrono::DateTime<chrono::Utc>,
) -> chronicle_core::event::Event {
    let mut builder = EventBuilder::new(
        req.org_id.as_str(),
        req.source.as_str(),
        req.topic.as_str(),
        req.event_type.as_str(),
    );

    for (etype, eid) in &req.entities {
        builder = builder.entity(etype.as_str(), eid.clone());
    }

    let mut payload = req.payload.unwrap_or_else(|| serde_json::json!({}));
    if let Some(object) = payload.as_object_mut() {
        object.insert(
            "_chronicle_backend".to_string(),
            backend_metadata(ingested_at, verified),
        );
        enrich_inline_attachments(object);
    }
    if !payload.is_null() {
        builder = builder.payload(payload);
    }

    if let Some(ts) = req.timestamp {
        builder = builder.event_time(ts);
    }

    builder.build()
}

fn enrich_inline_attachments(payload: &mut serde_json::Map<String, serde_json::Value>) {
    let Some(attachments) = payload
        .get_mut("attachments")
        .and_then(serde_json::Value::as_array_mut)
    else {
        return;
    };

    for attachment in attachments {
        let Some(object) = attachment.as_object_mut() else {
            continue;
        };
        let value_bytes = object
            .get("value")
            .and_then(serde_json::Value::as_str)
            .map(|value| value.as_bytes().len())
            .unwrap_or_default();
        let metadata = object
            .entry("metadata")
            .or_insert_with(|| serde_json::json!({}));
        if let Some(metadata) = metadata.as_object_mut() {
            metadata.insert("value_bytes".to_string(), serde_json::json!(value_bytes));
            metadata.insert("persisted_inline".to_string(), serde_json::json!(true));
            metadata.insert("truncated".to_string(), serde_json::json!(false));
        }
    }
}
