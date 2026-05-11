use std::convert::Infallible;
use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use std::collections::HashMap;

use axum::{
    extract::{Path, Query, State},
    response::sse::{Event, KeepAlive, Sse},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use futures::stream::Stream;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;

use chronicle_core::error::{ChronicleError, ValidationError};
use chronicle_core::event::EventBuilder;
use chronicle_core::ids::{
    Confidence, EntityId, EntityType, EventId, EventType, LinkId, OrgId, Source, Topic,
};
use chronicle_core::link::{EventLink, LinkDirection};
use chronicle_core::query::{
    EventResult, GraphQuery, OrderBy, SemanticQuery, StructuredQuery, TimelineQuery,
};
use chronicle_core::time_range::TimeRange;
use chronicle_store::traits::{EntityInfo, EntityTypeInfo, SourceInfo, SourceSchema};
use chronicle_store::{EventHandler, SubFilter, SubscriptionPosition};

use crate::{ApiError, AppState};

pub fn build_native_routes() -> Router<AppState> {
    Router::new()
        .route("/v1/events/stream", get(stream_events))
        .route("/v1/events", get(query_events).post(ingest_event))
        .route("/v1/events/batch", post(ingest_batch))
        .route("/v1/timeline/:entity_type/:entity_id", get(timeline))
        .route("/v1/search", post(search))
        .route("/v1/discover/sources", get(describe_sources))
        .route("/v1/discover/entity-types", get(describe_entity_types))
        .route("/v1/discover/entities/:entity_type", get(list_entities))
        .route(
            "/v1/discover/schema/:source/:event_type",
            get(describe_schema),
        )
        .route("/v1/entity-refs", post(add_entity_ref))
        .route("/v1/event-links", post(create_link))
        .route("/v1/link-entity", post(link_entity))
        .route("/v1/graph", post(traverse_graph))
}

#[derive(Debug, Deserialize)]
pub struct IngestRequest {
    pub org_id: String,
    pub source: String,
    pub topic: String,
    pub event_type: String,
    #[serde(default)]
    pub entities: HashMap<String, String>,
    #[serde(default)]
    pub payload: Option<serde_json::Value>,
    #[serde(default)]
    pub timestamp: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize)]
pub struct IngestResponse {
    pub event_ids: Vec<String>,
    pub count: usize,
}

#[derive(Debug, Deserialize)]
pub struct StreamQueryParams {
    pub org_id: String,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub event_type: Option<String>,
    #[serde(default)]
    pub entity_type: Option<String>,
    #[serde(default)]
    pub entity_id: Option<String>,
}

struct SseEventHandler {
    sender: mpsc::UnboundedSender<EventResult>,
}

#[async_trait]
impl EventHandler for SseEventHandler {
    async fn handle(
        &self,
        event: &chronicle_core::event::Event,
    ) -> Result<(), chronicle_core::error::StoreError> {
        self.sender
            .send(EventResult {
                event: event.clone(),
                entity_refs: vec![],
                search_distance: None,
            })
            .map_err(|error| chronicle_core::error::StoreError::Internal(error.to_string()))
    }
}

async fn ingest_event(
    State(state): State<AppState>,
    Json(req): Json<IngestRequest>,
) -> Result<Json<IngestResponse>, ApiError> {
    let event = build_event(req);
    let ids = state.store.insert_events(&[event]).await?;
    Ok(Json(IngestResponse {
        count: ids.len(),
        event_ids: ids.iter().map(ToString::to_string).collect(),
    }))
}

async fn ingest_batch(
    State(state): State<AppState>,
    Json(requests): Json<Vec<IngestRequest>>,
) -> Result<Json<IngestResponse>, ApiError> {
    let events: Vec<_> = requests.into_iter().map(build_event).collect();
    let ids = state.store.insert_events(&events).await?;
    Ok(Json(IngestResponse {
        count: ids.len(),
        event_ids: ids.iter().map(ToString::to_string).collect(),
    }))
}

