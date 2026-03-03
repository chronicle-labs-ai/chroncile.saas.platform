//! Mock Stripe Event Generator
//!
//! Implements the EventGenerator trait to produce synthetic Stripe events.

use async_trait::async_trait;
use chronicle_domain::{Actor, EventEnvelope, Subject, TenantId};
use chronicle_sources_core::{EventGenerator, GeneratorConfig, GeneratorError};
use chrono::Utc;

use crate::templates::{StripeEventTemplate, StripeEventType};

/// Mock Stripe event generator
///
/// Generates realistic Stripe webhook events at a configurable rate.
/// Events are created using templates that match the structure of real
/// Stripe webhooks.
#[derive(Clone)]
pub struct MockStripeGenerator {
    /// Bias towards success events (0.0 - 1.0, default 0.8)
    success_bias: f64,
}

impl MockStripeGenerator {
    /// Create a new mock Stripe generator
    pub fn new() -> Self {
        Self { success_bias: 0.8 }
    }

    /// Set the success bias (probability of generating success vs failure events)
    pub fn with_success_bias(mut self, bias: f64) -> Self {
        self.success_bias = bias.clamp(0.0, 1.0);
        self
    }

    /// Pick a random event type based on configuration
    fn pick_event_type(&self, config: &GeneratorConfig) -> StripeEventType {
        // If specific event types are configured, pick from those
        if !config.event_types.is_empty() {
            let type_str = &config.event_types[rand::random::<usize>() % config.event_types.len()];
            if let Some(et) = StripeEventType::from_str(type_str) {
                return et;
            }
        }

        // Otherwise, use success bias to pick event type
        if rand::random::<f64>() < self.success_bias {
            StripeEventType::random_success()
        } else {
            StripeEventType::random()
        }
    }
}

impl Default for MockStripeGenerator {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl EventGenerator for MockStripeGenerator {
    async fn generate_event(
        &self,
        config: &GeneratorConfig,
    ) -> Result<EventEnvelope, GeneratorError> {
        let event_type = self.pick_event_type(config);
        let timestamp = Utc::now();

        // Generate the Stripe webhook payload
        let stripe_payload = StripeEventTemplate::generate(event_type, timestamp);

        // Extract relevant fields for the EventEnvelope
        let stripe_event_id = stripe_payload["id"]
            .as_str()
            .unwrap_or("unknown")
            .to_string();
        let customer_id = stripe_payload["data"]["object"]["customer"]
            .as_str()
            .or_else(|| stripe_payload["data"]["object"]["id"].as_str())
            .unwrap_or("unknown")
            .to_string();

        // Map to our event type format
        let our_event_type = format!("stripe.{}", event_type.as_str().replace('.', "_"));

        // Create payload as Box<RawValue>
        let payload = EventEnvelope::make_payload(&stripe_payload)
            .map_err(|e| GeneratorError::Generation(format!("Failed to create payload: {}", e)))?;

        // Create the EventEnvelope
        let envelope = EventEnvelope::new(
            TenantId::new(&config.tenant_id),
            "mock-stripe",
            stripe_event_id.clone(),
            our_event_type.clone(),
            Subject::new(customer_id.clone()),
            Actor::system().with_name("Stripe"),
            payload,
        )
        .with_occurred_at(timestamp);

        tracing::debug!(
            event_type = %event_type,
            stripe_event_id = %stripe_event_id,
            "Generated mock Stripe event"
        );

        Ok(envelope)
    }

    fn available_event_types(&self) -> Vec<String> {
        StripeEventType::all()
            .into_iter()
            .map(|t| t.as_str().to_string())
            .collect()
    }

    fn validate_config(&self, config: &GeneratorConfig) -> Result<(), GeneratorError> {
        // Validate event types if specified
        for event_type in &config.event_types {
            if StripeEventType::from_str(event_type).is_none() {
                return Err(GeneratorError::Config(format!(
                    "Unknown Stripe event type: {}. Valid types: {:?}",
                    event_type,
                    self.available_event_types()
                )));
            }
        }

        // Validate rate
        if config.events_per_second <= 0.0 {
            return Err(GeneratorError::Config(
                "events_per_second must be positive".to_string(),
            ));
        }

        if config.events_per_second > 100.0 {
            return Err(GeneratorError::Config(
                "events_per_second cannot exceed 100".to_string(),
            ));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_generate_event() {
        let generator = MockStripeGenerator::new();
        let config = GeneratorConfig::default();

        let event = generator.generate_event(&config).await.unwrap();

        assert_eq!(event.source, "mock-stripe");
        assert!(event.event_type.starts_with("stripe."));
        // Parse the raw payload to check the id field
        let payload: serde_json::Value = serde_json::from_str(event.payload.get()).unwrap();
        assert!(!payload["id"].is_null());
    }

    #[tokio::test]
    async fn test_generate_specific_event_type() {
        let generator = MockStripeGenerator::new();
        let config = GeneratorConfig::default()
            .with_event_types(vec!["payment_intent.succeeded".to_string()]);

        let event = generator.generate_event(&config).await.unwrap();

        assert_eq!(event.event_type, "stripe.payment_intent_succeeded");
    }

    #[test]
    fn test_validate_config_invalid_event_type() {
        let generator = MockStripeGenerator::new();
        let config =
            GeneratorConfig::default().with_event_types(vec!["invalid.event.type".to_string()]);

        let result = generator.validate_config(&config);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_config_valid() {
        let generator = MockStripeGenerator::new();
        let config = GeneratorConfig::default()
            .with_rate(5.0)
            .with_event_types(vec!["payment_intent.succeeded".to_string()]);

        let result = generator.validate_config(&config);
        assert!(result.is_ok());
    }

    #[test]
    fn test_available_event_types() {
        let generator = MockStripeGenerator::new();
        let types = generator.available_event_types();

        assert!(types.contains(&"payment_intent.succeeded".to_string()));
        assert!(types.contains(&"customer.created".to_string()));
        assert!(types.contains(&"charge.succeeded".to_string()));
    }
}
