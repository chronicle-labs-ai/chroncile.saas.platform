//! Replay Endpoints

use std::convert::Infallible;
use std::time::Duration;

use axum::{
    extract::{Path, State},
    response::sse::{Event, KeepAlive, Sse},
    Json,
};
use futures::stream::Stream;
use serde::{Deserialize, Serialize};

use chronicle_domain::{sort_for_replay, ReplayMode, SubjectId, TenantId};

use crate::{routes::stream::EventEnvelopeDto, ApiError, ApiResult, AppState};

#[derive(Debug, Deserialize)]
pub struct CreateReplayRequest {
    /// Conversation ID to replay
    pub conversation_id: String,
    /// Replay mode: "instant", "realtime", "accelerated", "step"
    #[serde(default = "default_mode")]
    pub mode: String,
    /// Speed multiplier for accelerated mode (e.g., 10.0)
    pub speed: Option<f32>,
    /// Tenant ID (required for multi-tenancy)
    pub tenant_id: Option<String>,
}

fn default_mode() -> String {
    "instant".to_string()
}

#[derive(Debug, Serialize)]
pub struct ReplayResponse {
    pub session_id: String,
    pub conversation_id: String,
    pub mode: String,
    pub event_count: usize,
    pub stream_url: String,
}

#[derive(Debug, Serialize)]
pub struct ReplayStatusResponse {
    pub session_id: String,
    pub state: String,
    pub progress: f32,
    pub current_index: Option<usize>,
    pub total_events: Option<usize>,
}

#[derive(Debug, Deserialize)]
pub struct ReplayControlRequest {
    /// Action: "start", "pause", "resume"
    pub action: String,
}

#[derive(Debug, Serialize)]
pub struct ReplayControlResponse {
    pub session_id: String,
    pub action: String,
    pub success: bool,
    pub state: String,
}

#[derive(Debug, Serialize)]
pub struct StepResponse {
    pub session_id: String,
    pub event: Option<EventEnvelopeDto>,
    pub has_more: bool,
    pub progress: f32,
}

/// Create a new replay session
pub async fn create_replay(
    State(state): State<AppState>,
    Json(req): Json<CreateReplayRequest>,
) -> ApiResult<Json<ReplayResponse>> {
    let tenant_id = req
        .tenant_id
        .map(TenantId::new)
        .unwrap_or_else(|| state.default_tenant.clone());

    // Parse mode
    let mode = match req.mode.as_str() {
        "instant" => ReplayMode::Instant,
        "realtime" => ReplayMode::Realtime,
        "accelerated" => ReplayMode::Accelerated {
            speed: req.speed.unwrap_or(10.0),
        },
        "step" => ReplayMode::Step,
        _ => return Err(ApiError::BadRequest(format!("Invalid mode: {}", req.mode))),
    };

    // Create session
    let session_id =
        state.create_replay_session(tenant_id.clone(), req.conversation_id.clone(), mode.clone());

    // Load events into the session
    let events = state
        .store
        .fetch_by_conversation(&tenant_id, &SubjectId::new(req.conversation_id.clone()))
        .await?;

    let sorted = sort_for_replay(events);
    let event_count = sorted.len();

    // Update session with events
    if let Some(session_arc) = state.get_replay_session(&session_id) {
        let mut session = session_arc.write();
        session.load_events(sorted);
    }

    let mode_str = match mode {
        ReplayMode::Instant => "instant",
        ReplayMode::Realtime => "realtime",
        ReplayMode::Accelerated { .. } => "accelerated",
        ReplayMode::Step => "step",
    };

    Ok(Json(ReplayResponse {
        session_id: session_id.clone(),
        conversation_id: req.conversation_id,
        mode: mode_str.to_string(),
        event_count,
        stream_url: format!("/api/replay/{}/stream", session_id),
    }))
}

/// Get replay session status
pub async fn get_replay_status(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
) -> ApiResult<Json<ReplayStatusResponse>> {
    let session_arc = state
        .get_replay_session(&session_id)
        .ok_or_else(|| ApiError::NotFound(format!("Replay session {} not found", session_id)))?;

    let session = session_arc.read();

    Ok(Json(ReplayStatusResponse {
        session_id,
        state: session.state.name().to_string(),
        progress: session.progress(),
        current_index: session.state.current_index(),
        total_events: session.state.total_events(),
    }))
}

/// Control replay (start/pause)
pub async fn control_replay(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    Json(req): Json<ReplayControlRequest>,
) -> ApiResult<Json<ReplayControlResponse>> {
    let session_arc = state
        .get_replay_session(&session_id)
        .ok_or_else(|| ApiError::NotFound(format!("Replay session {} not found", session_id)))?;

    let mut session = session_arc.write();

    let success = match req.action.as_str() {
        "start" | "resume" => session.start(),
        "pause" => session.pause(),
        _ => {
            return Err(ApiError::BadRequest(format!(
                "Invalid action: {}",
                req.action
            )))
        }
    };

    Ok(Json(ReplayControlResponse {
        session_id,
        action: req.action,
        success,
        state: session.state.name().to_string(),
    }))
}

/// Step forward one event (for step mode)
pub async fn step_replay(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
) -> ApiResult<Json<StepResponse>> {
    let session_arc = state
        .get_replay_session(&session_id)
        .ok_or_else(|| ApiError::NotFound(format!("Replay session {} not found", session_id)))?;

    let mut session = session_arc.write();

    let event = session.step();
    let has_more = !session.state.is_completed();
    let progress = session.progress();

    Ok(Json(StepResponse {
        session_id,
        event: event.map(EventEnvelopeDto::from),
        has_more,
        progress,
    }))
}

/// Stream replay via SSE
pub async fn stream_replay(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
) -> ApiResult<Sse<impl Stream<Item = Result<Event, Infallible>> + Send>> {
    let session_arc = state
        .get_replay_session(&session_id)
        .ok_or_else(|| ApiError::NotFound(format!("Replay session {} not found", session_id)))?;

    // Start the session
    {
        let mut session = session_arc.write();
        session.start();
    }

    // Use a tokio Mutex instead to allow Send across await points
    let session_mutex = std::sync::Arc::new(tokio::sync::Mutex::new(session_arc));

    let stream = async_stream::stream! {
        loop {
            // Check state - acquire and release lock before any await
            let check_result = {
                let session_arc = session_mutex.lock().await;
                let session = session_arc.read();
                if session.state.is_completed() {
                    Some(("complete", "Replay complete"))
                } else if session.state.is_failed() {
                    Some(("error", "Replay failed"))
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
