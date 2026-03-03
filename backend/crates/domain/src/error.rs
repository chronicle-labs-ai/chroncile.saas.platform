//! Error Hierarchy
//!
//! Type-safe error handling using thiserror for the Events Manager domain.

use thiserror::Error;

/// Domain-level errors for event operations
#[derive(Error, Debug)]
pub enum EventsError {
    #[error("duplicate event: tenant={tenant_id}, source={source_system}, id={source_event_id}")]
    Duplicate {
        tenant_id: String,
        source_system: String,
        source_event_id: String,
    },

    #[error("invalid envelope: {reason}")]
    InvalidEnvelope { reason: String },

    #[error("tenant not found: {0}")]
    TenantNotFound(String),

    #[error("subject not found: {0}")]
    SubjectNotFound(String),

    #[error("ordering violation: {0}")]
    OrderingViolation(String),

    #[error("replay session not found: {0}")]
    ReplaySessionNotFound(String),

    #[error("replay error: {0}")]
    ReplayError(String),

    #[error("validation error: {0}")]
    Validation(String),

    #[error(transparent)]
    Stream(#[from] StreamError),

    #[error(transparent)]
    Store(#[from] StoreError),
}

/// Errors related to event streaming operations
#[derive(Error, Debug, Clone)]
pub enum StreamError {
    #[error("publish failed: {0}")]
    PublishFailed(String),

    #[error("consumer disconnected")]
    Disconnected,

    #[error("backpressure: buffer full")]
    BackpressureFull,

    #[error("subscription failed: {0}")]
    SubscriptionFailed(String),

    #[error("channel closed")]
    ChannelClosed,
}

/// Errors related to event storage operations
#[derive(Error, Debug, Clone)]
pub enum StoreError {
    #[error("connection failed: {0}")]
    ConnectionFailed(String),

    #[error("query failed: {0}")]
    QueryFailed(String),

    #[error("constraint violation: {0}")]
    ConstraintViolation(String),

    #[error("not found: {0}")]
    NotFound(String),

    #[error("serialization error: {0}")]
    Serialization(String),
}

/// Result type alias for domain operations
pub type EventsResult<T> = Result<T, EventsError>;

/// Result type alias for stream operations
pub type StreamResult<T> = Result<T, StreamError>;

/// Result type alias for store operations
pub type StoreResult<T> = Result<T, StoreError>;

impl EventsError {
    pub fn duplicate(tenant_id: impl Into<String>, source_system: impl Into<String>, source_event_id: impl Into<String>) -> Self {
        Self::Duplicate {
            tenant_id: tenant_id.into(),
            source_system: source_system.into(),
            source_event_id: source_event_id.into(),
        }
    }

    pub fn invalid_envelope(reason: impl Into<String>) -> Self {
        Self::InvalidEnvelope {
            reason: reason.into(),
        }
    }

    pub fn validation(reason: impl Into<String>) -> Self {
        Self::Validation(reason.into())
    }
}

impl StreamError {
    pub fn publish_failed(reason: impl Into<String>) -> Self {
        Self::PublishFailed(reason.into())
    }

    pub fn subscription_failed(reason: impl Into<String>) -> Self {
        Self::SubscriptionFailed(reason.into())
    }
}

impl StoreError {
    pub fn connection_failed(reason: impl Into<String>) -> Self {
        Self::ConnectionFailed(reason.into())
    }

    pub fn query_failed(reason: impl Into<String>) -> Self {
        Self::QueryFailed(reason.into())
    }

    pub fn constraint_violation(reason: impl Into<String>) -> Self {
        Self::ConstraintViolation(reason.into())
    }

    pub fn not_found(reason: impl Into<String>) -> Self {
        Self::NotFound(reason.into())
    }
}
