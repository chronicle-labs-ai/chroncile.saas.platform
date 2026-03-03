//! Error types for source integrations

use thiserror::Error;

/// Errors related to source configuration
#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("Missing required field: {0}")]
    MissingField(String),

    #[error("Invalid field value for '{field}': {message}")]
    InvalidValue { field: String, message: String },

    #[error("Configuration validation failed: {0}")]
    ValidationFailed(String),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

/// General source errors
#[derive(Debug, Error)]
pub enum SourceError {
    #[error("Configuration error: {0}")]
    Config(#[from] ConfigError),

    #[error("Webhook error: {0}")]
    Webhook(#[from] WebhookError),

    #[error("Mapping error: {0}")]
    Mapping(#[from] MappingError),

    #[error("Schema migration error: {0}")]
    Migration(#[from] MigrationError),

    #[error("Catalog error: {0}")]
    Catalog(#[from] CatalogError),

    #[error("Polling error: {0}")]
    Polling(#[from] PollingError),

    #[error("OAuth error: {0}")]
    OAuth(#[from] OAuthError),

    #[error("Internal error: {0}")]
    Internal(String),
}

/// Webhook-specific errors
#[derive(Debug, Error)]
pub enum WebhookError {
    #[error("Invalid signature")]
    InvalidSignature,

    #[error("Missing signature header: {0}")]
    MissingSignatureHeader(String),

    #[error("Payload parsing failed: {0}")]
    ParseError(String),

    #[error("Unsupported topic: {0}")]
    UnsupportedTopic(String),

    #[error("Transformation failed: {0}")]
    TransformError(String),
}

/// Mapping-specific errors
#[derive(Debug, Error)]
pub enum MappingError {
    #[error("JSONPath extraction failed for '{path}': {message}")]
    ExtractionFailed { path: String, message: String },

    #[error("Transform failed: {0}")]
    TransformFailed(String),

    #[error("Missing required mapping target: {0}")]
    MissingTarget(String),

    #[error("Invalid mapping configuration: {0}")]
    InvalidConfig(String),

    #[error("TOML parsing error: {0}")]
    TomlError(#[from] toml::de::Error),
}

/// Schema migration errors
#[derive(Debug, Error)]
pub enum MigrationError {
    #[error("Unknown schema version: {0}")]
    UnknownVersion(u32),

    #[error("Migration failed from v{from} to v{to}: {message}")]
    MigrationFailed { from: u32, to: u32, message: String },

    #[error("Version detection failed: {0}")]
    DetectionFailed(String),
}

/// Event catalog errors
#[derive(Debug, Error)]
pub enum CatalogError {
    #[error("Event type not found: {0}")]
    NotFound(String),

    #[error("Duplicate event type: {0}")]
    Duplicate(String),

    #[error("Invalid catalog configuration: {0}")]
    InvalidConfig(String),

    #[error("TOML parsing error: {0}")]
    TomlError(#[from] toml::de::Error),
}

/// Polling-specific errors
#[derive(Debug, Error)]
pub enum PollingError {
    #[error("API request failed: {0}")]
    RequestFailed(String),

    #[error("Rate limit exceeded")]
    RateLimited,

    #[error("Authentication failed: {0}")]
    AuthFailed(String),

    #[error("Pagination error: {0}")]
    PaginationError(String),
}

/// OAuth-specific errors
#[derive(Debug, Error)]
pub enum OAuthError {
    #[error("Token exchange failed: {0}")]
    TokenExchangeFailed(String),

    #[error("Token refresh failed: {0}")]
    RefreshFailed(String),

    #[error("Invalid state parameter")]
    InvalidState,

    #[error("Authorization denied: {0}")]
    Denied(String),
}

