//! Sources API
//!
//! Endpoints for discovering and managing event sources.

use axum::{
    body::Bytes,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Serialize;

use chronicle_sources_core::{IngestContext, SourceCapabilities, SourceManifest};
use chronicle_sources_registry::{all_manifests, get_source};

use crate::{ApiError, ApiResult, AppState};

/// Summary of a source for listing
#[derive(Debug, Serialize)]
pub struct SourceSummary {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub capabilities: SourceCapabilities,
}

impl From<&SourceManifest> for SourceSummary {
    fn from(manifest: &SourceManifest) -> Self {
        Self {
            id: manifest.id.to_string(),
            name: manifest.name.clone(),
            description: manifest.description.clone(),
            version: manifest.version.to_string(),
            capabilities: manifest.capabilities.clone(),
        }
    }
}

/// Response for listing sources
#[derive(Debug, Serialize)]
pub struct ListSourcesResponse {
    pub sources: Vec<SourceSummary>,
    pub count: usize,
}

/// List all registered sources
///
/// GET /api/sources
pub async fn list_sources() -> Json<ListSourcesResponse> {
    let manifests = all_manifests();
    let sources: Vec<SourceSummary> = manifests.iter().map(SourceSummary::from).collect();
    let count = sources.len();

    Json(ListSourcesResponse { sources, count })
}

/// Response for getting a single source
#[derive(Debug, Serialize)]
pub struct GetSourceResponse {
    pub manifest: SourceManifest,
}

/// Get a specific source by ID
///
/// GET /api/sources/:id
pub async fn get_source_by_id(Path(source_id): Path<String>) -> ApiResult<Json<GetSourceResponse>> {
    let source = get_source(&source_id)
        .ok_or_else(|| ApiError::NotFound(format!("Source not found: {}", source_id)))?;

    Ok(Json(GetSourceResponse {
        manifest: source.manifest().clone(),
    }))
}

/// Response for getting source catalog
#[derive(Debug, Serialize)]
pub struct GetCatalogResponse {
    pub source_id: String,
    pub events: Vec<EventTypeSummary>,
}

/// Summary of an event type
#[derive(Debug, Serialize)]
pub struct EventTypeSummary {
    pub event_type: String,
    pub source_topic: String,
    pub description: String,
    pub category: String,
    pub pii_fields: Vec<String>,
}

/// Get the event catalog for a source
///
/// GET /api/sources/:id/catalog
pub async fn get_source_catalog(
    Path(source_id): Path<String>,
) -> ApiResult<Json<GetCatalogResponse>> {
    let source = get_source(&source_id)
        .ok_or_else(|| ApiError::NotFound(format!("Source not found: {}", source_id)))?;

    let events: Vec<EventTypeSummary> = source
        .manifest()
        .event_catalog
        .iter()
        .map(|e| EventTypeSummary {
            event_type: e.event_type.clone(),
            source_topic: e.source_topic.clone(),
            description: e.description.clone(),
            category: e.category.clone(),
            pii_fields: e.pii_fields.clone(),
        })
        .collect();

    Ok(Json(GetCatalogResponse { source_id, events }))
}

/// Response for webhook handling
#[derive(Debug, Serialize)]
pub struct WebhookResponse {
    pub received: bool,
    pub event_ids: Vec<String>,
    pub message: String,
}

/// Handle webhook for any registered source
///
/// POST /api/webhooks/:source_id
pub async fn handle_webhook(
    State(state): State<AppState>,
    Path(source_id): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> ApiResult<Json<WebhookResponse>> {
    // Get the source adapter
    let source = get_source(&source_id).ok_or_else(|| {
        tracing::warn!(source_id = %source_id, "Webhook received for unknown source");
        ApiError::NotFound(format!("Source not found: {}", source_id))
    })?;

    // Check if source supports webhooks
    let webhook_handler = source.as_webhook_handler().ok_or_else(|| {
        tracing::warn!(source_id = %source_id, "Source does not support webhooks");
        ApiError::BadRequest(format!("Source {} does not support webhooks", source_id))
    })?;

    // Get webhook secret from environment (source-specific)
    let secret_env_var = format!("{}_WEBHOOK_SECRET", source_id.to_uppercase());
    let webhook_secret = std::env::var(&secret_env_var).ok();

    // Verify signature if secret is configured
    if let Some(ref secret) = webhook_secret {
        tracing::debug!(
            source_id = %source_id,
            "Verifying webhook signature"
        );

        webhook_handler
            .verify_signature(&headers, &body, secret)
            .await
            .map_err(|e| {
                tracing::warn!(
                    source_id = %source_id,
                    error = %e,
                    "Webhook signature verification failed"
                );
                ApiError::Unauthorized(format!("Invalid webhook signature: {}", e))
            })?;

        tracing::debug!(source_id = %source_id, "Webhook signature verified");
    } else {
        tracing::debug!(
            source_id = %source_id,
            secret_env_var = %secret_env_var,
            "Skipping signature verification (secret not set)"
        );
    }

    // Create ingest context
    let context = IngestContext::new(state.default_tenant.clone());

    // Handle the webhook
    let events = webhook_handler
        .handle_webhook(&headers, body, &context)
        .await
        .map_err(|e| {
            tracing::error!(
                source_id = %source_id,
                error = %e,
                "Failed to process webhook"
            );
            ApiError::BadRequest(format!("Failed to process webhook: {}", e))
        })?;

    // Check for duplicates and store/publish events
    let mut event_ids = Vec::new();
    let mut stored_count = 0;

    for event in events {
        // Check for duplicate
        let exists = state
            .store
            .exists(&event.tenant_id, &event.source, &event.source_event_id)
            .await?;

        if exists {
            tracing::debug!(
                source_event_id = %event.source_event_id,
                "Skipping duplicate event"
            );
            continue;
        }

        let event_id = event.event_id.to_string();
        let event_type = event.event_type.clone();

        // Store and publish
        state.store.append(std::slice::from_ref(&event)).await?;
        state.stream.publish(event).await?;

        tracing::info!(
            event_id = %event_id,
            event_type = %event_type,
            source_id = %source_id,
            "Webhook event processed and stored"
        );

        event_ids.push(event_id);
        stored_count += 1;
    }

    let message = if stored_count == 0 {
        "All events were duplicates".to_string()
    } else {
        format!("Processed {} event(s)", stored_count)
    };

    Ok(Json(WebhookResponse {
        received: true,
        event_ids,
        message,
    }))
}

/// Verify webhook endpoint (for providers that send HEAD/GET to verify)
///
/// HEAD /api/webhooks/:source_id
pub async fn verify_webhook(Path(source_id): Path<String>) -> StatusCode {
    // Check if source exists and supports webhooks
    if let Some(source) = get_source(&source_id) {
        if source.as_webhook_handler().is_some() {
            return StatusCode::OK;
        }
    }

    StatusCode::NOT_FOUND
}
