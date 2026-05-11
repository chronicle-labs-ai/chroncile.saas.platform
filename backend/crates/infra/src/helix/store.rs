use std::sync::Arc;

use chronicle_store::helix::{
    HelixConnectionConfig, HelixEventStore, HelixGraphBackend, HelixLinkingPipeline,
    HelixTraceOodService, LinkDecisionModel,
};
use chronicle_store::StorageEngine;

use crate::postgres::PostgresStore;

#[derive(Clone)]
pub struct HelixStore {
    canonical: PostgresStore,
    graph: Arc<HelixGraphBackend>,
    events: Arc<HelixEventStore>,
}

impl HelixStore {
    pub fn new(canonical: PostgresStore, config: HelixConnectionConfig) -> Self {
        let backend = canonical.backend();
        let graph = Arc::new(HelixGraphBackend::new(
            config,
            backend.clone(),
            backend.clone(),
            backend.clone(),
            backend.clone(),
        ));
        let events = Arc::new(HelixEventStore::new(backend, graph.clone()));

        Self {
            canonical,
            graph,
            events,
        }
    }

    pub fn canonical(&self) -> &PostgresStore {
        &self.canonical
    }

    pub fn graph_backend(&self) -> Arc<HelixGraphBackend> {
        Arc::clone(&self.graph)
    }

    pub fn linking_pipeline(&self, evaluator: Arc<dyn LinkDecisionModel>) -> HelixLinkingPipeline {
        HelixLinkingPipeline::new(self.graph.clone(), evaluator)
    }

    pub fn trace_ood_service(&self) -> HelixTraceOodService {
        HelixTraceOodService::new(self.graph.clone())
    }

    pub fn engine(&self) -> StorageEngine {
        let backend = self.canonical.backend();
        StorageEngine {
            events: self.events.clone(),
            entity_refs: self.graph.clone(),
            links: self.graph.clone(),
            embeddings: self.graph.clone(),
            schemas: backend.clone(),
            subscriptions: Some(backend),
        }
    }
}
