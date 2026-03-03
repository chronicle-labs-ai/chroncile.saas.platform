//! Event Generator
//!
//! Trait for sources that can synthetically generate events. This is useful for:
//! - Mock sources for testing and demos
//! - Simulation scenarios
//! - Load testing
//!
//! Unlike webhook or polling sources that receive external events, generators
//! actively produce events on a schedule or trigger.

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use chronicle_domain::EventEnvelope;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::sync::mpsc;

/// Configuration for event generation
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GeneratorConfig {
    /// Whether the generator is enabled
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    /// Events per second (can be fractional, e.g., 0.5 = 1 event every 2 seconds)
    #[serde(default = "default_rate")]
    pub events_per_second: f64,
    /// Maximum events to generate (None = unlimited)
    #[serde(default)]
    pub max_events: Option<u64>,
    /// Event types to generate (empty = all available)
    #[serde(default)]
    pub event_types: Vec<String>,
    /// Tenant ID to use for generated events
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
    /// Custom configuration specific to the generator
    #[serde(default)]
    pub custom: serde_json::Value,
}

fn default_enabled() -> bool {
    true
}

fn default_rate() -> f64 {
    1.0
}

fn default_tenant() -> String {
    "default".to_string()
}

impl Default for GeneratorConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            events_per_second: 1.0,
            max_events: None,
            event_types: Vec::new(),
            tenant_id: "default".to_string(),
            custom: serde_json::json!({}),
        }
    }
}

impl GeneratorConfig {
    /// Create a new generator config
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the events per second rate
    pub fn with_rate(mut self, rate: f64) -> Self {
        self.events_per_second = rate;
        self
    }

    /// Set a maximum number of events
    pub fn with_max_events(mut self, max: u64) -> Self {
        self.max_events = Some(max);
        self
    }

    /// Set the tenant ID
    pub fn with_tenant(mut self, tenant: impl Into<String>) -> Self {
        self.tenant_id = tenant.into();
        self
    }

    /// Set specific event types to generate
    pub fn with_event_types(mut self, types: Vec<String>) -> Self {
        self.event_types = types;
        self
    }

    /// Get the interval between events
    pub fn interval(&self) -> Duration {
        if self.events_per_second <= 0.0 {
            Duration::from_secs(1)
        } else {
            Duration::from_secs_f64(1.0 / self.events_per_second)
        }
    }
}

/// Status of a running generator
#[derive(Clone, Debug, Serialize, Deserialize)]
#[derive(Default)]
pub struct GeneratorStatus {
    /// Whether the generator is currently running
    pub running: bool,
    /// Total events generated since start
    pub events_generated: u64,
    /// Time when generation started
    pub started_at: Option<DateTime<Utc>>,
    /// Last event generation time
    pub last_event_at: Option<DateTime<Utc>>,
    /// Current configuration
    pub config: GeneratorConfig,
    /// Any error message
    pub error: Option<String>,
}


/// Handle to control a running generator
pub struct GeneratorHandle {
    /// Channel to send stop signal
    stop_tx: mpsc::Sender<()>,
}

impl GeneratorHandle {
    /// Create a new generator handle
    pub fn new(stop_tx: mpsc::Sender<()>) -> Self {
        Self { stop_tx }
    }

    /// Stop the generator
    pub async fn stop(&self) -> Result<(), GeneratorError> {
        self.stop_tx
            .send(())
            .await
            .map_err(|_| GeneratorError::AlreadyStopped)
    }
}

/// Errors that can occur during event generation
#[derive(Debug, thiserror::Error)]
pub enum GeneratorError {
    #[error("Generator is not supported by this source")]
    NotSupported,
    #[error("Generator is already running")]
    AlreadyRunning,
    #[error("Generator is already stopped")]
    AlreadyStopped,
    #[error("Configuration error: {0}")]
    Config(String),
    #[error("Generation error: {0}")]
    Generation(String),
}

/// Trait for sources that can generate synthetic events
///
/// Implement this trait to create mock or simulation sources that
/// actively produce events rather than receiving them from external systems.
#[async_trait]
pub trait EventGenerator: Send + Sync {
    /// Generate a single event
    ///
    /// This is called repeatedly based on the configured rate.
    /// The implementation should return a fully-formed EventEnvelope.
    async fn generate_event(&self, config: &GeneratorConfig) -> Result<EventEnvelope, GeneratorError>;

    /// Get available event types this generator can produce
    fn available_event_types(&self) -> Vec<String>;

    /// Validate generator-specific configuration
    fn validate_config(&self, config: &GeneratorConfig) -> Result<(), GeneratorError> {
        // Default: accept any configuration
        let _ = config;
        Ok(())
    }

    /// Start the generator in a background task
    ///
    /// Returns a handle that can be used to stop the generator,
    /// and sends generated events through the provided channel.
    async fn start(
        &self,
        config: GeneratorConfig,
        event_tx: mpsc::UnboundedSender<EventEnvelope>,
    ) -> Result<GeneratorHandle, GeneratorError>
    where
        Self: Sized + Clone + 'static,
    {
        self.validate_config(&config)?;

        let (stop_tx, mut stop_rx) = mpsc::channel::<()>(1);
        let generator = self.clone();
        let interval = config.interval();

        tokio::spawn(async move {
            let mut events_generated: u64 = 0;
            let mut interval_timer = tokio::time::interval(interval);

            loop {
                tokio::select! {
                    _ = stop_rx.recv() => {
                        tracing::info!("Generator stopped after {} events", events_generated);
                        break;
                    }
                    _ = interval_timer.tick() => {
                        // Check max events
                        if let Some(max) = config.max_events {
                            if events_generated >= max {
                                tracing::info!("Generator reached max events: {}", max);
                                break;
                            }
                        }

                        // Generate event
                        match generator.generate_event(&config).await {
                            Ok(event) => {
                                if event_tx.send(event).is_err() {
                                    tracing::warn!("Event receiver dropped, stopping generator");
                                    break;
                                }
                                events_generated += 1;
                            }
                            Err(e) => {
                                tracing::error!("Generator error: {}", e);
                            }
                        }
                    }
                }
            }
        });

        Ok(GeneratorHandle::new(stop_tx))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generator_config_default() {
        let config = GeneratorConfig::default();
        assert!(config.enabled);
        assert_eq!(config.events_per_second, 1.0);
        assert!(config.max_events.is_none());
    }

    #[test]
    fn test_generator_config_interval() {
        let config = GeneratorConfig::default().with_rate(2.0);
        assert_eq!(config.interval(), Duration::from_millis(500));

        let config = GeneratorConfig::default().with_rate(0.5);
        assert_eq!(config.interval(), Duration::from_secs(2));
    }

    #[test]
    fn test_generator_config_builder() {
        let config = GeneratorConfig::new()
            .with_rate(5.0)
            .with_max_events(100)
            .with_tenant("test-tenant")
            .with_event_types(vec!["payment.created".to_string()]);

        assert_eq!(config.events_per_second, 5.0);
        assert_eq!(config.max_events, Some(100));
        assert_eq!(config.tenant_id, "test-tenant");
        assert_eq!(config.event_types, vec!["payment.created"]);
    }
}

