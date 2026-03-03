//! Event Type Definitions
//!
//! Self-documenting event type registry for sources.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::adapter::SourceId;
use crate::error::CatalogError;

/// Definition of an event type
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EventTypeDefinition {
    /// Event type identifier (e.g., "support.conversation.created")
    pub event_type: String,
    /// Human-readable description
    pub description: String,
    /// Source-specific topic that maps to this (e.g., "conversation.user.created")
    pub source_topic: String,
    /// Category for grouping (e.g., "conversation", "ticket", "user")
    #[serde(default)]
    pub category: String,
    /// Fields that contain PII
    #[serde(default)]
    pub pii_fields: Vec<String>,
    /// JSON Schema for the payload
    #[serde(default)]
    pub payload_schema: Option<serde_json::Value>,
    /// Example payload
    #[serde(default)]
    pub example: Option<serde_json::Value>,
    /// Tags for filtering/search
    #[serde(default)]
    pub tags: Vec<String>,
    /// Whether this event type is deprecated
    #[serde(default)]
    pub deprecated: bool,
    /// Deprecation message if deprecated
    #[serde(default)]
    pub deprecation_message: Option<String>,
}

impl EventTypeDefinition {
    /// Create a new event type definition
    pub fn new(
        event_type: impl Into<String>,
        source_topic: impl Into<String>,
        description: impl Into<String>,
    ) -> Self {
        Self {
            event_type: event_type.into(),
            source_topic: source_topic.into(),
            description: description.into(),
            category: String::new(),
            pii_fields: Vec::new(),
            payload_schema: None,
            example: None,
            tags: Vec::new(),
            deprecated: false,
            deprecation_message: None,
        }
    }

    pub fn with_category(mut self, category: impl Into<String>) -> Self {
        self.category = category.into();
        self
    }

    pub fn with_pii_fields(mut self, fields: Vec<String>) -> Self {
        self.pii_fields = fields;
        self
    }

    pub fn with_payload_schema(mut self, schema: serde_json::Value) -> Self {
        self.payload_schema = Some(schema);
        self
    }

    pub fn with_example(mut self, example: serde_json::Value) -> Self {
        self.example = Some(example);
        self
    }

    pub fn with_tags(mut self, tags: Vec<String>) -> Self {
        self.tags = tags;
        self
    }

    pub fn deprecate(mut self, message: impl Into<String>) -> Self {
        self.deprecated = true;
        self.deprecation_message = Some(message.into());
        self
    }
}

/// Catalog configuration from TOML
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EventCatalogConfig {
    /// Source identifier
    pub source_id: String,
    /// Event definitions
    #[serde(default)]
    pub events: Vec<EventTypeDefinition>,
}

/// Catalog of all event types for a source
#[derive(Clone, Debug)]
pub struct EventCatalog {
    /// Source identifier
    source_id: SourceId,
    /// Event definitions by event type
    by_event_type: HashMap<String, EventTypeDefinition>,
    /// Event definitions by source topic
    by_topic: HashMap<String, EventTypeDefinition>,
    /// All event definitions
    events: Vec<EventTypeDefinition>,
}

impl EventCatalog {
    /// Create a new empty catalog
    pub fn new(source_id: impl Into<SourceId>) -> Self {
        Self {
            source_id: source_id.into(),
            by_event_type: HashMap::new(),
            by_topic: HashMap::new(),
            events: Vec::new(),
        }
    }

    /// Load from TOML string
    pub fn from_toml(toml_str: &str) -> Result<Self, CatalogError> {
        let config: EventCatalogConfig = toml::from_str(toml_str)?;

        let mut catalog = Self::new(config.source_id);
        for event in config.events {
            catalog.register(event)?;
        }

        Ok(catalog)
    }

    /// Register an event type
    pub fn register(&mut self, definition: EventTypeDefinition) -> Result<(), CatalogError> {
        if self.by_event_type.contains_key(&definition.event_type) {
            return Err(CatalogError::Duplicate(definition.event_type.clone()));
        }

        self.by_event_type
            .insert(definition.event_type.clone(), definition.clone());
        self.by_topic
            .insert(definition.source_topic.clone(), definition.clone());
        self.events.push(definition);

        Ok(())
    }

    /// Get source identifier
    pub fn source_id(&self) -> &SourceId {
        &self.source_id
    }

    /// Get event definition by event type
    pub fn get_by_type(&self, event_type: &str) -> Option<&EventTypeDefinition> {
        self.by_event_type.get(event_type)
    }

