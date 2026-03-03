//! Connections View Types
//!
//! State and action types for the connections view.

use crate::types::{ConnectionDto, ScenarioDto};

/// Message to send to the main app
pub enum ConnectionAction {
    CreateConnection(String, String), // service, name
    DeleteConnection(String),
    GenerateEvents(String, usize), // connection_id, count
    LoadScenario(String),
    RefreshConnections,
    RefreshScenarios,
}

/// Connections management view
pub struct ConnectionsView {
    pub connections: Vec<ConnectionDto>,
    pub scenarios: Vec<ScenarioDto>,
    pub pending_actions: Vec<ConnectionAction>,
    // Form state
    pub(crate) new_service: String,
    pub(crate) new_name: String,
    pub(crate) generate_count: usize,
    pub(crate) show_new_connection_form: bool,
}

impl ConnectionsView {
    pub fn new() -> Self {
        Self {
            connections: Vec::new(),
            scenarios: Vec::new(),
            pending_actions: Vec::new(),
            new_service: "mock-zendesk".to_string(),
            new_name: String::new(),
            generate_count: 10,
            show_new_connection_form: false,
        }
    }

    pub fn set_connections(&mut self, connections: Vec<ConnectionDto>) {
        self.connections = connections;
    }

    pub fn set_scenarios(&mut self, scenarios: Vec<ScenarioDto>) {
        self.scenarios = scenarios;
    }

    pub fn take_actions(&mut self) -> Vec<ConnectionAction> {
        std::mem::take(&mut self.pending_actions)
    }
}

impl Default for ConnectionsView {
    fn default() -> Self {
        Self::new()
    }
}