async fn stream_events(
    State(state): State<AppState>,
    Query(params): Query<StreamQueryParams>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>> + Send>, ApiError> {
    let subscriptions = state.store.subscription_service().ok_or_else(|| {
        ApiError::Store("store backend does not support subscriptions".to_string())
    })?;

    let filter = build_stream_filter(&params)?;
    let (sender, mut receiver) = mpsc::unbounded_channel::<EventResult>();
    let handle = subscriptions
        .subscribe(
            filter,
            SubscriptionPosition::End,
            Arc::new(SseEventHandler { sender }),
        )
        .await
        .map_err(|error| ApiError::Store(error.to_string()))?;

    let stream = async_stream::stream! {
        let _subscription_handle = handle;

        while let Some(event) = receiver.recv().await {
            match serde_json::to_string(&event) {
                Ok(data) => yield Ok(Event::default().event("event").data(data)),
                Err(error) => {
                    tracing::warn!(error = %error, "failed to serialize live event");
                }
            }
        }
    };

    Ok(Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("ping"),
    ))
}

fn build_stream_filter(params: &StreamQueryParams) -> Result<SubFilter, ApiError> {
    let entity = match (params.entity_type.as_deref(), params.entity_id.as_deref()) {
        (Some(entity_type), Some(entity_id)) => Some((
            EntityType::new(entity_type),
            EntityId::new(entity_id.to_string()),
        )),
        (None, None) => None,
        _ => {
            return Err(ApiError::BadRequest(
                "entity_type and entity_id must be provided together".to_string(),
            ));
        }
    };

    Ok(SubFilter {
        org_id: Some(OrgId::new(&params.org_id)),
        sources: params
            .source
            .as_ref()
            .map(|source| vec![Source::new(source)]),
        event_types: params
            .event_type
            .as_ref()
            .map(|event_type| vec![EventType::new(event_type)]),
        entity,
        payload_contains: None,
    })
}

fn build_event(req: IngestRequest) -> chronicle_core::event::Event {
    let mut builder = EventBuilder::new(
        req.org_id.as_str(),
        req.source.as_str(),
        req.topic.as_str(),
        req.event_type.as_str(),
    );

    for (entity_type, entity_id) in req.entities {
        builder = builder.entity(entity_type, entity_id);
    }

    if let Some(payload) = req.payload {
        builder = builder.payload(payload);
    }

    if let Some(timestamp) = req.timestamp {
        builder = builder.event_time(timestamp);
    }

    builder.build()
}

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
    #[serde(default)]
    pub since: Option<String>,
}

fn default_limit() -> usize {
    50
}

async fn query_events(
    State(state): State<AppState>,
    Query(params): Query<QueryParams>,
) -> Result<Json<Vec<EventResult>>, ApiError> {
    let entity = match (params.entity_type, params.entity_id) {
        (Some(entity_type), Some(entity_id)) => {
            Some((EntityType::new(&entity_type), EntityId::new(entity_id)))
        }
        _ => None,
    };

    let query = StructuredQuery {
        org_id: OrgId::new(&params.org_id),
        entity,
        source: params.source.map(|source| Source::new(&source)),
        topic: params.topic.map(|topic| Topic::new(&topic)),
        event_type: params
            .event_type
            .map(|event_type| EventType::new(&event_type)),
        time_range: params.since.as_deref().and_then(parse_since),
        payload_filters: vec![],
        group_by: None,
        order_by: OrderBy::EventTimeDesc,
        limit: params.limit,
        offset: params.offset,
    };

    Ok(Json(state.query.query(&query).await?))
}

#[derive(Debug, Deserialize)]
pub struct TimelinePath {
    pub entity_type: String,
    pub entity_id: String,
}

#[derive(Debug, Deserialize)]
pub struct TimelineParams {
    pub org_id: String,
    #[serde(default)]
    pub since: Option<String>,
    #[serde(default = "default_true")]
    pub include_linked: bool,
}

fn default_true() -> bool {
    true
}

