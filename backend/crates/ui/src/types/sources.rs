//! Sources API Types
//!
//! DTOs for source metadata and capabilities.

use serde::{Deserialize, Serialize};

/// Source capabilities from API
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct SourceCapabilities {
    /// Supports receiving webhooks
    #[serde(default)]
    pub webhook: bool,
    /// Supports polling for events
    #[serde(default)]
    pub polling: bool,
    /// Supports OAuth authentication
    #[serde(default)]
    pub oauth: bool,
    /// Supports bidirectional operations
    #[serde(default)]
    pub bidirectional: bool,
}

/// Source summary from /api/sources
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SourceSummary {
    /// Source identifier (e.g., "intercom", "zendesk")
    pub id: String,
    /// Human-readable name (e.g., "Intercom")
    pub name: String,
    /// Description of the source
    #[serde(default)]
    pub description: String,
    /// Adapter version
    pub version: String,
    /// Capabilities this source supports
    #[serde(default)]
    pub capabilities: SourceCapabilities,
}

impl SourceSummary {
    /// Check if this source supports webhooks
    pub fn supports_webhook(&self) -> bool {
        self.capabilities.webhook
    }

    /// Check if this source supports OAuth
    pub fn supports_oauth(&self) -> bool {
        self.capabilities.oauth
    }
}

/// Response from /api/sources
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ListSourcesResponse {
    pub sources: Vec<SourceSummary>,
    pub count: usize,
}

/// Event type metadata from source catalog
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EventTypeMeta {
    /// Event type identifier (e.g., "support.conversation.created")
    pub event_type: String,
    /// Source-specific topic (e.g., "conversation.user.created")
    pub source_topic: String,
    /// Human-readable description
    pub description: String,
    /// Category for grouping (e.g., "conversation", "ticket", "user")
    #[serde(default)]
    pub category: String,
    /// Fields that contain PII
    #[serde(default)]
    pub pii_fields: Vec<String>,
}

impl EventTypeMeta {
    /// Check if this event type contains PII
    pub fn has_pii(&self) -> bool {
        !self.pii_fields.is_empty()
    }
}

/// Response from /api/sources/:id/catalog
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SourceCatalogResponse {
    pub source_id: String,
    pub events: Vec<EventTypeMeta>,
}
