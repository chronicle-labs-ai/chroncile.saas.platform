//! Sources Core
//!
//! Core abstractions for event source integrations. This crate provides:
//!
//! - **SourceAdapter**: Main trait all sources must implement
//! - **WebhookHandler**: For webhook-based event ingestion
//! - **PollingFetcher**: For polling-based event retrieval
//! - **OAuthProvider**: For OAuth authentication flows
//! - **BidirectionalSource**: For read/write integrations
//! - **EventGenerator**: For mock/simulation sources that generate events
//!
//! ## Metadata System
//!
//! - **FieldMapper**: Declarative JSON-to-EventEnvelope transformation
//! - **SchemaVersionRegistry**: Payload version detection and migration
//! - **EventCatalog**: Self-documenting event type registry

pub mod adapter;
pub mod bidirectional;
pub mod catalog;
pub mod context;
pub mod error;
pub mod generator;
pub mod mapping;
pub mod oauth;
pub mod polling;
pub mod schema;
pub mod webhook;

// Re-export main types
pub use adapter::{SourceAdapter, SourceCapabilities, SourceId, SourceManifest};
pub use bidirectional::BidirectionalSource;
pub use catalog::{EventCatalog, EventTypeDefinition};
pub use context::IngestContext;
pub use error::{ConfigError, SourceError};
pub use generator::{EventGenerator, GeneratorConfig, GeneratorError, GeneratorHandle, GeneratorStatus};
pub use mapping::{FieldMapper, FieldMapping, MappingTarget, Transform};
pub use oauth::OAuthProvider;
pub use polling::PollingFetcher;
pub use schema::{SchemaMigration, SchemaVersion, SchemaVersionRegistry};
pub use webhook::WebhookHandler;

