//! SSE handler for `GET /api/platform/backtests/jobs/:id/stream`.
//!
//! Subscribes to the per-job broadcast channel held by
//! `BacktestService` and re-emits every `TrialEvent` as an SSE event.
//!
//! When the job has already finished (entry GC'd) we close the stream
//! immediately. Phase 3.5 will replay the persisted history before
//! closing so reconnect-mid-job clients catch up.

use async_stream::stream;
use axum::{
    extract::{Path, State},
    response::sse::{Event, KeepAlive, Sse},
};
use chronicle_auth::types::AuthUser;
use chronicle_domain::TrialEvent;
use futures::Stream;
use std::convert::Infallible;
use std::time::Duration;
use tokio::sync::broadcast::error::RecvError;

use crate::routes::saas::error::{ApiError, ApiResult};
use crate::saas_state::SaasAppState;

use super::routes::require_service;

pub async fn stream_job_events(
    user: AuthUser,
    State(state): State<SaasAppState>,
    Path(job_id): Path<String>,
) -> ApiResult<Sse<impl Stream<Item = Result<Event, Infallible>>>> {
    let service = require_service(&state)?;

    // Tenant-scope check before subscribing.
    let record = service
        .jobs_repo
        .find_by_id(&job_id)
        .await?
        .ok_or_else(|| ApiError::not_found("Backtest job"))?;
    if record.tenant_id != user.tenant_id {
        return Err(ApiError::not_found("Backtest job"));
    }

    let receiver = service.subscribe(&job_id);

    // Build a stream regardless of whether the job is still active —
    // an empty stream + immediate `done` event is the right behavior
    // for jobs that finished before the client connected.
    let stream = stream! {
        // Initial kickoff event so EventSource's `onopen` fires reliably.
        yield Ok::<_, Infallible>(
            Event::default()
                .event("ready")
                .data(serde_json::json!({ "jobId": job_id }).to_string())
        );

        let Some(mut rx) = receiver else {
            // Active entry already GC'd. Emit a `done` and close.
            yield Ok(Event::default()
                .event("done")
                .data(serde_json::json!({
                    "jobId": job_id,
                    "reason": "job-already-finished",
                }).to_string()));
            return;
        };

        loop {
            match rx.recv().await {
                Ok(event) => {
                    let payload = match serde_json::to_string(&event) {
                        Ok(s) => s,
                        Err(e) => {
                            tracing::warn!(
                                job_id = %job_id,
                                error = %e,
                                "failed to serialize TrialEvent for SSE"
                            );
                            continue;
                        }
                    };
                    let event_type = trial_event_kind(&event);
                    yield Ok(Event::default().event(event_type).data(payload));

                    // Close the stream after the terminal job event so
                    // EventSource clients tear down cleanly.
                    if matches!(event, TrialEvent::JobFinished { .. }) {
                        break;
                    }
                }
                // The job's broadcast was dropped — the run task is
                // gone (orchestrator finished or was cancelled).
                Err(RecvError::Closed) => break,
                // Slow consumer — log and keep going. Authoritative
                // state lives in the DB, so a few skipped events
                // aren't fatal for correctness.
                Err(RecvError::Lagged(n)) => {
                    tracing::warn!(
                        job_id = %job_id,
                        skipped = n,
                        "SSE consumer lagged; events dropped"
                    );
                }
            }
        }

        yield Ok(Event::default()
            .event("done")
            .data(serde_json::json!({ "jobId": job_id }).to_string()));
    };

    Ok(Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("keep-alive"),
    ))
}

/// SSE `event:` field — a kebab-case label so frontend handlers can
/// `addEventListener("trial-finished", …)` instead of branching on the
/// JSON `kind` field.
fn trial_event_kind(event: &TrialEvent) -> &'static str {
    match event {
        TrialEvent::JobStarted { .. } => "job-started",
        TrialEvent::TrialPhaseChanged { .. } => "trial-phase-changed",
        TrialEvent::TrialRewardsRecorded { .. } => "trial-rewards-recorded",
        TrialEvent::TrialFinished { .. } => "trial-finished",
        TrialEvent::JobFinished { .. } => "job-finished",
    }
}
