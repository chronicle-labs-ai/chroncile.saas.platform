//! Mock Stripe Source Adapter
//!
//! Implements the SourceAdapter trait for the mock Stripe source.

use async_trait::async_trait;
use chronicle_sources_core::{
    ConfigError, EventGenerator, EventTypeDefinition, FieldMapper, SchemaVersion,
    SchemaVersionRegistry, SourceAdapter, SourceCapabilities, SourceId, SourceManifest,
};

use crate::generator::MockStripeGenerator;
use crate::templates::StripeEventType;

/// Mock Stripe source adapter
///
/// This adapter provides:
/// - Event generation via the EventGenerator trait
/// - Self-documenting event catalog
/// - Configuration validation
pub struct MockStripeAdapter {
    manifest: SourceManifest,
    field_mapper: FieldMapper,
    schema_registry: SchemaVersionRegistry,
    generator: MockStripeGenerator,
}

impl MockStripeAdapter {
    /// Create a new mock Stripe adapter
    pub fn new() -> Self {
        let manifest = SourceManifest::new(
            SourceId::new("mock-stripe"),
            "Mock Stripe",
            semver::Version::new(1, 0, 0),
        )
        .with_description(
            "Mock Stripe source for testing and demos. Generates synthetic webhook events \
             including payments, customers, subscriptions, and charges.",
        )
        .with_capabilities(SourceCapabilities {
            webhook: false,
            polling: false,
            oauth: false,
            bidirectional: false,
            generator: true,
        })
        .with_event_catalog(Self::build_event_catalog())
        .with_config_schema(serde_json::json!({
            "type": "object",
            "properties": {
                "events_per_second": {
                    "type": "number",
                    "description": "Events to generate per second",
                    "default": 1.0,
                    "minimum": 0.1,
                    "maximum": 100.0
                },
                "max_events": {
                    "type": "integer",
                    "description": "Maximum events to generate (null for unlimited)",
                    "default": null
                },
                "event_types": {
                    "type": "array",
                    "items": { "type": "string" },
                    "description": "Event types to generate (empty for all)"
                },
                "success_bias": {
                    "type": "number",
                    "description": "Probability of success events (0.0-1.0)",
                    "default": 0.8
                }
            }
        }))
        .with_icon("stripe");

        // Create a minimal field mapper (events are already in our format)
        let field_mapper = FieldMapper::identity();

        // Create schema registry
        let mut schema_registry = SchemaVersionRegistry::with_current_version(1);
        schema_registry.register_version(
            SchemaVersion::new(1, "$.api_version").with_description("Mock Stripe v1 schema"),
        );

        Self {
            manifest,
            field_mapper,
            schema_registry,
            generator: MockStripeGenerator::new(),
        }
    }

    fn build_event_catalog() -> Vec<EventTypeDefinition> {
        vec![
            EventTypeDefinition::new(
                "stripe.payment_intent_succeeded",
                "payment_intent.succeeded",
                "A payment intent has been successfully completed.",
            )
            .with_category("payment")
            .with_pii_fields(vec![
                "data.object.customer".to_string(),
                "data.object.receipt_email".to_string(),
            ]),
            EventTypeDefinition::new(
                "stripe.payment_intent_failed",
                "payment_intent.failed",
                "A payment intent has failed.",
            )
            .with_category("payment")
            .with_pii_fields(vec!["data.object.customer".to_string()]),
            EventTypeDefinition::new(
                "stripe.customer_created",
                "customer.created",
                "A new customer has been created.",
            )
            .with_category("customer")
            .with_pii_fields(vec![
                "data.object.email".to_string(),
                "data.object.name".to_string(),
                "data.object.phone".to_string(),
                "data.object.address".to_string(),
            ]),
            EventTypeDefinition::new(
                "stripe.customer_updated",
                "customer.updated",
                "A customer has been updated.",
            )
            .with_category("customer")
            .with_pii_fields(vec![
                "data.object.email".to_string(),
                "data.object.name".to_string(),
                "data.object.phone".to_string(),
                "data.object.address".to_string(),
            ]),
            EventTypeDefinition::new(
                "stripe.invoice_paid",
                "invoice.paid",
                "An invoice has been paid.",
            )
            .with_category("invoice")
            .with_pii_fields(vec!["data.object.customer_email".to_string()]),
            EventTypeDefinition::new(
                "stripe.invoice_payment_failed",
                "invoice.payment_failed",
                "An invoice payment has failed.",
            )
            .with_category("invoice")
            .with_pii_fields(vec!["data.object.customer_email".to_string()]),
            EventTypeDefinition::new(
                "stripe.customer_subscription_created",
                "customer.subscription.created",
                "A new subscription has been created.",
            )
            .with_category("subscription")
            .with_pii_fields(vec!["data.object.customer".to_string()]),
            EventTypeDefinition::new(
                "stripe.customer_subscription_updated",
                "customer.subscription.updated",
                "A subscription has been updated.",
            )
            .with_category("subscription")
            .with_pii_fields(vec!["data.object.customer".to_string()]),
            EventTypeDefinition::new(
                "stripe.customer_subscription_deleted",
                "customer.subscription.deleted",
                "A subscription has been cancelled.",
            )
            .with_category("subscription")
            .with_pii_fields(vec!["data.object.customer".to_string()]),
            EventTypeDefinition::new(
                "stripe.charge_succeeded",
                "charge.succeeded",
                "A charge has succeeded.",
            )
            .with_category("charge")
            .with_pii_fields(vec![
                "data.object.customer".to_string(),
                "data.object.receipt_email".to_string(),
                "data.object.billing_details".to_string(),
            ]),
            EventTypeDefinition::new(
                "stripe.charge_failed",
                "charge.failed",
                "A charge has failed.",
            )
            .with_category("charge")
            .with_pii_fields(vec![
                "data.object.customer".to_string(),
                "data.object.billing_details".to_string(),
            ]),
        ]
    }

