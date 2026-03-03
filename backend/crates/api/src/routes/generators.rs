//! Generator Control API
//!
//! Endpoints for starting, stopping, and monitoring event generators.

use std::collections::HashMap;
use std::sync::Arc;

use axum::{
    extract::{Path, State},
    Json,
};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;

use chronicle_domain::EventEnvelope;
use chronicle_sources_core::{GeneratorConfig, GeneratorHandle, GeneratorStatus};
use chronicle_sources_registry::all_sources;

use crate::{ApiResult, AppState};

/// Request to start a generator
#[derive(Debug, Deserialize)]
pub struct StartGeneratorRequest {
    /// Events per second rate (default: 1.0)
    #[serde(default = "default_rate")]
    pub events_per_second: f64,
    /// Maximum events to generate (None = unlimited)
    pub max_events: Option<u64>,
    /// Event types to generate (empty = all)
    #[serde(default)]
    pub event_types: Vec<String>,
    /// Tenant ID for generated events
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

fn default_rate() -> f64 {
    1.0
}

fn default_tenant() -> String {
    "default".to_string()
}

/// Response for generator operations
#[derive(Debug, Serialize)]
pub struct GeneratorResponse {
    pub source_id: String,
    pub status: String,
    pub message: String,
}

/// Generator state management
#[derive(Default)]
pub struct GeneratorManager {
    /// Active generator handles keyed by source_id
    handles: RwLock<HashMap<String, GeneratorHandle>>,
    /// Generator statuses
    statuses: RwLock<HashMap<String, GeneratorStatus>>,
}

impl GeneratorManager {
    pub fn new() -> Self {
        Self::default()
    }

    /// Check if a generator is running
    pub fn is_running(&self, source_id: &str) -> bool {
        self.handles.read().contains_key(source_id)
    }

    /// Get status of a generator
    pub fn get_status(&self, source_id: &str) -> Option<GeneratorStatus> {
        self.statuses.read().get(source_id).cloned()
    }

    /// Register a running generator
    pub fn register(&self, source_id: String, handle: GeneratorHandle, config: GeneratorConfig) {
        let status = GeneratorStatus {
            running: true,
            events_generated: 0,
            started_at: Some(chrono::Utc::now()),
            last_event_at: None,
            config,
            error: None,
        };

        self.handles.write().insert(source_id.clone(), handle);
        self.statuses.write().insert(source_id, status);
    }

    /// Stop a generator
    pub async fn stop(&self, source_id: &str) -> Result<(), String> {
        let handle = self.handles.write().remove(source_id);
        if let Some(handle) = handle {
            handle.stop().await.map_err(|e| e.to_string())?;
            if let Some(status) = self.statuses.write().get_mut(source_id) {
                status.running = false;
            }
        }
        Ok(())
    }

