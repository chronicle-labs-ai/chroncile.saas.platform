//! AI Agent Sandbox Endpoints
//!
//! Provides endpoints for AI agents to create isolated sandbox sessions from MCAP recordings.
//! Agents can upload recordings and subscribe to SSE streams that replay events respecting
//! original timing, enabling testing and evaluation in a controlled environment.

use std::convert::Infallible;
use std::time::Duration;

use axum::{
    extract::{Multipart, Path, State},
    response::sse::{Event, KeepAlive, Sse},
    Json,
};
use futures::stream::Stream;
use serde::{Deserialize, Serialize};

use chronicle_domain::recording::BagPlayer;
use chronicle_domain::ReplayState;

use crate::routes::stream::EventEnvelopeDto;
use crate::{ApiError, ApiResult, AppState};

/// Request to create a sandbox session (name comes from multipart form)
#[derive(Debug, Deserialize, Default)]
pub struct CreateSandboxRequest {
    /// Optional session name
    #[serde(default)]
    pub name: Option<String>,
}

/// Response after creating a sandbox session
#[derive(Debug, Serialize)]
pub struct CreateSandboxResponse {
    /// Unique session identifier
    pub session_id: String,
    /// Session name (defaults to filename or "Sandbox Session")
    pub name: String,
    /// Number of events in the recording
    pub event_count: usize,
    /// Duration of the recording in seconds
    pub duration_secs: Option<i64>,
    /// URL to subscribe to the event stream
    pub stream_url: String,
}

/// Response for session status
#[derive(Debug, Serialize)]
pub struct SandboxStatusResponse {
    /// Session identifier
    pub session_id: String,
    /// Session name
    pub name: String,
    /// Current state: "ready", "streaming", "completed"
    pub state: String,
    /// Progress from 0.0 to 1.0
    pub progress: f32,
    /// Number of events delivered so far
    pub events_delivered: usize,
    /// Total number of events
    pub total_events: usize,
}

/// List of active sandbox sessions
#[derive(Debug, Serialize)]
pub struct ListSandboxResponse {
    /// Active sessions
    pub sessions: Vec<SandboxSessionSummary>,
}

/// Summary of a sandbox session
#[derive(Debug, Serialize)]
pub struct SandboxSessionSummary {
    pub session_id: String,
    pub name: String,
    pub event_count: usize,
    pub state: String,
    pub progress: f32,
}

/// Create a sandbox session from an MCAP file upload
///
/// Accepts multipart/form-data with:
/// - `file`: The MCAP recording file (required)
/// - `name`: Optional session name (defaults to filename)
pub async fn create_sandbox_session(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> ApiResult<Json<CreateSandboxResponse>> {
    let mut mcap_data: Option<Vec<u8>> = None;
    let mut session_name: Option<String> = None;
    let mut filename: Option<String> = None;

    // Process multipart fields
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| ApiError::BadRequest(format!("Failed to read multipart field: {}", e)))?
    {
        let field_name = field.name().unwrap_or_default().to_string();

        match field_name.as_str() {
            "file" => {
                filename = field.file_name().map(String::from);
                mcap_data = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|e| ApiError::BadRequest(format!("Failed to read file: {}", e)))?
                        .to_vec(),
                );
            }
            "name" => {
                session_name = Some(
                    field
                        .text()
                        .await
                        .map_err(|e| ApiError::BadRequest(format!("Failed to read name: {}", e)))?,
                );
            }
            _ => {
                // Ignore unknown fields
            }
        }
    }

    // Validate we have the file
    let mcap_data = mcap_data.ok_or_else(|| ApiError::BadRequest("Missing 'file' field".to_string()))?;

    // Parse the MCAP file
    let player = BagPlayer::from_bytes(&mcap_data)
        .map_err(|e| ApiError::BadRequest(format!("Failed to parse MCAP file: {}", e)))?;

    let metadata = player.metadata().clone();
    let events = player.into_all_events();

    // Determine session name
    let name = session_name
        .or(filename)
        .unwrap_or_else(|| "Sandbox Session".to_string());

    // Create the sandbox session
    let session_id = state.create_sandbox_session_from_events(&name, events);

    let duration_secs = metadata.duration.map(|d| d.num_seconds());

    Ok(Json(CreateSandboxResponse {
        session_id: session_id.clone(),
        name,
        event_count: metadata.event_count,
        duration_secs,
        stream_url: format!("/api/sandbox/sessions/{}/stream", session_id),
    }))
}