    /// Get event definition by source topic
    pub fn get_by_topic(&self, topic: &str) -> Option<&EventTypeDefinition> {
        self.by_topic.get(topic)
    }

    /// Get all event definitions
    pub fn all(&self) -> &[EventTypeDefinition] {
        &self.events
    }

    /// Get event types by category
    pub fn by_category(&self, category: &str) -> Vec<&EventTypeDefinition> {
        self.events
            .iter()
            .filter(|e| e.category == category)
            .collect()
    }

    /// Get event types with a specific tag
    pub fn by_tag(&self, tag: &str) -> Vec<&EventTypeDefinition> {
        self.events
            .iter()
            .filter(|e| e.tags.contains(&tag.to_string()))
            .collect()
    }

    /// Get all categories
    pub fn categories(&self) -> Vec<&str> {
        let mut categories: Vec<&str> = self
            .events
            .iter()
            .map(|e| e.category.as_str())
            .filter(|c| !c.is_empty())
            .collect();
        categories.sort();
        categories.dedup();
        categories
    }

    /// Get all tags
    pub fn tags(&self) -> Vec<&str> {
        let mut tags: Vec<&str> = self
            .events
            .iter()
            .flat_map(|e| e.tags.iter().map(|t| t.as_str()))
            .collect();
        tags.sort();
        tags.dedup();
        tags
    }

    /// Get all non-deprecated events
    pub fn active(&self) -> Vec<&EventTypeDefinition> {
        self.events.iter().filter(|e| !e.deprecated).collect()
    }

    /// Get all deprecated events
    pub fn deprecated(&self) -> Vec<&EventTypeDefinition> {
        self.events.iter().filter(|e| e.deprecated).collect()
    }

    /// Check if a topic is supported
    pub fn supports_topic(&self, topic: &str) -> bool {
        self.by_topic.contains_key(topic)
    }

    /// Get event count
    pub fn len(&self) -> usize {
        self.events.len()
    }

    /// Check if catalog is empty
    pub fn is_empty(&self) -> bool {
        self.events.is_empty()
    }

    /// Convert to serializable format
    pub fn to_config(&self) -> EventCatalogConfig {
        EventCatalogConfig {
            source_id: self.source_id.to_string(),
            events: self.events.clone(),
        }
    }
}

impl Default for EventCatalog {
    fn default() -> Self {
        Self::new("unknown")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_catalog_from_toml() {
        let toml = r#"
source_id = "intercom"

[[events]]
event_type = "support.conversation.created"
source_topic = "conversation.user.created"
description = "A new conversation was started"
category = "conversation"
pii_fields = ["email", "name"]
tags = ["support", "customer"]

[[events]]
event_type = "support.message.customer"
source_topic = "conversation.user.replied"
description = "Customer sent a message"
category = "conversation"
"#;

        let catalog = EventCatalog::from_toml(toml).unwrap();

        assert_eq!(catalog.source_id().as_str(), "intercom");
        assert_eq!(catalog.len(), 2);

        let event = catalog.get_by_type("support.conversation.created").unwrap();
        assert_eq!(event.description, "A new conversation was started");
        assert_eq!(event.pii_fields, vec!["email", "name"]);

        let by_topic = catalog.get_by_topic("conversation.user.replied").unwrap();
        assert_eq!(by_topic.event_type, "support.message.customer");

        let categories = catalog.categories();
        assert_eq!(categories, vec!["conversation"]);
    }

    #[test]
    fn test_catalog_registration() {
        let mut catalog = EventCatalog::new("test");

        catalog
            .register(
                EventTypeDefinition::new("test.event", "test.topic", "Test event")
                    .with_category("test")
                    .with_tags(vec!["tag1".to_string(), "tag2".to_string()]),
            )
            .unwrap();

        assert_eq!(catalog.len(), 1);
        assert!(catalog.supports_topic("test.topic"));
        assert!(catalog.get_by_type("test.event").is_some());
    }

    #[test]
    fn test_duplicate_detection() {
        let mut catalog = EventCatalog::new("test");

        catalog
            .register(EventTypeDefinition::new(
                "test.event",
                "test.topic",
                "First",
            ))
            .unwrap();

        let result = catalog.register(EventTypeDefinition::new(
            "test.event",
            "test.topic2",
            "Second",
        ));

        assert!(result.is_err());
    }
}