async fn timeline(
    State(state): State<AppState>,
    Path(path): Path<TimelinePath>,
    Query(params): Query<TimelineParams>,
) -> Result<Json<Vec<EventResult>>, ApiError> {
    let query = TimelineQuery {
        org_id: OrgId::new(&params.org_id),
        entity_type: EntityType::new(&path.entity_type),
        entity_id: EntityId::new(path.entity_id),
        time_range: params.since.as_deref().and_then(parse_since),
        sources: None,
        include_linked: params.include_linked,
        include_entity_refs: true,
        link_depth: 1,
        min_link_confidence: 0.7,
    };

    Ok(Json(state.query.timeline(&query).await?))
}

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

async fn search(
    State(state): State<AppState>,
    Json(req): Json<SearchRequest>,
) -> Result<Json<Vec<EventResult>>, ApiError> {
    let entity = match (req.entity_type, req.entity_id) {
        (Some(entity_type), Some(entity_id)) => {
            Some((EntityType::new(&entity_type), EntityId::new(entity_id)))
        }
        _ => None,
    };

    let query = SemanticQuery {
        org_id: OrgId::new(&req.org_id),
        query_text: req.query,
        entity,
        source: req.source.map(|source| Source::new(&source)),
        time_range: None,
        limit: req.limit,
    };

    Ok(Json(state.query.search(&query).await?))
}

#[derive(Debug, Deserialize)]
pub struct OrgQuery {
    pub org_id: String,
}

async fn describe_sources(
    State(state): State<AppState>,
    Query(params): Query<OrgQuery>,
) -> Result<Json<Vec<SourceInfo>>, ApiError> {
    Ok(Json(
        state
            .query
            .describe_sources(&OrgId::new(&params.org_id))
            .await?,
    ))
}

async fn describe_entity_types(
    State(state): State<AppState>,
    Query(params): Query<OrgQuery>,
) -> Result<Json<Vec<EntityTypeInfo>>, ApiError> {
    Ok(Json(
        state
            .query
            .describe_entity_types(&OrgId::new(&params.org_id))
            .await?,
    ))
}

#[derive(Debug, Deserialize)]
pub struct ListEntitiesPath {
    pub entity_type: String,
}

#[derive(Debug, Deserialize)]
pub struct ListEntitiesQuery {
    pub org_id: String,
    #[serde(default = "default_entities_limit")]
    pub limit: usize,
}

fn default_entities_limit() -> usize {
    100
}

async fn list_entities(
    State(state): State<AppState>,
    Path(path): Path<ListEntitiesPath>,
    Query(params): Query<ListEntitiesQuery>,
) -> Result<Json<Vec<EntityInfo>>, ApiError> {
    Ok(Json(
        state
            .query
            .list_entities(
                &OrgId::new(&params.org_id),
                &EntityType::new(&path.entity_type),
                params.limit,
            )
            .await?,
    ))
}

#[derive(Debug, Deserialize)]
pub struct SchemaPath {
    pub source: String,
    pub event_type: String,
}

async fn describe_schema(
    State(state): State<AppState>,
    Path(path): Path<SchemaPath>,
    Query(params): Query<OrgQuery>,
) -> Result<Json<Option<SourceSchema>>, ApiError> {
    Ok(Json(
        state
            .query
            .describe_schema(
                &OrgId::new(&params.org_id),
                &Source::new(&path.source),
                &EventType::new(&path.event_type),
            )
            .await?,
    ))
}

#[derive(Debug, Deserialize)]
pub struct AddEntityRefRequest {
    pub org_id: String,
    pub event_id: String,
    pub entity_type: String,
    pub entity_id: String,
    #[serde(default = "default_created_by")]
    pub created_by: String,
}

fn default_created_by() -> String {
    "api".to_string()
}

