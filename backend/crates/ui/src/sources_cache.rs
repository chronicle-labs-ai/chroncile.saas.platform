//! Sources Cache
//!
//! Centralized cache for source metadata fetched from the API.
//! Loaded once on startup and provides lookups for source info.

use std::collections::HashMap;

use crate::types::{EventTypeMeta, SourceSummary};

/// Centralized cache for source metadata
#[derive(Clone, Debug, Default)]
pub struct SourcesCache {
    /// Available sources
    sources: Vec<SourceSummary>,
    /// Event catalogs by source ID
    catalogs: HashMap<String, Vec<EventTypeMeta>>,
    /// Index of event types to their metadata (for fast lookup)
    event_type_index: HashMap<String, EventTypeMeta>,
    /// Whether the cache has been loaded
    loaded: bool,
}

impl SourcesCache {
    /// Create a new empty cache
    pub fn new() -> Self {
        Self::default()
    }

    /// Check if the cache has been loaded
    pub fn is_loaded(&self) -> bool {
        self.loaded
    }

    /// Set the sources list
    pub fn set_sources(&mut self, sources: Vec<SourceSummary>) {
        self.sources = sources;
        if !self.sources.is_empty() {
            self.loaded = true;
        }
    }

    /// Add a catalog for a source
    pub fn add_catalog(&mut self, source_id: &str, events: Vec<EventTypeMeta>) {
        // Index event types for fast lookup
        for event in &events {
            self.event_type_index
                .insert(event.event_type.clone(), event.clone());
        }
        self.catalogs.insert(source_id.to_string(), events);
    }

    /// Get all available sources
    pub fn sources(&self) -> &[SourceSummary] {
        &self.sources
    }

    /// Get a source by ID
    pub fn get_source(&self, source_id: &str) -> Option<&SourceSummary> {
        self.sources.iter().find(|s| s.id == source_id)
    }

    /// Get the display name for a source ID
    pub fn source_display_name(&self, source_id: &str) -> String {
        self.get_source(source_id)
            .map(|s| s.name.clone())
            .unwrap_or_else(|| capitalize_source_id(source_id))
    }

    /// Get event types for a source
    pub fn event_types(&self, source_id: &str) -> Option<&[EventTypeMeta]> {
        self.catalogs.get(source_id).map(|v| v.as_slice())
    }

    /// Get all event types across all sources
    pub fn all_event_types(&self) -> Vec<&EventTypeMeta> {
        self.catalogs.values().flatten().collect()
    }

    /// Get metadata for an event type
    pub fn get_event_type(&self, event_type: &str) -> Option<&EventTypeMeta> {
        self.event_type_index.get(event_type)
    }

    /// Get category for an event type (API-driven)
    pub fn get_category(&self, event_type: &str) -> Option<&str> {
        self.event_type_index
            .get(event_type)
            .map(|e| e.category.as_str())
            .filter(|c| !c.is_empty())
    }

    /// Get description for an event type
    pub fn get_description(&self, event_type: &str) -> Option<&str> {
        self.event_type_index
            .get(event_type)
            .map(|e| e.description.as_str())
            .filter(|d| !d.is_empty())
    }

    /// Get PII fields for an event type
    pub fn get_pii_fields(&self, event_type: &str) -> Option<&[String]> {
        self.event_type_index
            .get(event_type)
            .map(|e| e.pii_fields.as_slice())
            .filter(|f| !f.is_empty())
    }

    /// Check if an event type has PII
    pub fn has_pii(&self, event_type: &str) -> bool {
        self.event_type_index
            .get(event_type)
            .map(|e| !e.pii_fields.is_empty())
            .unwrap_or(false)
    }

    /// Get unique categories across all event types
    pub fn categories(&self) -> Vec<&str> {
        let mut categories: Vec<&str> = self
            .event_type_index
            .values()
            .map(|e| e.category.as_str())
            .filter(|c| !c.is_empty())
            .collect();
        categories.sort();
        categories.dedup();
        categories
    }

    /// Get source IDs that have been loaded
    pub fn loaded_source_ids(&self) -> Vec<&str> {
        self.sources.iter().map(|s| s.id.as_str()).collect()
    }

    /// Clear the cache
    pub fn clear(&mut self) {
        self.sources.clear();
        self.catalogs.clear();
        self.event_type_index.clear();
        self.loaded = false;
    }
}

/// Helper to capitalize a source ID for display
/// e.g., "intercom" -> "Intercom", "mock-zendesk" -> "Mock Zendesk"
fn capitalize_source_id(source_id: &str) -> String {
    source_id
        .split('-')
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().chain(chars).collect(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::SourceCapabilities;

    #[test]
    fn test_empty_cache() {
        let cache = SourcesCache::new();
        assert!(!cache.is_loaded());
        assert!(cache.sources().is_empty());
    }

    #[test]
    fn test_set_sources() {
        let mut cache = SourcesCache::new();
        cache.set_sources(vec![SourceSummary {
            id: "intercom".to_string(),
            name: "Intercom".to_string(),
            description: "Customer messaging".to_string(),
            version: "1.0.0".to_string(),
            capabilities: SourceCapabilities::default(),
        }]);

        assert!(cache.is_loaded());
        assert_eq!(cache.sources().len(), 1);
        assert_eq!(cache.source_display_name("intercom"), "Intercom");
    }

    #[test]
    fn test_add_catalog() {
        let mut cache = SourcesCache::new();
        cache.add_catalog(
            "intercom",
            vec![EventTypeMeta {
                event_type: "support.conversation.created".to_string(),
                source_topic: "conversation.user.created".to_string(),
                description: "New conversation started".to_string(),
                category: "conversation".to_string(),
                pii_fields: vec!["email".to_string()],
            }],
        );

        assert!(cache.has_pii("support.conversation.created"));
        assert_eq!(
            cache.get_category("support.conversation.created"),
            Some("conversation")
        );
    }

    #[test]
    fn test_capitalize_source_id() {
        assert_eq!(capitalize_source_id("intercom"), "Intercom");
        assert_eq!(capitalize_source_id("mock-zendesk"), "Mock Zendesk");
        assert_eq!(capitalize_source_id("my-cool-source"), "My Cool Source");
    }
}
