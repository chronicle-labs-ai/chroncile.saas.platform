//! Chronicle-native event model re-exports.
//!
//! The platform still owns its auth/control-plane domain, but all event
//! ingestion, querying, linking, and storage should flow through these types.

pub use chronicle_core::entity_ref::EntityRef;
pub use chronicle_core::error::{
    ChronicleError, StoreError as ChronicleStoreError, ValidationError as ChronicleValidationError,
};
pub use chronicle_core::event::{Event, EventBuilder, PendingEntityRef};
pub use chronicle_core::ids::{
    Confidence, EntityId, EntityType, EventId, EventType, LinkId, OrgId, Source, Topic,
};
pub use chronicle_core::link::{EventLink, LinkDirection};
pub use chronicle_core::media::MediaAttachment;
pub use chronicle_core::query::{
    EventResult, FilterOp, GraphQuery, GroupBy, OrderBy, PayloadFilter, SemanticQuery,
    StructuredQuery, TimelineQuery,
};
pub use chronicle_core::time_range::TimeRange as ChronicleTimeRange;

/// Payload key used to preserve legacy platform metadata during migration.
pub const PLATFORM_METADATA_KEY: &str = "_platform";

/// Payload key used to preserve the previous event identifier and dedup inputs.
pub const LEGACY_METADATA_KEY: &str = "_legacy";
