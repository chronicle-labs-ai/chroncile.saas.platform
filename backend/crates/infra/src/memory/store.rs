//! In-memory Chronicle storage wrapper.

use std::sync::Arc;

use chronicle_core::ids::OrgId;
use chronicle_store::memory::InMemoryBackend;
use chronicle_store::StorageEngine;

#[derive(Clone, Default)]
pub struct MemoryStore {
    backend: Arc<InMemoryBackend>,
}

impl MemoryStore {
    pub fn new() -> Self {
        Self {
            backend: Arc::new(InMemoryBackend::new()),
        }
    }

    pub fn backend(&self) -> Arc<InMemoryBackend> {
        Arc::clone(&self.backend)
    }

    pub fn exists_source_event_id(
        &self,
        tenant_id: &str,
        source: &str,
        source_event_id: &str,
    ) -> bool {
        self.backend
            .exists_source_event_id(&OrgId::new(tenant_id), source, source_event_id)
    }

    pub fn engine(&self) -> StorageEngine {
        StorageEngine {
            events: self.backend.clone(),
            entity_refs: self.backend.clone(),
            links: self.backend.clone(),
            embeddings: self.backend.clone(),
            schemas: self.backend.clone(),
            subscriptions: Some(self.backend.clone()),
        }
    }
}
