//! Application State
//!
//! Contains the shared state for the API server including backends and connections.

use dashmap::DashMap;
use parking_lot::RwLock;
use std::sync::Arc;

use chronicle_domain::{EventEnvelope, ReplayMode, ReplaySession, ReplayState, TenantId};
use chronicle_infra::{StoreBackend, StreamBackend};
use chronicle_mock_connector::MockOAuthConnection;

use crate::routes::sandbox::SandboxSessionSummary;
use crate::routes::GeneratorManager;

/// Sandbox session with metadata
pub struct SandboxSession {
    pub name: String,
    pub session: Arc<RwLock<ReplaySession>>,
}

/// Application state shared across all handlers
#[derive(Clone)]
pub struct AppState {
    /// Event stream backend
    pub stream: Arc<StreamBackend>,
    /// Event store backend
    pub store: Arc<StoreBackend>,
    /// Event stream for publishing (accessible for generators)
    pub event_stream: Arc<StreamBackend>,
    /// Active OAuth connections by connection_id
    pub connections: Arc<DashMap<String, MockOAuthConnection>>,
    /// Active replay sessions by session_id
    pub replay_sessions: Arc<DashMap<String, Arc<RwLock<ReplaySession>>>>,
    /// Active sandbox sessions by session_id (for AI agents)
    pub sandbox_sessions: Arc<DashMap<String, SandboxSession>>,
    /// Generator manager for mock sources
    generator_manager: Arc<GeneratorManager>,
    /// Default tenant for demo (in real system would come from auth)
    pub default_tenant: TenantId,
}

impl AppState {
    pub fn new(stream: StreamBackend, store: StoreBackend) -> Self {
        let stream_arc = Arc::new(stream);
        Self {
            stream: Arc::clone(&stream_arc),
            store: Arc::new(store),
            event_stream: stream_arc,
            connections: Arc::new(DashMap::new()),
            replay_sessions: Arc::new(DashMap::new()),
            sandbox_sessions: Arc::new(DashMap::new()),
            generator_manager: Arc::new(GeneratorManager::new()),
            default_tenant: TenantId::new("demo_tenant"),
        }
    }

    pub fn new_from_arcs(store: Arc<StoreBackend>, stream: Arc<StreamBackend>) -> Self {
        Self {
            stream: Arc::clone(&stream),
            store,
            event_stream: stream,
            connections: Arc::new(DashMap::new()),
            replay_sessions: Arc::new(DashMap::new()),
            sandbox_sessions: Arc::new(DashMap::new()),
            generator_manager: Arc::new(GeneratorManager::new()),
            default_tenant: TenantId::new("demo_tenant"),
        }
    }

    /// Get the generator manager
    pub fn generator_manager(&self) -> &GeneratorManager {
        &self.generator_manager
    }

    /// Add a connection
    pub fn add_connection(&self, connection: MockOAuthConnection) {
        self.connections
            .insert(connection.connection_id.clone(), connection);
    }

    /// Remove a connection
    pub fn remove_connection(&self, connection_id: &str) -> Option<MockOAuthConnection> {
        self.connections.remove(connection_id).map(|(_, v)| v)
    }

    /// Get a connection
    pub fn get_connection(&self, connection_id: &str) -> Option<MockOAuthConnection> {
        self.connections.get(connection_id).map(|v| v.clone())
    }

    /// List all connections
    pub fn list_connections(&self) -> Vec<MockOAuthConnection> {
        self.connections
            .iter()
            .map(|entry| entry.value().clone())
            .collect()
    }

    /// Create a replay session
    pub fn create_replay_session(
        &self,
        tenant_id: TenantId,
        subject_id: impl Into<chronicle_domain::SubjectId>,
        mode: ReplayMode,
    ) -> String {
        let session_id = chronicle_domain::new_session_id();
        let session = ReplaySession::new(session_id.clone(), tenant_id, subject_id.into(), mode);
        self.replay_sessions
            .insert(session_id.clone(), Arc::new(RwLock::new(session)));
        session_id
    }

    /// Get a replay session
    pub fn get_replay_session(&self, session_id: &str) -> Option<Arc<RwLock<ReplaySession>>> {
        self.replay_sessions.get(session_id).map(|v| v.clone())
    }

    /// Remove a replay session
    pub fn remove_replay_session(&self, session_id: &str) {
        self.replay_sessions.remove(session_id);
    }

    // === Sandbox Session Management (for AI agents) ===

    /// Create a sandbox session from pre-loaded events
    pub fn create_sandbox_session_from_events(
        &self,
        name: &str,
        events: Vec<EventEnvelope>,
    ) -> String {
        let session_id = format!("sandbox_{}", chronicle_domain::new_session_id());

        // Create replay session with realtime mode
        let mut replay_session = ReplaySession::new(
            session_id.clone(),
            self.default_tenant.clone(),
            chronicle_domain::SubjectId::new("sandbox"),
            ReplayMode::Realtime,
        );

        // Load events into the session
        replay_session.load_events(events);

        let sandbox = SandboxSession {
            name: name.to_string(),
            session: Arc::new(RwLock::new(replay_session)),
        };

        self.sandbox_sessions.insert(session_id.clone(), sandbox);
        session_id
    }

    /// Get a sandbox session
    pub fn get_sandbox_session(
        &self,
        session_id: &str,
    ) -> Option<(String, Arc<RwLock<ReplaySession>>)> {
        self.sandbox_sessions
            .get(session_id)
            .map(|v| (v.name.clone(), Arc::clone(&v.session)))
    }

    /// List all sandbox sessions
    pub fn list_sandbox_sessions(&self) -> Vec<SandboxSessionSummary> {
        self.sandbox_sessions
            .iter()
            .map(|entry| {
                let session = entry.value().session.read();
                SandboxSessionSummary {
                    session_id: entry.key().clone(),
                    name: entry.value().name.clone(),
                    event_count: session.state.total_events().unwrap_or(0),
                    state: if session.state.is_completed() {
                        "completed".to_string()
                    } else if matches!(session.state, ReplayState::Playing { .. }) {
                        "streaming".to_string()
                    } else {
                        "ready".to_string()
                    },
                    progress: session.progress(),
                }
            })
            .collect()
    }

    /// Remove a sandbox session
    pub fn remove_sandbox_session(&self, session_id: &str) {
        self.sandbox_sessions.remove(session_id);
    }
}
