//! Storage Abstraction
//!
//! Defines traits and enum dispatch for event storage backends.
//! Supports both in-memory (DashMap) and Postgres implementations.

use async_trait::async_trait;
use chronicle_domain::{EventEnvelope, EventQuery, StoreResult, SubjectId, TenantId, TimeRange};

/// Result of a query with metadata about available filters
#[derive(Debug, Clone, Default)]
pub struct QueryResult {
    /// The matching events
    pub events: Vec<EventEnvelope>,
    /// Available sources in the tenant's events
    pub available_sources: Vec<String>,
    /// Available event types in the tenant's events
    pub available_event_types: Vec<String>,
}

/// Trait for event storage
#[async_trait]
pub trait EventStore: Send + Sync {
    /// Append events to the store (idempotent via unique constraint)
    async fn append(&self, events: &[EventEnvelope]) -> StoreResult<()>;

    /// Fetch events for a subject within a time range
    async fn fetch(
        &self,
        tenant_id: &TenantId,
        subject: &SubjectId,
        range: &TimeRange,
    ) -> StoreResult<Vec<EventEnvelope>>;

    /// Fetch all events for a tenant (use with caution - for small datasets)
    async fn fetch_all(&self, tenant_id: &TenantId) -> StoreResult<Vec<EventEnvelope>>;

    /// Fetch events by conversation ID
    async fn fetch_by_conversation(
        &self,
        tenant_id: &TenantId,
        conversation_id: &SubjectId,
    ) -> StoreResult<Vec<EventEnvelope>>;

    /// Query events with advanced filtering
    /// Returns events matching the query along with available filter options
    async fn query(
        &self,
        tenant_id: &TenantId,
        query: &EventQuery,
    ) -> StoreResult<QueryResult>;

    /// Get available sources for a tenant
    async fn list_sources(&self, tenant_id: &TenantId) -> StoreResult<Vec<String>>;

    /// Get available event types for a tenant
    async fn list_event_types(&self, tenant_id: &TenantId) -> StoreResult<Vec<String>>;

    /// Check if an event already exists (for deduplication)
    async fn exists(&self, tenant_id: &TenantId, source: &str, source_event_id: &str) -> StoreResult<bool>;

    /// Get event count for a tenant
    async fn count(&self, tenant_id: &TenantId) -> StoreResult<usize>;
}

/// Trait for projection storage (derived views)
#[async_trait]
pub trait ProjectionStore: Send + Sync {
    /// Update a projection based on an event
    async fn update(&self, event: &EventEnvelope) -> StoreResult<()>;
}

// Forward declaration for memory store handle
#[derive(Clone)]
pub struct MemoryStoreHandle {
    inner: std::sync::Arc<dyn EventStore>,
}

impl MemoryStoreHandle {
    pub fn new<S: EventStore + 'static>(store: S) -> Self {
        Self {
            inner: std::sync::Arc::new(store),
        }
    }

    pub async fn append(&self, events: &[EventEnvelope]) -> StoreResult<()> {
        self.inner.append(events).await
    }

    pub async fn fetch(
        &self,
        tenant_id: &TenantId,
        subject: &SubjectId,
        range: &TimeRange,
    ) -> StoreResult<Vec<EventEnvelope>> {
        self.inner.fetch(tenant_id, subject, range).await
    }

    pub async fn fetch_all(&self, tenant_id: &TenantId) -> StoreResult<Vec<EventEnvelope>> {
        self.inner.fetch_all(tenant_id).await
    }

    pub async fn fetch_by_conversation(
        &self,
        tenant_id: &TenantId,
        conversation_id: &SubjectId,
    ) -> StoreResult<Vec<EventEnvelope>> {
        self.inner.fetch_by_conversation(tenant_id, conversation_id).await
    }

    pub async fn query(
        &self,
        tenant_id: &TenantId,
        query: &EventQuery,
    ) -> StoreResult<QueryResult> {
        self.inner.query(tenant_id, query).await
    }

    pub async fn list_sources(&self, tenant_id: &TenantId) -> StoreResult<Vec<String>> {
        self.inner.list_sources(tenant_id).await
    }

    pub async fn list_event_types(&self, tenant_id: &TenantId) -> StoreResult<Vec<String>> {
        self.inner.list_event_types(tenant_id).await
    }

    pub async fn exists(&self, tenant_id: &TenantId, source: &str, source_event_id: &str) -> StoreResult<bool> {
        self.inner.exists(tenant_id, source, source_event_id).await
    }

    pub async fn count(&self, tenant_id: &TenantId) -> StoreResult<usize> {
        self.inner.count(tenant_id).await
    }
}

