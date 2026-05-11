//! Source Adapter
//!
//! Main trait that all source integrations must implement.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::fmt;

use crate::bidirectional::BidirectionalSource;
use crate::catalog::EventTypeDefinition;
use crate::error::ConfigError;
use crate::generator::EventGenerator;
use crate::mapping::FieldMapper;
use crate::oauth::OAuthProvider;
use crate::polling::PollingFetcher;
use crate::schema::SchemaVersionRegistry;
use crate::webhook::WebhookHandler;

/// Unique identifier for a source
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SourceId(String);

impl SourceId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for SourceId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<&str> for SourceId {
    fn from(s: &str) -> Self {
        Self::new(s)
    }
}

impl From<String> for SourceId {
    fn from(s: String) -> Self {
        Self::new(s)
    }
}

/// Capabilities a source can support
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct SourceCapabilities {
    /// Supports receiving webhooks
    pub webhook: bool,
    /// Supports polling for events
    pub polling: bool,
    /// Supports OAuth authentication
    pub oauth: bool,
    /// Supports bidirectional operations (read and write)
    pub bidirectional: bool,
    /// Supports synthetic event generation (mock/simulation sources)
    #[serde(default)]
    pub generator: bool,
}

impl SourceCapabilities {
    pub fn webhook_only() -> Self {
        Self {
            webhook: true,
            ..Default::default()
        }
    }

    pub fn polling_only() -> Self {
        Self {
            polling: true,
            ..Default::default()
        }
    }

    pub fn generator_only() -> Self {
        Self {
            generator: true,
            ..Default::default()
        }
    }

    pub fn full() -> Self {
        Self {
            webhook: true,
            polling: true,
            oauth: true,
            bidirectional: true,
            generator: false, // Generator is opt-in for mock sources
        }
    }
}

/// Metadata about a source integration
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SourceManifest {
    /// Unique source identifier (e.g., "intercom", "zendesk")
    pub id: SourceId,
    /// Human-readable name
    pub name: String,
    /// Description of the source
    pub description: String,
    /// Version of this adapter
    pub version: semver::Version,
    /// Capabilities this source supports
    pub capabilities: SourceCapabilities,
    /// Event types this source can emit
    #[serde(default)]
    pub event_catalog: Vec<EventTypeDefinition>,
    /// Configuration schema (JSON Schema)
    #[serde(default)]
    pub config_schema: serde_json::Value,
    /// Icon URL or identifier
    #[serde(default)]
    pub icon: Option<String>,
    /// Documentation URL
    #[serde(default)]
    pub docs_url: Option<String>,
}

impl SourceManifest {
    /// Create a new source manifest
    pub fn new(id: impl Into<SourceId>, name: impl Into<String>, version: semver::Version) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            description: String::new(),
            version,
            capabilities: SourceCapabilities::default(),
            event_catalog: Vec::new(),
            config_schema: serde_json::json!({}),
            icon: None,
            docs_url: None,
        }
    }

    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = description.into();
        self
    }

    pub fn with_capabilities(mut self, capabilities: SourceCapabilities) -> Self {
        self.capabilities = capabilities;
        self
    }

    pub fn with_event_catalog(mut self, catalog: Vec<EventTypeDefinition>) -> Self {
        self.event_catalog = catalog;
        self
    }

    pub fn with_config_schema(mut self, schema: serde_json::Value) -> Self {
        self.config_schema = schema;
        self
    }

    pub fn with_icon(mut self, icon: impl Into<String>) -> Self {
        self.icon = Some(icon.into());
        self
    }

    pub fn with_docs_url(mut self, url: impl Into<String>) -> Self {
        self.docs_url = Some(url.into());
        self
    }
}

/// Main trait all sources must implement
///
/// This is the central abstraction for source integrations. Each source
/// provides its manifest (metadata), field mapper (transformation rules),
/// and optionally implements additional capability traits.
#[async_trait]
pub trait SourceAdapter: Send + Sync + 'static {
    /// Get source manifest/metadata
    fn manifest(&self) -> &SourceManifest;

    /// Get the field mapper for this source
    fn field_mapper(&self) -> &FieldMapper;

    /// Get the schema version registry
    fn schema_registry(&self) -> &SchemaVersionRegistry;

    /// Validate source-specific configuration
    fn validate_config(&self, config: &serde_json::Value) -> Result<(), ConfigError>;

    /// Optional: Get as webhook handler
    fn as_webhook_handler(&self) -> Option<&dyn WebhookHandler> {
        None
    }

    /// Optional: Get as polling fetcher
    fn as_polling_fetcher(&self) -> Option<&dyn PollingFetcher> {
        None
    }

    /// Optional: Get as OAuth provider
    fn as_oauth_provider(&self) -> Option<&dyn OAuthProvider> {
        None
    }

    /// Optional: Get as bidirectional source
    fn as_bidirectional(&self) -> Option<&dyn BidirectionalSource> {
        None
    }

    /// Optional: Get as event generator (for mock/simulation sources)
    fn as_event_generator(&self) -> Option<&dyn EventGenerator> {
        None
    }
}
