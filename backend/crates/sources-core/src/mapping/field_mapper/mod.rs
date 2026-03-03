//! Field Mapper
//!
//! Declarative mapping from source payloads to EventEnvelope fields.

mod builder;
mod config;
mod helpers;
mod transforms;

use chronicle_domain::{EventEnvelope, PiiFlags};

use crate::context::IngestContext;
use crate::error::MappingError;

pub use config::*;
pub use helpers::{value_to_string, value_to_timestamp};

use builder::EventEnvelopeBuilder;
use transforms::apply_transform;

/// Field mapper for transforming source payloads to EventEnvelopes
#[derive(Clone, Debug)]
pub struct FieldMapper {
    config: FieldMapperConfig,
}

impl Default for FieldMapper {
    fn default() -> Self {
        Self::new()
    }
}

impl FieldMapper {
    /// Create an empty field mapper
    pub fn new() -> Self {
        Self {
            config: FieldMapperConfig::default(),
        }
    }

    /// Create an identity mapper that passes through events unchanged
    ///
    /// This is useful for mock/generator sources where events are already
    /// in the correct format and don't need transformation.
    pub fn identity() -> Self {
        Self {
            config: FieldMapperConfig {
                source: "identity".to_string(),
                defaults: FieldMapperDefaults::default(),
                topics: Default::default(),
            },
        }
    }

    /// Load mappings from TOML string
    pub fn from_toml(toml_str: &str) -> Result<Self, MappingError> {
        let config: FieldMapperConfig = toml::from_str(toml_str)?;
        Ok(Self { config })
    }

    /// Get the source identifier
    pub fn source(&self) -> &str {
        &self.config.source
    }

    /// Get topic mapping
    pub fn get_topic(&self, topic: &str) -> Option<&TopicMapping> {
        self.config.topics.get(topic)
    }

    /// Get all supported topics
    pub fn supported_topics(&self) -> Vec<&str> {
        self.config.topics.keys().map(|s| s.as_str()).collect()
    }

    /// Apply mappings to transform source payload to EventEnvelope
    pub fn apply(
        &self,
        topic: &str,
        payload: &serde_json::Value,
        context: &IngestContext,
    ) -> Result<EventEnvelope, MappingError> {
        // Get topic-specific mapping
        let topic_mapping = self.config.topics.get(topic);

        // Determine event type
        let event_type = topic_mapping
            .map(|t| t.event_type.clone())
            .or_else(|| self.config.defaults.event_type.clone())
            .unwrap_or_else(|| format!("{}.{}", self.config.source, topic.replace('.', "_")));

        // Build envelope with extracted fields
        let mut builder = EventEnvelopeBuilder::new(
            context.tenant_id.clone(),
            self.config.source.clone(),
            event_type,
        );

        // Apply default mappings
        for mapping in &self.config.defaults.mappings {
            builder = self.apply_mapping(builder, mapping, payload)?;
        }

        // Apply topic-specific mappings
        if let Some(topic_map) = topic_mapping {
            for mapping in &topic_map.mappings {
                builder = self.apply_mapping(builder, mapping, payload)?;
            }

            // Set PII fields
            if !topic_map.pii_fields.is_empty() {
                builder = builder.with_pii(PiiFlags::with_fields(topic_map.pii_fields.clone()));
            }
        }

        // Set raw payload
        let raw_payload = EventEnvelope::make_payload(payload)
            .map_err(|e| MappingError::InvalidConfig(e.to_string()))?;
        builder = builder.with_payload(raw_payload);

        Ok(builder.build())
    }