/// Postgres store handle (placeholder)
#[cfg(feature = "postgres")]
#[derive(Clone)]
pub struct PostgresStoreHandle {
    _placeholder: (),
}

/// Storage backend enum for dispatch without vtable overhead
#[derive(Clone)]
pub enum StoreBackend {
    /// In-memory storage (always available)
    Memory(MemoryStoreHandle),

    /// Postgres storage (behind feature flag)
    #[cfg(feature = "postgres")]
    Postgres(PostgresStoreHandle),
}

impl StoreBackend {
    /// Append events to the store
    #[inline]
    pub async fn append(&self, events: &[EventEnvelope]) -> StoreResult<()> {
        match self {
            Self::Memory(handle) => handle.append(events).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(_handle) => {
                unimplemented!("Postgres backend not yet implemented")
            }
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
        match self {
            Self::Memory(handle) => handle.fetch(tenant_id, subject, range).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(_handle) => {
                unimplemented!("Postgres backend not yet implemented")
            }
        }
    }

    /// Fetch all events for a tenant
    #[inline]
    pub async fn fetch_all(&self, tenant_id: &TenantId) -> StoreResult<Vec<EventEnvelope>> {
        match self {
            Self::Memory(handle) => handle.fetch_all(tenant_id).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(_handle) => {
                unimplemented!("Postgres backend not yet implemented")
            }
        }
    }

    /// Fetch events by conversation
    #[inline]
    pub async fn fetch_by_conversation(
        &self,
        tenant_id: &TenantId,
        conversation_id: &SubjectId,
    ) -> StoreResult<Vec<EventEnvelope>> {
        match self {
            Self::Memory(handle) => handle.fetch_by_conversation(tenant_id, conversation_id).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(_handle) => {
                unimplemented!("Postgres backend not yet implemented")
            }
        }
    }

    /// Query events with advanced filtering
    #[inline]
    pub async fn query(
        &self,
        tenant_id: &TenantId,
        query: &EventQuery,
    ) -> StoreResult<QueryResult> {
        match self {
            Self::Memory(handle) => handle.query(tenant_id, query).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(_handle) => {
                unimplemented!("Postgres backend not yet implemented")
            }
        }
    }

    /// Get available sources for a tenant
    #[inline]
    pub async fn list_sources(&self, tenant_id: &TenantId) -> StoreResult<Vec<String>> {
        match self {
            Self::Memory(handle) => handle.list_sources(tenant_id).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(_handle) => {
                unimplemented!("Postgres backend not yet implemented")
            }
        }
    }

    /// Get available event types for a tenant
    #[inline]
    pub async fn list_event_types(&self, tenant_id: &TenantId) -> StoreResult<Vec<String>> {
        match self {
            Self::Memory(handle) => handle.list_event_types(tenant_id).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(_handle) => {
                unimplemented!("Postgres backend not yet implemented")
            }
        }
    }

    /// Check if event exists
    #[inline]
    pub async fn exists(&self, tenant_id: &TenantId, source: &str, source_event_id: &str) -> StoreResult<bool> {
        match self {
            Self::Memory(handle) => handle.exists(tenant_id, source, source_event_id).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(_handle) => {
                unimplemented!("Postgres backend not yet implemented")
            }
        }
    }

    /// Get event count
    #[inline]
    pub async fn count(&self, tenant_id: &TenantId) -> StoreResult<usize> {
        match self {
            Self::Memory(handle) => handle.count(tenant_id).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(_handle) => {
                unimplemented!("Postgres backend not yet implemented")
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use chronicle_domain::StoreError;

    #[test]
    fn test_store_error_display() {
        let err = StoreError::NotFound("test".to_string());
        assert!(err.to_string().contains("test"));
    }
}