/// Get sandbox session status
pub async fn get_sandbox_status(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
) -> ApiResult<Json<SandboxStatusResponse>> {
    let (name, session_arc) = state
        .get_sandbox_session(&session_id)
        .ok_or_else(|| ApiError::NotFound(format!("Sandbox session {} not found", session_id)))?;

    let session = session_arc.read();

    let state_name = if session.state.is_completed() {
        "completed"
    } else if matches!(session.state, ReplayState::Playing { .. }) {
        "streaming"
    } else {
        "ready"
    };

    Ok(Json(SandboxStatusResponse {
        session_id,
        name,
        state: state_name.to_string(),
        progress: session.progress(),
        events_delivered: session.state.current_index().unwrap_or(0),
        total_events: session.state.total_events().unwrap_or(0),
    }))
}

/// List all active sandbox sessions
pub async fn list_sandbox_sessions(
    State(state): State<AppState>,
) -> ApiResult<Json<ListSandboxResponse>> {
    let sessions = state.list_sandbox_sessions();
    Ok(Json(ListSandboxResponse { sessions }))
}

/// Delete a sandbox session
pub async fn delete_sandbox_session(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    state.remove_sandbox_session(&session_id);
    Ok(Json(serde_json::json!({
        "session_id": session_id,
        "deleted": true
    })))
}

/// Stream sandbox events via SSE
///
/// Events are streamed respecting their original timing (realtime mode).
/// The stream sends:
/// - `event: event` - For each event with JSON data
/// - `event: complete` - When replay is finished
pub async fn stream_sandbox(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
) -> ApiResult<Sse<impl Stream<Item = Result<Event, Infallible>> + Send>> {
    let (_, session_arc) = state
        .get_sandbox_session(&session_id)
        .ok_or_else(|| ApiError::NotFound(format!("Sandbox session {} not found", session_id)))?;

    // Start the session
    {
        let mut session = session_arc.write();
        session.start();
    }

    // Use tokio Mutex for async-safe access
    let session_mutex = std::sync::Arc::new(tokio::sync::Mutex::new(session_arc));

    let stream = async_stream::stream! {
        // Send initial connected event
        yield Ok(Event::default().event("connected").data(format!(r#"{{"session_id":"{}"}}"#, session_id)));

        loop {
            // Check state
            let check_result = {
                let session_arc = session_mutex.lock().await;
                let session = session_arc.read();
                if session.state.is_completed() {
                    Some(("complete", "Replay complete".to_string()))
                } else if session.state.is_failed() {
                    Some(("error", "Replay failed".to_string()))
                } else {
                    None
                }
            };

            if let Some((event_type, msg)) = check_result {
                yield Ok(Event::default().event(event_type).data(msg));
                break;
            }

            // Check timing
            let (should_emit, wait_duration) = {
                let session_arc = session_mutex.lock().await;
                let session = session_arc.read();
                (session.is_ready_to_emit(), session.time_until_next())
            };

            if !should_emit {
                if let Some(duration) = wait_duration {
                    if duration > Duration::ZERO {
                        // Sleep but cap at 100ms to stay responsive
                        tokio::time::sleep(duration.min(Duration::from_millis(100))).await;
                        continue;
                    }
                }
            }

            // Advance and emit
            let event = {
                let session_arc = session_mutex.lock().await;
                let mut session = session_arc.write();
                session.advance()
            };

            match event {
                Some(e) => {
                    let dto = EventEnvelopeDto::from(e);
                    if let Ok(data) = serde_json::to_string(&dto) {
                        yield Ok(Event::default().event("event").data(data));
                    }
                }
                None => {
                    // Check if completed
                    let is_completed = {
                        let session_arc = session_mutex.lock().await;
                        let session = session_arc.read();
                        session.state.is_completed()
                    };
                    if is_completed {
                        yield Ok(Event::default().event("complete").data("Replay complete"));
                        break;
                    }
                }
            }
        }
    };

    Ok(Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("ping"),
    ))
}

