//! SDK-facing capture routes.
//!
//! These routes preserve high-level SDK concepts (signals, identify calls,
//! and trace/span batches) while storing them as normal Chronicle events.

use axum::extract::State;
use axum::http::HeaderMap;
use axum::routing::post;
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use chronicle_core::error::ChronicleError;
use chronicle_core::event::EventBuilder;

use super::error::ApiError;
use crate::ServerState;
use crate::VerifiedSdkKey;

pub fn routes() -> Router<ServerState> {
    Router::new()
        .route("/v1/users/identify", post(identify_user))
        .route("/v1/signals/track", post(track_signals))
        .route("/v1/traces/track", post(track_traces))
}

#[derive(Debug, Serialize)]
pub struct AcceptedResponse {
    pub accepted: usize,
}

#[derive(Debug, Deserialize)]
pub struct IdentifyUserRequest {
    pub org_id: String,
    pub user_id: String,
    #[serde(default)]
    pub traits: Value,
}

#[derive(Debug, Deserialize)]
pub struct TrackSignalsRequest {
    pub org_id: String,
    #[serde(default)]
    pub signals: Vec<SignalRequest>,
}

#[derive(Debug, Deserialize)]
pub struct SignalRequest {
    pub event_id: String,
    pub signal_name: String,
    #[serde(default)]
    pub timestamp: Option<DateTime<Utc>>,
    #[serde(default)]
    pub properties: Option<Value>,
    #[serde(default)]
    pub attachment_id: Option<String>,
    #[serde(default)]
    pub signal_type: Option<String>,
    #[serde(default)]
    pub sentiment: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TrackTracesRequest {
    pub org_id: String,
    #[serde(default)]
    pub traces: Vec<TraceRequest>,
}

#[derive(Debug, Deserialize)]
pub struct TraceRequest {
    pub trace_id: String,
    #[serde(default)]
    pub event_id: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub started_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub ended_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub attributes: Option<Value>,
    #[serde(default)]
    pub spans: Vec<SpanRequest>,
}

#[derive(Debug, Deserialize)]
pub struct SpanRequest {
    pub trace_id: String,
    pub span_id: String,
    #[serde(default)]
    pub parent_span_id: Option<String>,
    #[serde(default)]
    pub event_id: Option<String>,
    pub name: String,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub started_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub ended_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub duration_ms: Option<f64>,
    #[serde(default)]
    pub attributes: Option<Value>,
    #[serde(default)]
    pub links: Option<Value>,
}

async fn identify_user(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Json(req): Json<IdentifyUserRequest>,
) -> Result<Json<AcceptedResponse>, ApiError> {
    let verified = require_sdk_key(&state, &headers, &req.org_id, "users:write").await?;
    let ingested_at = Utc::now();

    let event = EventBuilder::new(
        req.org_id.as_str(),
        "chronicle.sdk",
        "users",
        "user.identify",
    )
    .entity("user", req.user_id.clone())
    .payload(serde_json::json!({
        "user_id": req.user_id,
        "traits": req.traits,
        "_chronicle_backend": backend_metadata(ingested_at, verified.as_ref()),
    }))
    .build();

    let ids = state
        .engine
        .events
        .insert_events(&[event])
        .await
        .map_err(ChronicleError::from)?;
    Ok(Json(AcceptedResponse {
        accepted: ids.len(),
    }))
}

async fn track_signals(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Json(req): Json<TrackSignalsRequest>,
) -> Result<Json<AcceptedResponse>, ApiError> {
    let verified = require_sdk_key(&state, &headers, &req.org_id, "signals:write").await?;
    let ingested_at = Utc::now();

    let events: Vec<_> = req
        .signals
        .into_iter()
        .map(|signal| {
            let mut builder = EventBuilder::new(
                req.org_id.as_str(),
                "chronicle.sdk",
                "signals",
                format!("signal.{}", signal.signal_name),
            )
            .entity("event", signal.event_id.clone())
            .payload(serde_json::json!({
                "event_id": signal.event_id,
                "signal_name": signal.signal_name,
                "properties": signal.properties,
                "attachment_id": signal.attachment_id,
                "signal_type": signal.signal_type.unwrap_or_else(|| "default".to_string()),
                "sentiment": signal.sentiment,
                "_chronicle_backend": backend_metadata(ingested_at, verified.as_ref()),
            }));

            if let Some(timestamp) = signal.timestamp {
                builder = builder.event_time(timestamp);
            }

            builder.build()
        })
        .collect();

    let accepted = events.len();
    if !events.is_empty() {
        state
            .engine
            .events
            .insert_events(&events)
            .await
            .map_err(ChronicleError::from)?;
    }

    Ok(Json(AcceptedResponse { accepted }))
}

async fn track_traces(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Json(req): Json<TrackTracesRequest>,
) -> Result<Json<AcceptedResponse>, ApiError> {
    let verified = require_sdk_key(&state, &headers, &req.org_id, "traces:write").await?;
    let ingested_at = Utc::now();

    let events: Vec<_> = req
        .traces
        .into_iter()
        .flat_map(|trace| {
            let org_id = req.org_id.clone();
            let trace_event_id = trace.event_id.clone();
            let trace_name = trace.name.clone();
            let trace_started_at = trace.started_at;
            let trace_attributes = trace.attributes.clone();
            let verified = verified.clone();
            trace.spans.into_iter().map(move |span| {
                let event_time = span.started_at.or(trace_started_at);
                let kind = span.kind.unwrap_or_else(|| "custom".to_string());
                let mut builder = EventBuilder::new(
                    org_id.as_str(),
                    "chronicle.sdk",
                    "traces",
                    format!("trace.span.{kind}"),
                )
                .entity("trace", span.trace_id.clone())
                .entity("span", span.span_id.clone())
                .payload(serde_json::json!({
                    "trace_id": span.trace_id,
                    "span_id": span.span_id,
                    "parent_span_id": span.parent_span_id,
                    "event_id": span.event_id.or_else(|| trace_event_id.clone()),
                    "trace_name": trace_name.clone(),
                    "name": span.name,
                    "kind": kind,
                    "status": span.status.unwrap_or_else(|| "ok".to_string()),
                    "started_at": span.started_at,
                    "ended_at": span.ended_at,
                    "duration_ms": span.duration_ms,
                    "attributes": span.attributes,
                    "trace_attributes": trace_attributes.clone(),
                    "links": span.links,
                    "_chronicle_backend": backend_metadata(ingested_at, verified.as_ref()),
                }));

                if let Some(started_at) = event_time {
                    builder = builder.event_time(started_at);
                }

                builder.build()
            })
        })
        .collect();

    let accepted = events.len();
    if !events.is_empty() {
        state
            .engine
            .events
            .insert_events(&events)
            .await
            .map_err(ChronicleError::from)?;
    }

    Ok(Json(AcceptedResponse { accepted }))
}

pub(super) async fn require_sdk_key(
    state: &ServerState,
    headers: &HeaderMap,
    org_id: &str,
    required_scope: &str,
) -> Result<Option<VerifiedSdkKey>, ApiError> {
    if !state.sdk_auth.enabled() {
        return Ok(None);
    }

    let token = bearer_token(headers).ok_or_else(|| {
        ApiError::unauthorized("missing developer key; expected Authorization: Bearer <key>")
    })?;

    let Some(verified) = state
        .sdk_auth
        .verify(token)
        .await
        .map_err(ApiError::unauthorized)?
    else {
        return Ok(None);
    };

    if let Some(key_org_id) = verified.org_id.as_deref() {
        if key_org_id != org_id {
            return Err(ApiError::forbidden(
                "developer key is not authorized for requested org_id",
            ));
        }
    }

    if !verified.scopes.is_empty()
        && !verified
            .scopes
            .iter()
            .any(|scope| scope == required_scope || scope == "sdk:write" || scope == "*")
    {
        return Err(ApiError::forbidden(format!(
            "developer key is missing required scope: {required_scope}"
        )));
    }

    Ok(Some(verified))
}

fn bearer_token(headers: &HeaderMap) -> Option<&str> {
    let value = headers
        .get(axum::http::header::AUTHORIZATION)?
        .to_str()
        .ok()?;
    value.strip_prefix("Bearer ")
}

pub(super) fn backend_metadata(
    ingested_at: DateTime<Utc>,
    verified: Option<&VerifiedSdkKey>,
) -> serde_json::Value {
    serde_json::json!({
        "ingested_at": ingested_at,
        "ingest_unix_ms": ingested_at.timestamp_millis(),
        "auth": verified.map(|key| serde_json::json!({
            "key_id": key.key_id,
            "owner_id": key.owner_id,
            "org_id": key.org_id,
            "scopes": key.scopes,
            "rate_limit": key.rate_limit,
        })),
    })
}
