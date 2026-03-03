//! Ingest Context
//!
//! Context passed to source handlers during event ingestion.

use chronicle_domain::TenantId;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Context for event ingestion operations
#[derive(Clone, Debug)]
pub struct IngestContext {
    /// Tenant this event belongs to
    pub tenant_id: TenantId,
    /// Source-specific configuration
    pub config: SourceConfig,
    /// Additional metadata
    pub metadata: HashMap<String, String>,
}

impl IngestContext {
    /// Create a new ingest context
    pub fn new(tenant_id: impl Into<TenantId>) -> Self {
        Self {
            tenant_id: tenant_id.into(),
            config: SourceConfig::default(),
            metadata: HashMap::new(),
        }
    }

    /// Set the source configuration
    pub fn with_config(mut self, config: SourceConfig) -> Self {
        self.config = config;
        self
    }

    /// Add metadata
    pub fn with_metadata(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.metadata.insert(key.into(), value.into());
        self
    }
}

/// Source-specific configuration
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct SourceConfig {
    /// Webhook secret for signature verification
    #[serde(default)]
    pub webhook_secret: Option<String>,
    /// API key for polling
    #[serde(default)]
    pub api_key: Option<String>,
    /// API base URL override
    #[serde(default)]
    pub api_base_url: Option<String>,
    /// OAuth credentials
    #[serde(default)]
    pub oauth: Option<OAuthConfig>,
    /// Additional source-specific settings
    #[serde(default)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// OAuth configuration
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
    #[serde(default)]
    pub scopes: Vec<String>,
    #[serde(default)]
    pub access_token: Option<String>,
    #[serde(default)]
    pub refresh_token: Option<String>,
    #[serde(default)]
    pub expires_at: Option<i64>,
}