    /// Get all running generators
    pub fn running_generators(&self) -> Vec<String> {
        self.handles.read().keys().cloned().collect()
    }
}

/// List all available generators
pub async fn list_generators(State(_state): State<AppState>) -> ApiResult<Json<Vec<GeneratorInfo>>> {
    let generators: Vec<GeneratorInfo> = all_sources()
        .filter(|source| source.manifest().capabilities.generator)
        .map(|source| {
            let manifest = source.manifest();
            GeneratorInfo {
                source_id: manifest.id.to_string(),
                name: manifest.name.clone(),
                description: manifest.description.clone(),
                event_types: source
                    .as_event_generator()
                    .map(|g| g.available_event_types())
                    .unwrap_or_default(),
            }
        })
        .collect();

    Ok(Json(generators))
}

#[derive(Debug, Serialize)]
pub struct GeneratorInfo {
    pub source_id: String,
    pub name: String,
    pub description: String,
    pub event_types: Vec<String>,
}

/// Get status of a specific generator
pub async fn get_generator_status(
    State(state): State<AppState>,
    Path(source_id): Path<String>,
) -> ApiResult<Json<GeneratorStatusResponse>> {
    let manager = state.generator_manager();
    let running = manager.is_running(&source_id);
    let status = manager.get_status(&source_id);

    Ok(Json(GeneratorStatusResponse {
        source_id,
        running,
        status,
    }))
}

#[derive(Debug, Serialize)]
pub struct GeneratorStatusResponse {
    pub source_id: String,
    pub running: bool,
    pub status: Option<GeneratorStatus>,
}

/// Start a generator
pub async fn start_generator(
    State(state): State<AppState>,
    Path(source_id): Path<String>,
    Json(request): Json<StartGeneratorRequest>,
) -> ApiResult<Json<GeneratorResponse>> {
    let manager = state.generator_manager();

    // Check if already running
    if manager.is_running(&source_id) {
        return Ok(Json(GeneratorResponse {
            source_id: source_id.clone(),
            status: "already_running".to_string(),
            message: "Generator is already running".to_string(),
        }));
    }

    // Find the source adapter
    let adapter = all_sources()
        .find(|s| s.manifest().id.as_str() == source_id)
        .ok_or_else(|| crate::ApiError::NotFound(format!("Source not found: {}", source_id)))?;

    // Check if it supports generation
    let generator = adapter.as_event_generator().ok_or_else(|| {
        crate::ApiError::BadRequest(format!(
            "Source {} does not support event generation",
            source_id
        ))
    })?;

    // Build config
    let config = GeneratorConfig {
        enabled: true,
        events_per_second: request.events_per_second,
        max_events: request.max_events,
        event_types: request.event_types,
        tenant_id: request.tenant_id,
        custom: serde_json::json!({}),
    };

    // Validate config
    generator
        .validate_config(&config)
        .map_err(|e| crate::ApiError::BadRequest(format!("Invalid configuration: {}", e)))?;

    // Create channel for events
    let (tx, mut rx) = mpsc::unbounded_channel::<EventEnvelope>();

    // Start generator - we need to clone the generator for the spawned task
    // Since generator is a trait object, we'll spawn an event forwarding task
    let event_stream = Arc::clone(&state.event_stream);

    // Spawn a task to forward events from the generator to the event stream
    let source_id_clone = source_id.clone();
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            tracing::debug!(
                source = %source_id_clone,
                event_type = %event.event_type,
                "Generator produced event"
            );
            // Add to event store and broadcast
            if let Err(e) = event_stream.publish(event).await {
                tracing::error!(source = %source_id_clone, error = %e, "Failed to publish event");
            }
        }
        tracing::info!(source = %source_id_clone, "Generator event forwarding stopped");
    });

    // Start the generator (this is a simplified implementation - in production
    // you'd want the generator trait to be Clone-able or use Arc)
    // For now, we'll start a simple generation loop
    let config_clone = config.clone();
    let source_id_for_task = source_id.clone();
    
    // Create a stop channel
    let (stop_tx, mut stop_rx) = mpsc::channel::<()>(1);
    let handle = GeneratorHandle::new(stop_tx);

    // Register the generator as running
    manager.register(source_id.clone(), handle, config.clone());

    // Spawn the generation task
    tokio::spawn(async move {
        use chronicle_source_mock_stripe::MockStripeGenerator;
        use chronicle_sources_core::EventGenerator;

        let generator = MockStripeGenerator::new();
        let interval = config_clone.interval();
        let mut interval_timer = tokio::time::interval(interval);
        let mut events_generated: u64 = 0;

        loop {
            tokio::select! {
                _ = stop_rx.recv() => {
                    tracing::info!(
                        source = %source_id_for_task,
                        events = events_generated,
                        "Generator stopped"
                    );
                    break;
                }
                _ = interval_timer.tick() => {
                    // Check max events
                    if let Some(max) = config_clone.max_events {
                        if events_generated >= max {
                            tracing::info!(
                                source = %source_id_for_task,
                                max = max,
                                "Generator reached max events"
                            );
                            break;
                        }
                    }

                    // Generate event
                    match generator.generate_event(&config_clone).await {
                        Ok(event) => {
                            if tx.send(event).is_err() {
                                tracing::warn!(
                                    source = %source_id_for_task,
                                    "Event receiver dropped, stopping generator"
                                );
                                break;
                            }
                            events_generated += 1;
                        }
                        Err(e) => {
                            tracing::error!(
                                source = %source_id_for_task,
                                error = %e,
                                "Generator error"
                            );
                        }
                    }
                }
            }
        }
    });

    Ok(Json(GeneratorResponse {
        source_id,
        status: "started".to_string(),
        message: format!(
            "Generator started at {} events/sec",
            config.events_per_second
        ),
    }))
}

/// Stop a generator
pub async fn stop_generator(
    State(state): State<AppState>,
    Path(source_id): Path<String>,
) -> ApiResult<Json<GeneratorResponse>> {
    let manager = state.generator_manager();

    if !manager.is_running(&source_id) {
        return Ok(Json(GeneratorResponse {
            source_id: source_id.clone(),
            status: "not_running".to_string(),
            message: "Generator is not running".to_string(),
        }));
    }

    manager
        .stop(&source_id)
        .await
        .map_err(|e| crate::ApiError::Internal(format!("Failed to stop generator: {}", e)))?;

    Ok(Json(GeneratorResponse {
        source_id,
        status: "stopped".to_string(),
        message: "Generator stopped".to_string(),
    }))
}

/// List all running generators
pub async fn list_running_generators(
    State(state): State<AppState>,
) -> ApiResult<Json<Vec<GeneratorStatusResponse>>> {
    let manager = state.generator_manager();
    let running = manager.running_generators();

    let statuses: Vec<GeneratorStatusResponse> = running
        .into_iter()
        .map(|source_id| {
            let status = manager.get_status(&source_id);
            GeneratorStatusResponse {
                source_id,
                running: true,
                status,
            }
        })
        .collect();

    Ok(Json(statuses))
}

