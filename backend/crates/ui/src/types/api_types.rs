//! API Response Types
//!
//! DTOs for API responses (connections, scenarios, replay, health, etc.)

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::event::EventDto;

/// Connection response from API
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ConnectionDto {
    pub connection_id: String,
    pub tenant_id: String,
    pub service: String,
    pub name: String,
    pub status: String,
    pub connected_at: DateTime<Utc>,
}

/// Scenario info from API
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ScenarioDto {
    pub name: String,
    pub description: String,
    pub event_count: usize,
}

/// Replay session info
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ReplaySessionDto {
    pub session_id: String,
    pub conversation_id: String,
    pub mode: String,
    pub event_count: usize,
    pub stream_url: String,
}

/// Replay status
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ReplayStatusDto {
    pub session_id: String,
    pub state: String,
    pub progress: f32,
    pub current_index: Option<usize>,
    pub total_events: Option<usize>,
}

/// Health check response
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HealthDto {
    pub status: String,
    pub version: String,
}

/// Timeline response (legacy - conversation-based)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TimelineDto {
    pub conversation_id: String,
    pub events: Vec<EventDto>,
    pub count: usize,
}

/// Events query response (new - tenant-based)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EventsQueryResponse {
    pub events: Vec<EventDto>,
    pub count: usize,
    /// Available sources in the result set
    #[serde(default)]
    pub sources: Vec<String>,
    /// Available event types in the result set
    #[serde(default)]
    pub event_types: Vec<String>,
}

/// Generate events response
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GenerateResponse {
    pub generated: usize,
    pub message: String,
}
