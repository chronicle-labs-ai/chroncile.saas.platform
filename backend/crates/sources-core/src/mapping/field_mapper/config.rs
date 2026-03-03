//! Field Mapper Configuration Types
//!
//! Declarative configuration types for mapping source payloads to EventEnvelope fields.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

/// Target field in EventEnvelope
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MappingTarget {
    /// source_event_id field
    SourceEventId,
    /// event_type field
    EventType,
    /// occurred_at timestamp
    OccurredAt,
    /// Subject conversation_id
    #[serde(rename = "subject.conversation_id")]
    SubjectConversationId,
    /// Subject customer_id
    #[serde(rename = "subject.customer_id")]
    SubjectCustomerId,
    /// Subject ticket_id
    #[serde(rename = "subject.ticket_id")]
    SubjectTicketId,
    /// Actor type
    #[serde(rename = "actor.type")]
    ActorType,
    /// Actor id
    #[serde(rename = "actor.id")]
    ActorId,
    /// Actor name
    #[serde(rename = "actor.name")]
    ActorName,
    /// Custom field (stored in payload or metadata)
    Custom(String),
}

impl MappingTarget {
    pub fn from_str(s: &str) -> Self {
        match s {
            "source_event_id" => Self::SourceEventId,
            "event_type" => Self::EventType,
            "occurred_at" => Self::OccurredAt,
            "subject.conversation_id" => Self::SubjectConversationId,
            "subject.customer_id" => Self::SubjectCustomerId,
            "subject.ticket_id" => Self::SubjectTicketId,
            "actor.type" => Self::ActorType,
            "actor.id" => Self::ActorId,
            "actor.name" => Self::ActorName,
            other => Self::Custom(other.to_string()),
        }
    }
}

/// Transformation to apply to extracted values
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Transform {
    /// Prefix with string (e.g., "intercom_conv_")
    Prefix { prefix: String },
    /// Suffix with string
    Suffix { suffix: String },
    /// Format timestamp from various formats
    Timestamp { format: TimestampFormat },
    /// Map values (e.g., topic -> event_type)
    Map {
        mappings: HashMap<String, String>,
        #[serde(default)]
        default: Option<String>,
    },
    /// Template string with {{field}} placeholders
    Template { template: String },
    /// Extract nested field
    Extract { path: String },
    /// Chain multiple transforms
    Chain { transforms: Vec<Transform> },
    /// Convert to lowercase
    Lowercase,
    /// Convert to uppercase
    Uppercase,
    /// Replace substring
    Replace { from: String, to: String },
}

/// Timestamp format for parsing
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TimestampFormat {
    /// Unix timestamp in seconds
    UnixSeconds,
    /// Unix timestamp in milliseconds
    UnixMillis,
    /// ISO 8601 / RFC 3339
    Iso8601,
    /// Custom strftime format
    Custom(String),
}

/// Single field mapping rule
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FieldMapping {
    /// JSONPath expression to extract value
    pub source_path: String,
    /// Target field in EventEnvelope
    pub target: MappingTarget,
    /// Optional transformation
    #[serde(default)]
    pub transform: Option<Transform>,
    /// Default value if extraction fails
    #[serde(default)]
    pub default: Option<serde_json::Value>,
    /// Whether this mapping is required
    #[serde(default)]
    pub required: bool,
}

/// Topic-specific mapping configuration
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct TopicMapping {
    /// Event type to use for this topic
    pub event_type: String,
    /// PII fields for this event type
    #[serde(default)]
    pub pii_fields: Vec<String>,
    /// Field mappings specific to this topic
    #[serde(default)]
    pub mappings: Vec<FieldMapping>,
}

/// Complete field mapper configuration
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct FieldMapperConfig {
    /// Source identifier
    pub source: String,
    /// Default mappings applied to all events
    #[serde(default)]
    pub defaults: FieldMapperDefaults,
    /// Topic-specific mappings
    #[serde(default)]
    pub topics: HashMap<String, TopicMapping>,
}

/// Default mappings
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct FieldMapperDefaults {
    /// Default event type if not specified per topic
    #[serde(default)]
    pub event_type: Option<String>,
    /// Default mappings applied to all events
    #[serde(default)]
    pub mappings: Vec<FieldMapping>,
}
