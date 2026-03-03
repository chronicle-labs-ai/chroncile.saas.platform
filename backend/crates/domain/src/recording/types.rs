//! Recording Types
//!
//! Shared types for MCAP recording and playback.

use std::collections::HashMap;

use chrono::{DateTime, Utc};

use crate::{StreamId, TenantId};

/// Error type for recording operations
#[derive(Debug, thiserror::Error)]
pub enum RecordingError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("MCAP error: {0}")]
    Mcap(#[from] mcap::McapError),

    #[error("JSON serialization error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Recording not started")]
    NotStarted,

    #[error("Invalid bag file: {0}")]
    InvalidBag(String),

    #[error("Stream not found: {0}")]
    StreamNotFound(String),
}

/// JSON Schema for EventEnvelope (simplified for MCAP registration)
pub const EVENT_ENVELOPE_SCHEMA: &str = r#"{
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "EventEnvelope",
    "type": "object",
    "properties": {
        "event_id": { "type": "string" },
        "tenant_id": { "type": "string" },
        "source": { "type": "string" },
        "source_event_id": { "type": "string" },
        "event_type": { "type": "string" },
        "stream_id": { "type": "string" },
        "occurred_at": { "type": "string", "format": "date-time" },
        "ingested_at": { "type": "string", "format": "date-time" },
        "schema_version": { "type": "integer" },
        "payload": { "type": "object" }
    },
    "required": ["event_id", "tenant_id", "source", "event_type", "occurred_at"]
}"#;

/// Default channel topic prefix
pub const CHANNEL_PREFIX: &str = "/events";

/// Metadata about a recording
#[derive(Debug, Clone)]
pub struct RecordingMetadata {
    /// Total number of events in the recording
    pub event_count: usize,
    /// Time of the first event
    pub start_time: Option<DateTime<Utc>>,
    /// Time of the last event
    pub end_time: Option<DateTime<Utc>>,
    /// Duration of the recording
    pub duration: Option<chrono::Duration>,
    /// Tenant ID (if all events are from the same tenant)
    pub tenant_id: Option<TenantId>,
    /// Stream IDs present in the recording
    pub streams: Vec<StreamId>,
    /// Event count per stream
    pub stream_event_counts: HashMap<StreamId, usize>,
}

impl RecordingMetadata {
    /// Create empty metadata
    pub fn empty() -> Self {
        Self {
            event_count: 0,
            start_time: None,
            end_time: None,
            duration: None,
            tenant_id: None,
            streams: Vec::new(),
            stream_event_counts: HashMap::new(),
        }
    }
}