    /// Get available Stripe event types
    pub fn available_event_types() -> Vec<String> {
        StripeEventType::all()
            .into_iter()
            .map(|t| t.as_str().to_string())
            .collect()
    }
}

impl Default for MockStripeAdapter {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl SourceAdapter for MockStripeAdapter {
    fn manifest(&self) -> &SourceManifest {
        &self.manifest
    }

    fn field_mapper(&self) -> &FieldMapper {
        &self.field_mapper
    }

    fn schema_registry(&self) -> &SchemaVersionRegistry {
        &self.schema_registry
    }

    fn validate_config(&self, config: &serde_json::Value) -> Result<(), ConfigError> {
        // Validate events_per_second
        if let Some(rate) = config.get("events_per_second") {
            if let Some(rate_f) = rate.as_f64() {
                if rate_f <= 0.0 || rate_f > 100.0 {
                    return Err(ConfigError::InvalidValue {
                        field: "events_per_second".to_string(),
                        message: "must be between 0.1 and 100".to_string(),
                    });
                }
            }
        }

        // Validate event_types
        if let Some(types) = config.get("event_types") {
            if let Some(types_arr) = types.as_array() {
                for t in types_arr {
                    if let Some(t_str) = t.as_str() {
                        if t_str.parse::<StripeEventType>().is_err() {
                            return Err(ConfigError::InvalidValue {
                                field: "event_types".to_string(),
                                message: format!("Unknown event type: {}", t_str),
                            });
                        }
                    }
                }
            }
        }

        Ok(())
    }

    fn as_event_generator(&self) -> Option<&dyn EventGenerator> {
        Some(&self.generator)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_adapter_creation() {
        let adapter = MockStripeAdapter::new();

        assert_eq!(adapter.manifest().id.as_str(), "mock-stripe");
        assert_eq!(adapter.manifest().name, "Mock Stripe");
        assert!(adapter.manifest().capabilities.generator);
        assert!(!adapter.manifest().capabilities.webhook);
    }

    #[test]
    fn test_event_catalog() {
        let adapter = MockStripeAdapter::new();
        let catalog = &adapter.manifest().event_catalog;

        assert!(!catalog.is_empty());
        assert!(catalog
            .iter()
            .any(|e| e.event_type == "stripe.payment_intent_succeeded"));
        assert!(catalog
            .iter()
            .any(|e| e.event_type == "stripe.customer_created"));
    }

    #[test]
    fn test_has_event_generator() {
        let adapter = MockStripeAdapter::new();
        assert!(adapter.as_event_generator().is_some());
    }

    #[test]
    fn test_validate_config_valid() {
        let adapter = MockStripeAdapter::new();
        let config = serde_json::json!({
            "events_per_second": 5.0,
            "event_types": ["payment_intent.succeeded", "customer.created"]
        });

        assert!(adapter.validate_config(&config).is_ok());
    }

    #[test]
    fn test_validate_config_invalid_rate() {
        let adapter = MockStripeAdapter::new();
        let config = serde_json::json!({
            "events_per_second": 200.0
        });

        assert!(adapter.validate_config(&config).is_err());
    }

    #[test]
    fn test_validate_config_invalid_event_type() {
        let adapter = MockStripeAdapter::new();
        let config = serde_json::json!({
            "event_types": ["invalid.type"]
        });

        assert!(adapter.validate_config(&config).is_err());
    }
}
