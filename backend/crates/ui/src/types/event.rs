//! Event Types
//!
//! Event DTO and filtering types.

use chronicle_timeline_core::TimelineEventData;
use chrono::{DateTime, Utc};
use egui::Color32;
use serde::{Deserialize, Serialize};

/// Event envelope as received from API
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EventDto {
    pub event_id: String,
    pub tenant_id: String,
    pub source: String,
    pub source_event_id: String,
    pub event_type: String,
    pub conversation_id: String,
    pub actor_type: String,
    pub actor_id: String,
    pub actor_name: Option<String>,
    pub occurred_at: DateTime<Utc>,
    pub ingested_at: DateTime<Utc>,
    pub payload: serde_json::Value,
    pub contains_pii: bool,
    /// Stream this event came from (set client-side for multi-stream support)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stream_id: Option<String>,
}

impl EventDto {
    /// Get a formatted display name for the actor
    pub fn actor_display(&self) -> String {
        self.actor_name
            .clone()
            .unwrap_or_else(|| self.actor_id.clone())
    }

    /// Get the subject identifier (currently conversation_id, but could be extended)
    pub fn subject(&self) -> &str {
        &self.conversation_id
    }

    /// Get the message text from payload if available
    pub fn message_text(&self) -> Option<String> {
        self.payload
            .get("text")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    }

    /// Check if this is a customer message
    pub fn is_customer_message(&self) -> bool {
        self.actor_type == "customer" && self.event_type.contains("message")
    }

    /// Check if this is an agent message
    pub fn is_agent_message(&self) -> bool {
        self.actor_type == "agent" && self.event_type.contains("message")
    }

    /// Check if this is an internal note
    pub fn is_internal(&self) -> bool {
        self.event_type.contains("internal") || self.event_type.contains("note")
    }

    /// Get a short type label
    pub fn type_label(&self) -> &str {
        if self.event_type.contains("message.customer") {
            "Customer"
        } else if self.event_type.contains("message.agent") {
            "Agent"
        } else if self.event_type.contains("note") {
            "Note"
        } else if self.event_type.contains("status") {
            "Status"
        } else if self.event_type.contains("tag") {
            "Tag"
        } else if self.event_type.contains("escalation") {
            "Escalation"
        } else if self.event_type.contains("llm") {
            "AI"
        } else if self.event_type.contains("assignee") {
            "Assigned"
        } else {
            "Event"
        }
    }
}

/// Implement TimelineEventData for EventDto to use with timeline-core
impl TimelineEventData for EventDto {
    fn id(&self) -> &str {
        &self.event_id
    }

    fn source(&self) -> &str {
        &self.source
    }

    fn event_type(&self) -> &str {
        &self.event_type
    }

    fn occurred_at(&self) -> DateTime<Utc> {
        self.occurred_at
    }

    fn actor(&self) -> Option<&str> {
        self.actor_name.as_deref().or(Some(&self.actor_id))
    }

    fn message(&self) -> Option<&str> {
        self.payload.get("text").and_then(|v| v.as_str())
    }

    fn color(&self) -> Option<Color32> {
        None // Use default source colors
    }

    fn stream(&self) -> Option<&str> {
        self.stream_id.as_deref()
    }
}

/// Filter settings for events
#[derive(Clone, Debug, Default)]
pub struct EventFilter {
    pub show_customer: bool,
    pub show_agent: bool,
    pub show_internal: bool,
    pub show_system: bool,
    pub conversation_id: Option<String>,
}

impl EventFilter {
    pub fn all() -> Self {
        Self {
            show_customer: true,
            show_agent: true,
            show_internal: true,
            show_system: true,
            conversation_id: None,
        }
    }

    pub fn matches(&self, event: &EventDto) -> bool {
        // Conversation filter
        if let Some(ref conv) = self.conversation_id {
            if &event.conversation_id != conv {
                return false;
            }
        }

        // Type filters
        match event.actor_type.as_str() {
            "customer" => self.show_customer,
            "agent" => {
                if event.is_internal() {
                    self.show_internal
                } else {
                    self.show_agent
                }
            }
            "system" | "bot" => self.show_system,
            _ => true,
        }
    }
}