async fn add_entity_ref(
    State(state): State<AppState>,
    Json(req): Json<AddEntityRefRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let event_id = parse_event_id("event_id", &req.event_id)?;

    state
        .link
        .add_entity_ref(
            &OrgId::new(&req.org_id),
            event_id,
            req.entity_type.as_str(),
            req.entity_id.as_str(),
            &req.created_by,
        )
        .await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

#[derive(Debug, Deserialize)]
pub struct CreateLinkRequest {
    pub org_id: String,
    pub source_event_id: String,
    pub target_event_id: String,
    pub link_type: String,
    pub confidence: f32,
    #[serde(default)]
    pub reasoning: Option<String>,
    #[serde(default = "default_created_by")]
    pub created_by: String,
}

#[derive(Debug, Serialize)]
pub struct CreateLinkResponse {
    pub link_id: String,
}

async fn create_link(
    State(state): State<AppState>,
    Json(req): Json<CreateLinkRequest>,
) -> Result<Json<CreateLinkResponse>, ApiError> {
    let source_event_id = parse_event_id("source_event_id", &req.source_event_id)?;
    let target_event_id = parse_event_id("target_event_id", &req.target_event_id)?;
    let confidence = Confidence::new(req.confidence).map_err(|err| {
        ChronicleError::Validation(ValidationError::InvalidValue {
            field: "confidence",
            reason: err.to_string(),
        })
    })?;

    let link = EventLink {
        link_id: LinkId::new(),
        source_event_id,
        target_event_id,
        link_type: req.link_type,
        confidence,
        reasoning: req.reasoning,
        created_by: req.created_by,
        created_at: Utc::now(),
    };

    let link_id = state
        .link
        .create_link(&OrgId::new(&req.org_id), &link)
        .await?;

    Ok(Json(CreateLinkResponse {
        link_id: link_id.to_string(),
    }))
}

#[derive(Debug, Deserialize)]
pub struct LinkEntityRequest {
    pub org_id: String,
    pub from_entity_type: String,
    pub from_entity_id: String,
    pub to_entity_type: String,
    pub to_entity_id: String,
    #[serde(default = "default_created_by")]
    pub created_by: String,
}

#[derive(Debug, Serialize)]
pub struct LinkEntityResponse {
    pub linked_count: u64,
}

async fn link_entity(
    State(state): State<AppState>,
    Json(req): Json<LinkEntityRequest>,
) -> Result<Json<LinkEntityResponse>, ApiError> {
    let linked_count = state
        .link
        .link_entity(
            &OrgId::new(&req.org_id),
            req.from_entity_type.as_str(),
            req.from_entity_id.as_str(),
            req.to_entity_type.as_str(),
            req.to_entity_id.as_str(),
            &req.created_by,
        )
        .await?;

    Ok(Json(LinkEntityResponse { linked_count }))
}

#[derive(Debug, Deserialize)]
pub struct GraphRequest {
    pub org_id: String,
    pub start_event_id: String,
    pub direction: LinkDirection,
    #[serde(default)]
    pub link_types: Option<Vec<String>>,
    #[serde(default = "default_graph_depth")]
    pub max_depth: u32,
    #[serde(default)]
    pub min_confidence: f32,
}

fn default_graph_depth() -> u32 {
    3
}

async fn traverse_graph(
    State(state): State<AppState>,
    Json(req): Json<GraphRequest>,
) -> Result<Json<Vec<EventResult>>, ApiError> {
    let start_event_id = parse_event_id("start_event_id", &req.start_event_id)?;
    let query = GraphQuery {
        org_id: OrgId::new(&req.org_id),
        start_event_id,
        direction: req.direction,
        link_types: req.link_types,
        max_depth: req.max_depth,
        min_confidence: req.min_confidence,
    };

    Ok(Json(state.link.traverse(&query).await?))
}

fn parse_since(value: &str) -> Option<TimeRange> {
    let days = value
        .strip_prefix("last_")?
        .strip_suffix('d')?
        .parse::<i64>()
        .ok()?;
    Some(TimeRange::last_days(days))
}

fn parse_event_id(field: &'static str, value: &str) -> Result<EventId, ApiError> {
    value.parse::<EventId>().map_err(|err| {
        ChronicleError::Validation(ValidationError::InvalidValue {
            field,
            reason: err.to_string(),
        })
        .into()
    })
}