    /// Apply a single field mapping
    fn apply_mapping(
        &self,
        mut builder: EventEnvelopeBuilder,
        mapping: &FieldMapping,
        payload: &serde_json::Value,
    ) -> Result<EventEnvelopeBuilder, MappingError> {
        // Extract value using JSONPath
        let extracted = self.extract_value(&mapping.source_path, payload);

        let value = match extracted {
            Some(v) => {
                // Apply transform if specified
                if let Some(ref transform) = mapping.transform {
                    let extract_fn =
                        |path: &str, val: &serde_json::Value| self.extract_value(path, val);
                    apply_transform(v, transform, &extract_fn)?
                } else {
                    v
                }
            }
            None => {
                if mapping.required {
                    return Err(MappingError::MissingTarget(format!(
                        "Required field not found: {}",
                        mapping.source_path
                    )));
                }
                match &mapping.default {
                    Some(default) => default.clone(),
                    None => return Ok(builder),
                }
            }
        };

        // Apply to builder based on target
        builder = match &mapping.target {
            MappingTarget::SourceEventId => builder.with_source_event_id(value_to_string(&value)),
            MappingTarget::EventType => builder.with_event_type(value_to_string(&value)),
            MappingTarget::OccurredAt => {
                if let Some(ts) = value_to_timestamp(&value) {
                    builder.with_occurred_at(ts)
                } else {
                    builder
                }
            }
            MappingTarget::SubjectConversationId => {
                builder.with_subject_conversation(value_to_string(&value))
            }
            MappingTarget::SubjectCustomerId => {
                builder.with_subject_customer(value_to_string(&value))
            }
            MappingTarget::SubjectTicketId => builder.with_subject_ticket(value_to_string(&value)),
            MappingTarget::ActorType => builder.with_actor_type(value_to_string(&value)),
            MappingTarget::ActorId => builder.with_actor_id(value_to_string(&value)),
            MappingTarget::ActorName => builder.with_actor_name(value_to_string(&value)),
            MappingTarget::Custom(_) => {
                // Custom fields are preserved in the payload
                builder
            }
        };

        Ok(builder)
    }

    /// Extract value from JSON using JSONPath
    fn extract_value(&self, path: &str, payload: &serde_json::Value) -> Option<serde_json::Value> {
        use jsonpath_rust::JsonPathQuery;

        // Handle simple paths without $ prefix
        let normalized_path = if path.starts_with('$') {
            path.to_string()
        } else {
            format!("$.{}", path)
        };

        payload
            .clone()
            .path(&normalized_path)
            .ok()
            .and_then(|results| {
                if results.is_array() {
                    let arr = results.as_array().unwrap();
                    if arr.len() == 1 {
                        Some(arr[0].clone())
                    } else if arr.is_empty() {
                        None
                    } else {
                        Some(results)
                    }
                } else {
                    Some(results)
                }
            })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_mapping() {
        let toml = r#"
source = "test"

[defaults]
event_type = "test.event"

[[defaults.mappings]]
source_path = "$.id"
target = "source_event_id"

[topics."test.created"]
event_type = "test.created"

[[topics."test.created".mappings]]
source_path = "$.conversation_id"
target = "subject.conversation_id"
transform = { type = "prefix", prefix = "test_conv_" }
"#;

        let mapper = FieldMapper::from_toml(toml).unwrap();
        let payload = serde_json::json!({
            "id": "evt_123",
            "conversation_id": "conv_456"
        });

        let context = IngestContext::new("tenant_1");
        let envelope = mapper.apply("test.created", &payload, &context).unwrap();

        assert_eq!(envelope.source, "test");
        assert_eq!(envelope.event_type, "test.created");
        assert_eq!(envelope.source_event_id, "evt_123");
        assert!(envelope
            .subject
            .conversation_id
            .as_str()
            .contains("test_conv_conv_456"));
    }

    #[test]
    fn test_value_mapping() {
        let toml = r#"
source = "test"

[topics."user.action"]
event_type = "user.action"

[[topics."user.action".mappings]]
source_path = "$.action_type"
target = "event_type"
transform = { type = "map", mappings = { "CREATE" = "user.created", "DELETE" = "user.deleted" }, default = "user.unknown" }
"#;

        let mapper = FieldMapper::from_toml(toml).unwrap();
        let payload = serde_json::json!({ "action_type": "CREATE" });

        let context = IngestContext::new("tenant_1");
        let envelope = mapper.apply("user.action", &payload, &context).unwrap();

        assert_eq!(envelope.event_type, "user.created");
    }
}
