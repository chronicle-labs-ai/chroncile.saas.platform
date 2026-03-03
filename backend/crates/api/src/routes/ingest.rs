//! Event Ingestion Endpoints

use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};

use chronicle_domain::{Actor, EventEnvelope, PiiFlags, Subject, TenantId};

use crate::{ApiError, ApiResult, AppState};

/// Request to ingest a single event
#[derive(Debug, Deserialize)]
pub struct IngestEventRequest {
    /// Source system identifier
    pub source: String,
    /// Event ID from source (for deduplication)
    pub source_event_id: String,
    /// Event type (e.g., "support.message.customer")
    pub event_type: String,
    /// Conversation/subject ID
    pub conversation_id: String,
    /// Optional ticket ID
    pub ticket_id: Option<String>,
    /// Optional customer ID
    pub customer_id: Option<String>,
    /// Actor type: "customer", "agent", or "system"
    pub actor_type: String,
    /// Actor ID
    pub actor_id: String,
    /// Actor display name
    pub actor_name: Option<String>,
    /// Event payload (arbitrary JSON)
    pub payload: serde_json::Value,
    /// Whether payload contains PII
    #[serde(default)]
    pub contains_pii: bool,
    /// Optional timestamp (defaults to now)
    pub occurred_at: Option<chrono::DateTime<chrono::Utc>>,
    /// Optional tenant ID (defaults to default_tenant for backward compatibility)
    pub tenant_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct IngestResponse {
    pub event_id: String,
    pub ingested: bool,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct BatchIngestResponse {
    pub ingested: usize,
    pub duplicates: usize,
    pub message: String,
}

/// Ingest a single event
pub async fn ingest_event(
    State(state): State<AppState>,
    Json(req): Json<IngestEventRequest>,
) -> ApiResult<Json<IngestResponse>> {
    let tenant_id = req.tenant_id
        .map(|t| TenantId::new(t))
        .unwrap_or_else(|| state.default_tenant.clone());

    // Check for duplicate
    let exists = state
        .store
        .exists(&tenant_id, &req.source, &req.source_event_id)
        .await?;

    if exists {
        return Ok(Json(IngestResponse {
            event_id: String::new(),
            ingested: false,
            message: "Event already exists (duplicate)".to_string(),
        }));
    }

    // Build the event
    let actor = match req.actor_type.as_str() {
        "customer" => Actor::customer(&req.actor_id),
        "agent" => Actor::agent(&req.actor_id),
        _ => Actor::system(),
    };

    let actor = if let Some(name) = req.actor_name {
        actor.with_name(name)
    } else {
        actor
    };

    let mut subject = Subject::new(req.conversation_id.clone());
    if let Some(ticket_id) = req.ticket_id {
        subject = subject.with_ticket(ticket_id);
    }
    if let Some(customer_id) = req.customer_id {
        subject = subject.with_customer(customer_id);
    }

    let payload = EventEnvelope::make_payload(&req.payload)
        .map_err(|e| ApiError::BadRequest(format!("Invalid payload: {}", e)))?;

    let mut event = EventEnvelope::new(
        tenant_id,
        req.source,
        req.source_event_id,
        req.event_type,
        subject,
        actor,
        payload,
    );

    if let Some(occurred_at) = req.occurred_at {
        event = event.with_occurred_at(occurred_at);
    }

    if req.contains_pii {
        event = event.with_pii(PiiFlags::with_fields(vec!["payload".to_string()]));
    }

    let event_id = event.event_id.to_string();

    // Store and publish
    state.store.append(&[event.clone()]).await?;
    state.stream.publish(event).await?;

    Ok(Json(IngestResponse {
        event_id,
        ingested: true,
        message: "Event ingested successfully".to_string(),
    }))
}

/// Ingest a batch of events
pub async fn ingest_batch(
    State(state): State<AppState>,
    Json(events): Json<Vec<IngestEventRequest>>,
) -> ApiResult<Json<BatchIngestResponse>> {
    let mut ingested = 0;
    let mut duplicates = 0;

    for req in events {
        let tenant_id = req.tenant_id
            .map(|t| TenantId::new(t))
            .unwrap_or_else(|| state.default_tenant.clone());

        // Check for duplicate
        let exists = state
            .store
            .exists(&tenant_id, &req.source, &req.source_event_id)
            .await?;

        if exists {
            duplicates += 1;
            continue;
        }

        // Build the event
        let actor = match req.actor_type.as_str() {
            "customer" => Actor::customer(&req.actor_id),
            "agent" => Actor::agent(&req.actor_id),
            _ => Actor::system(),
        };

        let actor = if let Some(name) = req.actor_name {
            actor.with_name(name)
        } else {
            actor
        };

        let mut subject = Subject::new(req.conversation_id.clone());
        if let Some(ticket_id) = req.ticket_id {
            subject = subject.with_ticket(ticket_id);
        }
        if let Some(customer_id) = req.customer_id {
            subject = subject.with_customer(customer_id);
        }

        let payload = EventEnvelope::make_payload(&req.payload)
            .map_err(|e| ApiError::BadRequest(format!("Invalid payload: {}", e)))?;

        let mut event = EventEnvelope::new(
            tenant_id,
            req.source,
            req.source_event_id,
            req.event_type,
            subject,
            actor,
            payload,
        );

        if let Some(occurred_at) = req.occurred_at {
            event = event.with_occurred_at(occurred_at);
        }

        if req.contains_pii {
            event = event.with_pii(PiiFlags::with_fields(vec!["payload".to_string()]));
        }

        state.store.append(&[event.clone()]).await?;
        state.stream.publish(event).await?;
        ingested += 1;
    }

    Ok(Json(BatchIngestResponse {
        ingested,
        duplicates,
        message: format!(
            "Batch processed: {} ingested, {} duplicates skipped",
            ingested, duplicates
        ),
    }))
}
