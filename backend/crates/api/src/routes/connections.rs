//! Connection Management Endpoints

use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};

use chronicle_mock_connector::{
    all_scenarios, ConnectionResponse, MockEventGenerator,
    MockOAuthConnection, MockService,
};

use crate::{ApiError, ApiResult, AppState};

#[derive(Debug, Deserialize)]
pub struct CreateConnectionRequest {
    pub service: String,
    pub name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ConnectionListResponse {
    pub connections: Vec<ConnectionResponse>,
}

#[derive(Debug, Serialize)]
pub struct ScenarioInfo {
    pub name: String,
    pub description: String,
    pub event_count: usize,
}

#[derive(Debug, Serialize)]
pub struct ScenariosResponse {
    pub scenarios: Vec<ScenarioInfo>,
}

#[derive(Debug, Serialize)]
pub struct GenerateEventsResponse {
    pub generated: usize,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct GenerateEventsRequest {
    #[serde(default = "default_count")]
    pub count: usize,
}

fn default_count() -> usize {
    10
}

/// List all connections
pub async fn list_connections(State(state): State<AppState>) -> Json<ConnectionListResponse> {
    let connections = state
        .list_connections()
        .into_iter()
        .map(ConnectionResponse::from)
        .collect();

    Json(ConnectionListResponse { connections })
}

/// Create a new connection
pub async fn create_connection(
    State(state): State<AppState>,
    Json(req): Json<CreateConnectionRequest>,
) -> ApiResult<Json<ConnectionResponse>> {
    let service = match req.service.as_str() {
        "mock-zendesk" | "zendesk" => MockService::MockZendesk,
        "mock-slack" | "slack" => MockService::MockSlack,
        "mock-intercom" | "intercom" => MockService::MockIntercom,
        other => MockService::Custom(other.to_string()),
    };

    let mut connection = MockOAuthConnection::new(state.default_tenant.clone(), service);

    if let Some(name) = req.name {
        connection = connection.with_name(name);
    }

    let response = ConnectionResponse::from(connection.clone());
    state.add_connection(connection);

    Ok(Json(response))
}

/// Get a specific connection
pub async fn get_connection(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<ConnectionResponse>> {
    let connection = state
        .get_connection(&id)
        .ok_or_else(|| ApiError::NotFound(format!("Connection {} not found", id)))?;

    Ok(Json(ConnectionResponse::from(connection)))
}

/// Delete a connection
pub async fn delete_connection(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    state
        .remove_connection(&id)
        .ok_or_else(|| ApiError::NotFound(format!("Connection {} not found", id)))?;

    Ok(Json(serde_json::json!({
        "deleted": true,
        "connection_id": id
    })))
}

/// Generate random events from a connection
pub async fn generate_events(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<GenerateEventsRequest>,
) -> ApiResult<Json<GenerateEventsResponse>> {
    let connection = state
        .get_connection(&id)
        .ok_or_else(|| ApiError::NotFound(format!("Connection {} not found", id)))?;

    let mut generator = MockEventGenerator::new(connection);
    let count = req.count.min(100); // Cap at 100

    // Generate a mix of events
    let conversations = ["conv_demo_1", "conv_demo_2", "conv_demo_3"];
    let mut generated = 0;

    for i in 0..count {
        let conv = conversations[i % conversations.len()];
        let event = if i % 3 == 0 {
            generator.customer_message(conv, "cust_demo", &format!("Test message {}", i))
        } else if i % 3 == 1 {
            generator.agent_message(conv, "agent_demo", "Demo Agent", &format!("Response {}", i))
        } else {
            generator.internal_note(conv, "agent_demo", &format!("Note {}", i))
        };

        state.stream.publish(event.clone()).await?;
        state.store.append(&[event]).await?;
        generated += 1;
    }

    Ok(Json(GenerateEventsResponse {
        generated,
        message: format!("Generated {} events across {} conversations", generated, conversations.len()),
    }))
}

/// List available scenarios
pub async fn list_scenarios(State(state): State<AppState>) -> Json<ScenariosResponse> {
    let scenarios = all_scenarios(state.default_tenant.as_str())
        .into_iter()
        .map(|s| ScenarioInfo {
            name: s.name,
            description: s.description,
            event_count: s.events.len(),
        })
        .collect();

    Json(ScenariosResponse { scenarios })
}

/// Load a scenario (generate its events)
pub async fn load_scenario(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> ApiResult<Json<GenerateEventsResponse>> {
    let scenarios = all_scenarios(state.default_tenant.as_str());

    let scenario = scenarios
        .into_iter()
        .find(|s| s.name.to_lowercase().replace(' ', "_") == name.to_lowercase())
        .or_else(|| {
            // Try fuzzy match
            all_scenarios(state.default_tenant.as_str())
                .into_iter()
                .find(|s| s.name.to_lowercase().contains(&name.to_lowercase()))
        })
        .ok_or_else(|| ApiError::NotFound(format!("Scenario '{}' not found", name)))?;

    let event_count = scenario.events.len();

    for event in scenario.events {
        state.stream.publish(event.clone()).await?;
        state.store.append(&[event]).await?;
    }

    Ok(Json(GenerateEventsResponse {
        generated: event_count,
        message: format!("Loaded scenario '{}' with {} events", scenario.name, event_count),
    }))
}
