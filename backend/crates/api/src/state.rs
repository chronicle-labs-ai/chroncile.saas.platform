//! Shared application state for the platform backend.

use dashmap::DashMap;
use std::sync::Arc;

use chronicle_domain::TenantId;
use chronicle_infra::{StoreBackend, StreamBackend};
use chronicle_link::LinkService;
use chronicle_mock_connector::MockOAuthConnection;
use chronicle_query::QueryService;

use crate::routes::GeneratorManager;
use crate::runtime_config::EventsRuntimeConfig;

#[derive(Clone)]
pub struct AppState {
    pub stream: Arc<StreamBackend>,
    pub store: Arc<StoreBackend>,
    pub event_stream: Arc<StreamBackend>,
    pub query: QueryService,
    pub link: LinkService,
    pub config: Arc<EventsRuntimeConfig>,
    pub connections: Arc<DashMap<String, MockOAuthConnection>>,
    generator_manager: Arc<GeneratorManager>,
    pub default_tenant: TenantId,
}

impl AppState {
    pub fn new(stream: StreamBackend, store: StoreBackend) -> Self {
        let stream = Arc::new(stream);
        let store = Arc::new(store);
        Self::new_from_arcs(store, stream)
    }

    pub fn new_from_arcs(store: Arc<StoreBackend>, stream: Arc<StreamBackend>) -> Self {
        Self::new_from_arcs_with_config(store, stream, EventsRuntimeConfig::default())
    }

    pub fn new_from_arcs_with_config(
        store: Arc<StoreBackend>,
        stream: Arc<StreamBackend>,
        config: EventsRuntimeConfig,
    ) -> Self {
        let query = store.query_service();
        let link = store.link_service();
        let default_tenant = TenantId::new(config.default_tenant_id.as_str());
        let config = Arc::new(config);

        Self {
            stream: Arc::clone(&stream),
            event_stream: stream,
            store,
            query,
            link,
            config,
            connections: Arc::new(DashMap::new()),
            generator_manager: Arc::new(GeneratorManager::new()),
            default_tenant,
        }
    }

    pub fn generator_manager(&self) -> &GeneratorManager {
        &self.generator_manager
    }

    pub fn add_connection(&self, connection: MockOAuthConnection) {
        self.connections
            .insert(connection.connection_id.clone(), connection);
    }

    pub fn remove_connection(&self, connection_id: &str) -> Option<MockOAuthConnection> {
        self.connections
            .remove(connection_id)
            .map(|(_, value)| value)
    }

    pub fn get_connection(&self, connection_id: &str) -> Option<MockOAuthConnection> {
        self.connections
            .get(connection_id)
            .map(|value| value.clone())
    }

    pub fn list_connections(&self) -> Vec<MockOAuthConnection> {
        self.connections
            .iter()
            .map(|entry| entry.value().clone())
            .collect()
    }
}
