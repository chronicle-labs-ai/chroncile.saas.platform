//! Event Streaming Endpoints

use std::convert::Infallible;
use std::time::Duration;

use axum::{
    extract::{Path, Query, State},
    response::sse::{Event, KeepAlive, Sse},
    Json,
};
use chrono::{DateTime, Utc};
use futures::stream::Stream;
use serde::{Deserialize, Serialize};

use chronicle_domain::{sort_for_replay, EventEnvelope, EventQuery, SubjectId, TenantId, TimeRange};

use crate::{ApiError, ApiResult, AppState};

#[derive(Debug, Deserialize)]
pub struct StreamParams {
    /// Filter by event type
    pub event_type: Option<String>,
    /// Filter by conversation
    pub conversation_id: Option<String>,
    /// Tenant ID (required for multi-tenancy)
    pub tenant_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TimelineParams {
    /// Hours to look back (default: 24)
    #[serde(default = "default_hours")]
    pub hours: i64,
    /// Tenant ID (required for multi-tenancy)
    pub tenant_id: Option<String>,
}

fn default_hours() -> i64 {
    24
}

/// Query parameters for advanced event filtering
#[derive(Debug, Deserialize)]
pub struct EventQueryParams {
    /// Start of time range (ISO 8601)
    pub start: Option<DateTime<Utc>>,
    /// End of time range (ISO 8601)
    pub end: Option<DateTime<Utc>>,
    /// Filter by sources (can be repeated)
    #[serde(default)]
    pub source: Vec<String>,
    /// Filter by event types (can be repeated)
    #[serde(default)]
    pub event_type: Vec<String>,
    /// Filter by actors (can be repeated)
    #[serde(default)]
    pub actor: Vec<String>,
    /// Filter by subjects/conversation IDs (can be repeated)
    #[serde(default)]
    pub subject: Vec<String>,
    /// Maximum events to return
    pub limit: Option<usize>,
    /// Tenant ID (required for multi-tenancy)
    pub tenant_id: Option<String>,
}

impl EventQueryParams {
    /// Convert to domain EventQuery
    fn to_event_query(&self) -> EventQuery {
        let mut query = EventQuery::new();

        // Time range
        if let (Some(start), Some(end)) = (self.start, self.end) {
            query = query.with_time_range(TimeRange::new(start, end));
        } else if let Some(start) = self.start {
            query = query.with_time_range(TimeRange::new(start, Utc::now()));
        } else if let Some(end) = self.end {
            // Default to 24 hours before end
            query = query.with_time_range(TimeRange::new(end - chrono::Duration::hours(24), end));
        }

        if !self.source.is_empty() {
            query = query.with_sources(self.source.clone());
        }

        if !self.event_type.is_empty() {
            query = query.with_event_types(self.event_type.clone());
        }

        if !self.actor.is_empty() {
            query = query.with_actors(self.actor.clone());
        }

        if !self.subject.is_empty() {
            query = query.with_subjects(self.subject.clone());
        }

        if let Some(limit) = self.limit {
            query = query.with_limit(limit);
        }

        query
    }
}

#[derive(Debug, Serialize)]
pub struct TimelineResponse {
    pub conversation_id: String,
    pub events: Vec<EventEnvelopeDto>,
    pub count: usize,
}

/// DTO for event envelope (serializable)
#[derive(Debug, Serialize)]
pub struct EventEnvelopeDto {
    pub event_id: String,
    pub tenant_id: String,
    pub source: String,
    pub source_event_id: String,
    pub event_type: String,
    pub conversation_id: String,
    pub actor_type: String,
    pub actor_id: String,
    pub actor_name: Option<String>,
    pub occurred_at: chrono::DateTime<chrono::Utc>,
    pub ingested_at: chrono::DateTime<chrono::Utc>,
    pub payload: serde_json::Value,
    pub contains_pii: bool,
}

impl From<EventEnvelope> for EventEnvelopeDto {
    fn from(e: EventEnvelope) -> Self {
        Self {
            event_id: e.event_id.to_string(),
            tenant_id: e.tenant_id.to_string(),
            source: e.source,
            source_event_id: e.source_event_id,
            event_type: e.event_type,
            conversation_id: e.subject.conversation_id.to_string(),
            actor_type: format!("{:?}", e.actor.actor_type).to_lowercase(),
            actor_id: e.actor.actor_id,
            actor_name: e.actor.display_name,
            occurred_at: e.occurred_at,
            ingested_at: e.ingested_at,
            payload: serde_json::from_str(e.payload.get()).unwrap_or(serde_json::json!({})),
            contains_pii: e.pii.contains_pii,
        }
    }
}

/// List recent events (for debugging/polling fallback)
pub async fn list_events(
    State(state): State<AppState>,
    Query(params): Query<StreamParams>,
) -> Json<EventsListResponse> {
    let buffered = state.stream.get_buffer();
    
    let events: Vec<EventEnvelopeDto> = buffered
        .into_iter()
        .filter(|e| {
            if let Some(ref et) = params.event_type {
                if !e.event_type.contains(et) {
                    return false;
                }
            }
            if let Some(ref conv) = params.conversation_id {
                if e.subject.conversation_id.as_str() != conv {
                    return false;
                }
            }
            true
        })
        .map(EventEnvelopeDto::from)
        .collect();
    
    let count = events.len();
    Json(EventsListResponse { events, count })
}

#[derive(Debug, Serialize)]
pub struct EventsListResponse {
    pub events: Vec<EventEnvelopeDto>,
    pub count: usize,
}

/// Response for query_events endpoint
#[derive(Debug, Serialize)]
pub struct EventsQueryResponse {
    pub events: Vec<EventEnvelopeDto>,
    pub count: usize,
    /// Available sources for filtering
    pub sources: Vec<String>,
    /// Available event types for filtering
    pub event_types: Vec<String>,
}

/// Query events with advanced filtering (tenant-based)
/// GET /api/events/query?start=...&end=...&source=intercom&event_type=ticket.*&tenant_id=...
pub async fn query_events(
    State(state): State<AppState>,
    Query(params): Query<EventQueryParams>,
) -> ApiResult<Json<EventsQueryResponse>> {
    let tenant_id = params.tenant_id
        .clone()
        .map(|t| TenantId::new(t))
        .ok_or_else(|| ApiError::BadRequest("tenant_id is required".to_string()))?;
    
    let query = params.to_event_query();
    
    let result = state.store.query(&tenant_id, &query).await?;
    
    let events: Vec<EventEnvelopeDto> = result
        .events
        .into_iter()
        .map(EventEnvelopeDto::from)
        .collect();
    
    let count = events.len();
    
    Ok(Json(EventsQueryResponse {
        events,
        count,
        sources: result.available_sources,
        event_types: result.available_event_types,
    }))
}

/// Get available sources for current tenant
pub async fn list_sources(
    State(state): State<AppState>,
    Query(params): Query<EventQueryParams>,
) -> ApiResult<Json<Vec<String>>> {
    let tenant_id = params.tenant_id
        .map(|t| TenantId::new(t))
        .ok_or_else(|| ApiError::BadRequest("tenant_id is required".to_string()))?;
    let sources = state.store.list_sources(&tenant_id).await?;
    Ok(Json(sources))
}

/// Get available event types for current tenant
pub async fn list_event_types(
    State(state): State<AppState>,
    Query(params): Query<EventQueryParams>,
) -> ApiResult<Json<Vec<String>>> {
    let tenant_id = params.tenant_id
        .map(|t| TenantId::new(t))
        .ok_or_else(|| ApiError::BadRequest("tenant_id is required".to_string()))?;
    let event_types = state.store.list_event_types(&tenant_id).await?;
    Ok(Json(event_types))
}

/// Stream events via SSE (Server-Sent Events)
///
/// This is push-based - no polling! Subscribers are notified immediately.
pub async fn stream_events(
    State(state): State<AppState>,
    Query(params): Query<StreamParams>,
) -> ApiResult<Sse<impl Stream<Item = Result<Event, Infallible>> + Send>> {
    let tenant_id = params.tenant_id
        .map(|t| TenantId::new(t))
        .ok_or_else(|| ApiError::BadRequest("tenant_id is required".to_string()))?;
    
    tracing::info!("SSE client connected to /api/stream for tenant: {}", tenant_id.as_str());
    
    // Subscribe to the broadcast channel
    let mut receiver = state.stream.subscribe();

    let event_type_filter = params.event_type;
    let conversation_filter = params.conversation_id;

    let stream = async_stream::stream! {
        // First, send any buffered events (replay recent history)
        let buffered = state.stream.get_buffer();
        for event in buffered {
            // Filter by tenant
            if event.tenant_id != tenant_id {
                continue;
            }
            
            // Apply filters
            if let Some(ref et) = event_type_filter {
                if !event.event_type.contains(et) {
                    continue;
                }
            }
            if let Some(ref conv) = conversation_filter {
                if event.subject.conversation_id.as_str() != conv {
                    continue;
                }
            }

            let dto = EventEnvelopeDto::from(event);
            if let Ok(data) = serde_json::to_string(&dto) {
                yield Ok(Event::default().event("event").data(data));
            }
        }

        // Then stream live events
        loop {
            match receiver.recv().await {
                Ok(event) => {
                    // Filter by tenant
                    if event.tenant_id != tenant_id {
                        continue;
                    }
                    
                    // Apply filters
                    if let Some(ref et) = event_type_filter {
                        if !event.event_type.contains(et) {
                            continue;
                        }
                    }
                    if let Some(ref conv) = conversation_filter {
                        if event.subject.conversation_id.as_str() != conv {
                            continue;
                        }
                    }

                    let dto = EventEnvelopeDto::from(event);
                    if let Ok(data) = serde_json::to_string(&dto) {
                        yield Ok(Event::default().event("event").data(data));
                    }
                }
                Err(chronicle_domain::StreamError::ChannelClosed) => {
                    yield Ok(Event::default().event("close").data("Channel closed"));
                    break;
                }
                Err(_) => {
                    // Log and continue on other errors
                    continue;
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

/// Get timeline for a conversation
pub async fn get_timeline(
    State(state): State<AppState>,
    Path(conversation_id): Path<String>,
    Query(params): Query<TimelineParams>,
) -> ApiResult<Json<TimelineResponse>> {
    let tenant_id = params.tenant_id
        .clone()
        .map(|t| TenantId::new(t))
        .ok_or_else(|| ApiError::BadRequest("tenant_id is required".to_string()))?;
    
    let range = TimeRange::last_hours(params.hours);

    let events = state
        .store
        .fetch_by_conversation(&tenant_id, &SubjectId::new(&conversation_id))
        .await?;

    // Filter by time range and sort
    let filtered: Vec<_> = events
        .into_iter()
        .filter(|e| range.contains(&e.occurred_at))
        .collect();

    let sorted = sort_for_replay(filtered);
    let count = sorted.len();

    let event_dtos: Vec<EventEnvelopeDto> = sorted.into_iter().map(EventEnvelopeDto::from).collect();

    Ok(Json(TimelineResponse {
        conversation_id,
        events: event_dtos,
        count,
    }))
}
