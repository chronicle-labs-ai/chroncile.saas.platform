//! Chronicle-native infrastructure adapters for the platform backend.

use std::sync::Arc;

pub mod conversion;

#[cfg(feature = "memory")]
pub mod memory;

#[cfg(feature = "kafka")]
pub mod kafka;

#[cfg(feature = "helix")]
pub mod helix;

#[cfg(feature = "postgres")]
pub mod postgres;

use chronicle_core::error::ChronicleError;
use chronicle_core::event::Event as ChronicleEvent;
use chronicle_core::ids::EventId;
use chronicle_core::ids::{OrgId, Source};
use chronicle_core::query::{FilterOp, OrderBy, PayloadFilter, StructuredQuery};
use chronicle_domain::{
    EventEnvelope, StoreError, StoreResult, StreamResult, TenantId, LEGACY_METADATA_KEY,
};
use chronicle_interfaces::StreamReceiver;
use chronicle_link::LinkService;
use chronicle_query::QueryService;
use chronicle_store::StorageEngine;
use chronicle_store::SubscriptionService;

#[cfg(feature = "memory")]
pub use memory::{MemoryStore, MemoryStream};

fn map_store_error(error: ChronicleError) -> StoreError {
    match error {
        ChronicleError::Store(err) => StoreError::QueryFailed(err.to_string()),
        ChronicleError::Validation(err) => StoreError::ConstraintViolation(err.to_string()),
        other => StoreError::QueryFailed(other.to_string()),
    }
}

/// Stream backend for legacy producers and SSE consumers.
#[derive(Clone)]
pub enum StreamBackend {
    #[cfg(feature = "memory")]
    Memory(memory::MemoryStream),

    #[cfg(feature = "kafka")]
    Kafka(kafka::KafkaStream),
}

impl StreamBackend {
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

    #[inline]
    pub fn subscribe(&self) -> Box<dyn StreamReceiver> {
        match self {
            #[cfg(feature = "memory")]
            Self::Memory(stream) => Box::new(stream.subscribe()),
            #[cfg(feature = "kafka")]
            Self::Kafka(_stream) => unimplemented!("Kafka subscribe not yet implemented"),
        }
    }

    #[cfg(feature = "memory")]
    pub fn get_buffer(&self) -> Vec<EventEnvelope> {
        match self {
            Self::Memory(stream) => stream.get_buffer(),
            #[cfg(feature = "kafka")]
            Self::Kafka(_) => vec![],
        }
    }

    pub async fn health_check(&self) -> Result<(), String> {
        match self {
            #[cfg(feature = "memory")]
            Self::Memory(_) => Ok(()),
            #[cfg(feature = "kafka")]
            Self::Kafka(_) => Ok(()),
        }
    }
}

/// Chronicle-native store backend.
#[derive(Clone)]
pub enum StoreBackend {
    #[cfg(feature = "memory")]
    Memory(memory::MemoryStore),

    #[cfg(feature = "helix")]
    Helix(helix::HelixStore),

    #[cfg(feature = "postgres")]
    Postgres(postgres::PostgresStore),
}

impl StoreBackend {
    pub fn engine(&self) -> StorageEngine {
        match self {
            #[cfg(feature = "memory")]
            Self::Memory(store) => store.engine(),
            #[cfg(feature = "helix")]
            Self::Helix(store) => store.engine(),
            #[cfg(feature = "postgres")]
            Self::Postgres(store) => store.engine(),
        }
    }

    #[cfg(feature = "helix")]
    pub fn helix(&self) -> Option<&helix::HelixStore> {
        match self {
            Self::Helix(store) => Some(store),
            #[cfg(feature = "memory")]
            Self::Memory(_) => None,
            #[cfg(feature = "postgres")]
            Self::Postgres(_) => None,
        }
    }

    pub fn query_service(&self) -> QueryService {
        QueryService::new(self.engine())
    }

    pub fn link_service(&self) -> LinkService {
        LinkService::new(self.engine())
    }

    pub fn subscription_service(&self) -> Option<Arc<dyn SubscriptionService>> {
        self.engine().subscriptions
    }

    pub async fn insert_events(
        &self,
        events: &[ChronicleEvent],
    ) -> Result<Vec<EventId>, ChronicleError> {
        self.engine()
            .events
            .insert_events(events)
            .await
            .map_err(Into::into)
    }

    pub async fn append(&self, events: &[EventEnvelope]) -> StoreResult<()> {
        let native_events: Vec<ChronicleEvent> = events
            .iter()
            .map(conversion::legacy_event_to_chronicle)
            .collect();
        self.insert_events(&native_events)
            .await
            .map(|_| ())
            .map_err(map_store_error)
    }

    pub async fn health_check(&self) -> Result<(), String> {
        match self {
            #[cfg(feature = "memory")]
            Self::Memory(_) => Ok(()),
            #[cfg(feature = "helix")]
            Self::Helix(store) => store
                .canonical()
                .health_check()
                .await
                .map_err(|e| e.to_string()),
            #[cfg(feature = "postgres")]
            Self::Postgres(store) => store.health_check().await.map_err(|e| e.to_string()),
        }
    }

    pub async fn exists(
        &self,
        tenant_id: &TenantId,
        source: &str,
        source_event_id: &str,
    ) -> StoreResult<bool> {
        #[cfg(feature = "memory")]
        if let Self::Memory(store) = self {
            return Ok(store.exists_source_event_id(tenant_id.as_str(), source, source_event_id));
        }

        #[cfg(feature = "postgres")]
        if let Self::Postgres(store) = self {
            return store
                .exists_source_event_id(tenant_id, source, source_event_id)
                .await
                .map_err(|err| StoreError::QueryFailed(err.to_string()));
        }

        #[cfg(feature = "helix")]
        if let Self::Helix(store) = self {
            return store
                .canonical()
                .exists_source_event_id(tenant_id, source, source_event_id)
                .await
                .map_err(|err| StoreError::QueryFailed(err.to_string()));
        }

        let query = StructuredQuery {
            org_id: OrgId::new(tenant_id.as_str()),
            entity: None,
            source: Some(Source::new(source)),
            topic: None,
            event_type: None,
            time_range: None,
            payload_filters: vec![PayloadFilter {
                path: format!("{LEGACY_METADATA_KEY}.source_event_id"),
                op: FilterOp::Eq(serde_json::json!(source_event_id)),
            }],
            group_by: None,
            order_by: OrderBy::EventTimeDesc,
            limit: 1,
            offset: 0,
        };

        let count = self
            .engine()
            .events
            .count(&query)
            .await
            .map_err(|err| map_store_error(err.into()))?;
        Ok(count > 0)
    }
}
