//! Events Manager Infrastructure
//!
//! Vendor implementations for streaming, storage, and other infrastructure.
//! Feature-gated to allow fast compilation with only needed backends.

#[cfg(feature = "memory")]
pub mod memory;

#[cfg(feature = "kafka")]
pub mod kafka;

#[cfg(feature = "postgres")]
pub mod postgres;

use chronicle_domain::{
    EventEnvelope, EventQuery, StoreResult, StreamResult, SubjectId, TenantId, TimeRange,
};
use chronicle_interfaces::{QueryResult, StreamReceiver};

// Re-export memory types when feature is enabled
#[cfg(feature = "memory")]
pub use memory::{MemoryStore, MemoryStream};

/// Stream backend enum for dispatch without vtable overhead
#[derive(Clone)]
pub enum StreamBackend {
    /// In-memory broadcast channel (always available with memory feature)
    #[cfg(feature = "memory")]
    Memory(memory::MemoryStream),

    /// Kafka backend (behind feature flag)
    #[cfg(feature = "kafka")]
    Kafka(kafka::KafkaStream),
}

impl StreamBackend {
    /// Publish an event to the stream
    #[inline]
    pub async fn publish(&self, event: EventEnvelope) -> StreamResult<()> {
        use chronicle_interfaces::EventStreamProducer;
        match self {
            #[cfg(feature = "memory")]
            Self::Memory(stream) => stream.publish(event).await,
            #[cfg(feature = "kafka")]
            Self::Kafka(stream) => stream.publish(event).await,
        }
    }

    /// Publish a batch of events
    #[inline]
    pub async fn publish_batch(&self, events: Vec<EventEnvelope>) -> StreamResult<()> {
        use chronicle_interfaces::EventStreamProducer;
        match self {
            #[cfg(feature = "memory")]
            Self::Memory(stream) => stream.publish_batch(events).await,
            #[cfg(feature = "kafka")]
            Self::Kafka(stream) => stream.publish_batch(events).await,
        }
    }

    /// Subscribe to the stream
    #[inline]
    pub fn subscribe(&self) -> Box<dyn StreamReceiver> {
        match self {
            #[cfg(feature = "memory")]
            Self::Memory(stream) => Box::new(stream.subscribe()),
            #[cfg(feature = "kafka")]
            Self::Kafka(_stream) => unimplemented!("Kafka subscribe not yet implemented"),
        }
    }

    /// Get buffer contents (memory backend only)
    #[cfg(feature = "memory")]
    pub fn get_buffer(&self) -> Vec<EventEnvelope> {
        match self {
            Self::Memory(stream) => stream.get_buffer(),
            #[cfg(feature = "kafka")]
            Self::Kafka(_) => vec![],
        }
    }
}

/// Storage backend enum for dispatch without vtable overhead
#[derive(Clone)]
pub enum StoreBackend {
    /// In-memory storage (always available with memory feature)
    #[cfg(feature = "memory")]
    Memory(memory::MemoryStore),

    /// Postgres storage (behind feature flag)
    #[cfg(feature = "postgres")]
    Postgres(postgres::PostgresStore),
}

impl StoreBackend {
    /// Append events to the store
    #[inline]
    pub async fn append(&self, events: &[EventEnvelope]) -> StoreResult<()> {
        use chronicle_interfaces::EventStore;
        match self {
            #[cfg(feature = "memory")]
            Self::Memory(store) => store.append(events).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(store) => store.append(events).await,
        }
    }

    /// Fetch events for a subject within a time range
    #[inline]
    pub async fn fetch(
        &self,
        tenant_id: &TenantId,
        subject: &SubjectId,
        range: &TimeRange,
    ) -> StoreResult<Vec<EventEnvelope>> {
        use chronicle_interfaces::EventStore;
        match self {
            #[cfg(feature = "memory")]
            Self::Memory(store) => store.fetch(tenant_id, subject, range).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(store) => store.fetch(tenant_id, subject, range).await,
        }
    }

    /// Fetch all events for a tenant
    #[inline]
    pub async fn fetch_all(&self, tenant_id: &TenantId) -> StoreResult<Vec<EventEnvelope>> {
        use chronicle_interfaces::EventStore;
        match self {
            #[cfg(feature = "memory")]
            Self::Memory(store) => store.fetch_all(tenant_id).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(store) => store.fetch_all(tenant_id).await,
        }
    }

    /// Fetch events by conversation
    #[inline]
    pub async fn fetch_by_conversation(
        &self,
        tenant_id: &TenantId,
        conversation_id: &SubjectId,
    ) -> StoreResult<Vec<EventEnvelope>> {
        use chronicle_interfaces::EventStore;
        match self {
            #[cfg(feature = "memory")]
            Self::Memory(store) => {
                store
                    .fetch_by_conversation(tenant_id, conversation_id)
                    .await
            }
            #[cfg(feature = "postgres")]
            Self::Postgres(store) => {
                store
                    .fetch_by_conversation(tenant_id, conversation_id)
                    .await
            }
        }
    }

    /// Check if event exists
    #[inline]
    pub async fn exists(
        &self,
        tenant_id: &TenantId,
        source: &str,
        source_event_id: &str,
    ) -> StoreResult<bool> {
        use chronicle_interfaces::EventStore;
        match self {
            #[cfg(feature = "memory")]
            Self::Memory(store) => store.exists(tenant_id, source, source_event_id).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(store) => store.exists(tenant_id, source, source_event_id).await,
        }
    }

    /// Get event count
    #[inline]
    pub async fn count(&self, tenant_id: &TenantId) -> StoreResult<usize> {
        use chronicle_interfaces::EventStore;
        match self {
            #[cfg(feature = "memory")]
            Self::Memory(store) => store.count(tenant_id).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(store) => store.count(tenant_id).await,
        }
    }

    /// Query events with advanced filtering
    #[inline]
    pub async fn query(
        &self,
        tenant_id: &TenantId,
        query: &EventQuery,
    ) -> StoreResult<QueryResult> {
        use chronicle_interfaces::EventStore;
        match self {
            #[cfg(feature = "memory")]
            Self::Memory(store) => store.query(tenant_id, query).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(store) => store.query(tenant_id, query).await,
        }
    }

    /// Get available sources for a tenant
    #[inline]
    pub async fn list_sources(&self, tenant_id: &TenantId) -> StoreResult<Vec<String>> {
        use chronicle_interfaces::EventStore;
        match self {
            #[cfg(feature = "memory")]
            Self::Memory(store) => store.list_sources(tenant_id).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(store) => store.list_sources(tenant_id).await,
        }
    }

    /// Get available event types for a tenant
    #[inline]
    pub async fn list_event_types(&self, tenant_id: &TenantId) -> StoreResult<Vec<String>> {
        use chronicle_interfaces::EventStore;
        match self {
            #[cfg(feature = "memory")]
            Self::Memory(store) => store.list_event_types(tenant_id).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(store) => store.list_event_types(tenant_id).await,
        }
    }
}
