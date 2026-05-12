//! Query routes: structured, timeline, search.

use axum::extract::{Path, Query, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use chronicle_core::ids::{EntityId, EntityType, EventType, OrgId, Source, Topic};
use chronicle_core::query::{EventResult, OrderBy, SemanticQuery, StructuredQuery, TimelineQuery};
use chronicle_core::time_range::TimeRange;

use super::error::ApiError;
use crate::ServerState;

pub fn routes() -> Router<ServerState> {
    Router::new()
        .route("/v1/events", get(query_events))
        .route("/v1/timeline/:entity_type/:entity_id", get(timeline))
        .route("/v1/traces/:trace_id", get(trace_tree))
        .route("/v1/search", post(search))
}

/// Query parameters for `GET /v1/events`.
#[derive(Debug, Deserialize)]
pub struct QueryParams {
    pub org_id: String,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub topic: Option<String>,
    #[serde(default)]
    pub event_type: Option<String>,
    #[serde(default)]
    pub entity_type: Option<String>,
    #[serde(default)]
    pub entity_id: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: usize,
    #[serde(default)]
    pub offset: usize,
    /// "last_30d", "last_7d", etc.
    #[serde(default)]
    pub since: Option<String>,
}

fn default_limit() -> usize {
    50
}

/// `GET /v1/events?org_id=...&source=...&entity_type=...&entity_id=...`
async fn query_events(
    State(state): State<ServerState>,
    Query(params): Query<QueryParams>,
) -> Result<Json<Vec<EventResult>>, ApiError> {
    let entity = match (params.entity_type, params.entity_id) {
        (Some(t), Some(id)) => Some((EntityType::new(&t), EntityId::new(id))),
        _ => None,
    };

    let time_range = params.since.and_then(|s| parse_since(&s));

    let query = StructuredQuery {
        org_id: OrgId::new(&params.org_id),
        source: params.source.map(|s| Source::new(&s)),
        topic: params.topic.map(|t| Topic::new(&t)),
        event_type: params.event_type.map(|t| EventType::new(&t)),
        entity,
        time_range,
        payload_filters: vec![],
        group_by: None,
        order_by: OrderBy::EventTimeDesc,
        limit: params.limit,
        offset: params.offset,
    };

    let results = state.query.query(&query).await?;
    Ok(Json(results))
}

/// Path parameters for timeline.
#[derive(Debug, Deserialize)]
pub struct TimelineParams {
    pub entity_type: String,
    pub entity_id: String,
}

/// Query parameters for timeline.
#[derive(Debug, Deserialize)]
pub struct TimelineQueryParams {
    pub org_id: String,
    #[serde(default)]
    pub since: Option<String>,
    #[serde(default = "default_true")]
    pub include_linked: bool,
}

#[derive(Debug, Deserialize)]
pub struct TraceQueryParams {
    pub org_id: String,
}

#[derive(Debug, Serialize)]
pub struct TraceTreeResponse {
    pub trace_id: String,
    pub spans: Vec<TraceSpanNode>,
}

#[derive(Debug, Serialize, Clone)]
pub struct TraceSpanNode {
    pub span_id: String,
    pub parent_span_id: Option<String>,
    pub name: Option<String>,
    pub kind: Option<String>,
    pub status: Option<String>,
    pub event_id: Option<String>,
    pub started_at: Option<String>,
    pub ended_at: Option<String>,
    pub duration_ms: Option<f64>,
    pub attributes: Option<Value>,
    pub children: Vec<TraceSpanNode>,
}

fn default_true() -> bool {
    true
}

/// `GET /v1/timeline/{entity_type}/{entity_id}?org_id=...`
async fn timeline(
    State(state): State<ServerState>,
    Path(path): Path<TimelineParams>,
    Query(params): Query<TimelineQueryParams>,
) -> Result<Json<Vec<EventResult>>, ApiError> {
    let query = TimelineQuery {
        org_id: OrgId::new(&params.org_id),
        entity_type: EntityType::new(&path.entity_type),
        entity_id: EntityId::new(path.entity_id),
        time_range: params.since.and_then(|s| parse_since(&s)),
        sources: None,
        include_linked: params.include_linked,
        include_entity_refs: true,
        link_depth: 1,
        min_link_confidence: 0.7,
    };

    let results = state.query.timeline(&query).await?;
    Ok(Json(results))
}

async fn trace_tree(
    State(state): State<ServerState>,
    Path(trace_id): Path<String>,
    Query(params): Query<TraceQueryParams>,
) -> Result<Json<TraceTreeResponse>, ApiError> {
    let query = StructuredQuery {
        org_id: OrgId::new(&params.org_id),
        source: Some(Source::new("chronicle.sdk")),
        topic: Some(Topic::new("traces")),
        event_type: None,
        entity: None,
        time_range: None,
        payload_filters: vec![],
        group_by: None,
        order_by: OrderBy::EventTimeAsc,
        limit: 1_000,
        offset: 0,
    };

    let results = state.query.query(&query).await?;
    let mut nodes: Vec<TraceSpanNode> = results
        .into_iter()
        .filter_map(|result| {
            let payload = result.event.payload?;
            if payload.get("trace_id").and_then(Value::as_str) != Some(trace_id.as_str()) {
                return None;
            }
            Some(trace_node_from_payload(&payload))
        })
        .collect();

    let spans = build_trace_tree(&mut nodes);
    Ok(Json(TraceTreeResponse { trace_id, spans }))
}

fn trace_node_from_payload(payload: &Value) -> TraceSpanNode {
    TraceSpanNode {
        span_id: payload
            .get("span_id")
            .and_then(Value::as_str)
            .unwrap_or("unknown")
            .to_string(),
        parent_span_id: payload
            .get("parent_span_id")
            .and_then(Value::as_str)
            .map(ToString::to_string),
        name: payload
            .get("name")
            .and_then(Value::as_str)
            .map(ToString::to_string),
        kind: payload
            .get("kind")
            .and_then(Value::as_str)
            .map(ToString::to_string),
        status: payload
            .get("status")
            .and_then(Value::as_str)
            .map(ToString::to_string),
        event_id: payload
            .get("event_id")
            .and_then(Value::as_str)
            .map(ToString::to_string),
        started_at: payload
            .get("started_at")
            .and_then(Value::as_str)
            .map(ToString::to_string),
        ended_at: payload
            .get("ended_at")
            .and_then(Value::as_str)
            .map(ToString::to_string),
        duration_ms: payload.get("duration_ms").and_then(Value::as_f64),
        attributes: payload.get("attributes").cloned(),
        children: vec![],
    }
}

fn build_trace_tree(nodes: &mut Vec<TraceSpanNode>) -> Vec<TraceSpanNode> {
    let all = nodes.clone();
    let mut roots: Vec<_> = all
        .iter()
        .filter(|node| node.parent_span_id.is_none())
        .map(|node| build_trace_subtree(node, &all))
        .collect();

    if roots.is_empty() {
        roots = all
            .iter()
            .map(|node| build_trace_subtree(node, &all))
            .collect();
    }

    roots.sort_by(|a, b| a.span_id.cmp(&b.span_id));
    roots
}

fn build_trace_subtree(node: &TraceSpanNode, all: &[TraceSpanNode]) -> TraceSpanNode {
    let mut node = node.clone();
    node.children = all
        .iter()
        .filter(|candidate| candidate.parent_span_id.as_deref() == Some(node.span_id.as_str()))
        .map(|child| build_trace_subtree(child, all))
        .collect();
    node.children.sort_by(|a, b| a.span_id.cmp(&b.span_id));
    node
}

/// Request body for semantic search.
#[derive(Debug, Deserialize)]
pub struct SearchRequest {
    pub org_id: String,
    pub query: String,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub entity_type: Option<String>,
    #[serde(default)]
    pub entity_id: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: usize,
}

/// `POST /v1/search`
async fn search(
    State(state): State<ServerState>,
    Json(req): Json<SearchRequest>,
) -> Result<Json<Vec<EventResult>>, ApiError> {
    let entity = match (req.entity_type, req.entity_id) {
        (Some(t), Some(id)) => Some((EntityType::new(&t), EntityId::new(id))),
        _ => None,
    };

    let query = SemanticQuery {
        org_id: OrgId::new(&req.org_id),
        query_text: req.query,
        entity,
        source: req.source.map(|s| Source::new(&s)),
        time_range: None,
        limit: req.limit,
    };

    let results = state.query.search(&query).await?;
    Ok(Json(results))
}

/// Parse a "since" string like "last_30d" or "last_7d" into a [`TimeRange`].
fn parse_since(s: &str) -> Option<TimeRange> {
    let days = s
        .strip_prefix("last_")?
        .strip_suffix('d')?
        .parse::<i64>()
        .ok()?;
    Some(TimeRange::last_days(days))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_since_valid() {
        let range = parse_since("last_30d").unwrap();
        let dur = range.duration();
        assert!(dur.num_days() >= 29 && dur.num_days() <= 30);
    }

    #[test]
    fn parse_since_invalid() {
        assert!(parse_since("invalid").is_none());
        assert!(parse_since("30d").is_none());
        assert!(parse_since("last_xd").is_none());
    }
}
