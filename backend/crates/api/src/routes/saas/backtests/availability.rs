//! `GET /api/platform/backtests/availability` — datasets, environments,
//! and agents the recipe picker can choose from.
//!
//! Phase 4.5 ships static fixtures (built from `dev_fixtures()` below).
//! Phase 5+ will replace with real catalog reads from
//! `chronicle_domain::datasets` + the agent registry.

use axum::{extract::State, Json};
use chronicle_auth::types::AuthUser;
use chronicle_domain::{
    AgentFramework, AgentModelDescriptor, AgentSummary, BacktestEnvironmentRef,
    BacktestsAvailability, Dataset, DatasetPurpose, DatasetSnapshot, StreamTimelineEvent,
    TraceStatus, TraceSummary,
};
use chrono::{Duration, Utc};
use std::collections::HashMap;

use crate::routes::saas::error::ApiResult;
use crate::saas_state::SaasAppState;

use super::routes::require_service;
use super::service::BacktestsAvailabilityData;

pub async fn get_availability(
    _user: AuthUser,
    State(state): State<SaasAppState>,
) -> ApiResult<Json<BacktestsAvailability>> {
    let service = require_service(&state)?;
    let data: &BacktestsAvailabilityData = &service.availability;

    Ok(Json(BacktestsAvailability {
        datasets: data.datasets.clone(),
        dataset_snapshots: data.dataset_snapshots.clone(),
        environments: data.environments.clone(),
        agents: data.agents.clone(),
    }))
}

/// Bundled dev fixtures the runtime seeds into memory-mode (and
/// Postgres mode until real catalog reads land). Keeps the dashboard
/// rendering against real-looking data while we iterate on the
/// runtime layer.
pub fn dev_fixtures() -> BacktestsAvailabilityData {
    let datasets = vec![
        Dataset {
            id: "ds_demo".to_string(),
            name: "Demo Dataset".to_string(),
            description: Some("Hand-curated smoke cases for local dev.".to_string()),
            purpose: Some(DatasetPurpose::Eval),
            trace_count: 24,
            event_count: Some(312),
            updated_at: Some(chrono::Utc::now()),
            created_by: Some("system".to_string()),
            tags: Some(vec!["smoke".to_string(), "dev".to_string()]),
        },
        Dataset {
            id: "ds_support".to_string(),
            name: "Support Replay".to_string(),
            description: Some("Real conversations replayed for regression testing.".to_string()),
            purpose: Some(DatasetPurpose::Replay),
            trace_count: 142,
            event_count: Some(1840),
            updated_at: Some(chrono::Utc::now() - chrono::Duration::days(2)),
            created_by: Some("system".to_string()),
            tags: Some(vec!["support".to_string()]),
        },
    ];

    let environments = vec![
        BacktestEnvironmentRef {
            id: "env_local_mock".to_string(),
            label: "Local mock sandbox".to_string(),
            snapshot_id: None,
            snapshot_label: None,
            status: Some("started".to_string()),
            ephemeral: Some(true),
        },
        BacktestEnvironmentRef {
            id: "env_daytona_dev".to_string(),
            label: "Daytona (dev)".to_string(),
            snapshot_id: Some("snap_dev_42".to_string()),
            snapshot_label: Some("ds_support".to_string()),
            status: Some("started".to_string()),
            ephemeral: Some(false),
        },
    ];

    let agents = vec![
        AgentSummary {
            name: "agent_v1".to_string(),
            description: Some("Baseline production agent.".to_string()),
            framework: AgentFramework::VercelAiSdk,
            latest_version: "1.0.0".to_string(),
            version_count: 3,
            total_runs: 142,
            success_rate: 0.91,
            last_run_at: Some(chrono::Utc::now() - chrono::Duration::hours(4)),
            last_drift_at: None,
            model_label: "gpt-4o".to_string(),
            model: AgentModelDescriptor {
                provider: Some("openai".to_string()),
                model_id: Some("gpt-4o".to_string()),
                label: "gpt-4o".to_string(),
            },
            owner: Some("platform".to_string()),
            environment: Some("env_daytona_dev".to_string()),
            purpose: Some("Baseline customer support agent.".to_string()),
            persona_summary: None,
            capability_tags: Some(vec!["support".to_string(), "baseline".to_string()]),
            category: Some("support".to_string()),
            playground_url: None,
            runbook_url: None,
        },
        AgentSummary {
            name: "agent_v2".to_string(),
            description: Some("Candidate agent with new prompt.".to_string()),
            framework: AgentFramework::VercelAiSdk,
            latest_version: "1.1.0-rc.2".to_string(),
            version_count: 1,
            total_runs: 18,
            success_rate: 0.94,
            last_run_at: Some(chrono::Utc::now() - chrono::Duration::minutes(30)),
            last_drift_at: None,
            model_label: "gpt-4o".to_string(),
            model: AgentModelDescriptor {
                provider: Some("openai".to_string()),
                model_id: Some("gpt-4o".to_string()),
                label: "gpt-4o".to_string(),
            },
            owner: Some("platform".to_string()),
            environment: Some("env_daytona_dev".to_string()),
            purpose: Some("Candidate agent with refined prompt.".to_string()),
            persona_summary: None,
            capability_tags: Some(vec!["support".to_string(), "candidate".to_string()]),
            category: Some("support".to_string()),
            playground_url: None,
            runbook_url: None,
        },
    ];

    BacktestsAvailabilityData {
        datasets,
        dataset_snapshots: dev_dataset_snapshots(),
        environments,
        agents,
    }
}

/// Hand-rolled dataset snapshots used for local dev / E2E
/// Phase 7 demos. The trace projector consumes these to derive cases
/// when a recipe says `data.kind = "dataset"` but the caller didn't
/// supply explicit `[[cases]]`.
fn dev_dataset_snapshots() -> HashMap<String, DatasetSnapshot> {
    let mut out = HashMap::new();
    out.insert(
        "ds_demo".to_string(),
        DatasetSnapshot {
            dataset: Dataset {
                id: "ds_demo".into(),
                name: "Demo Dataset".into(),
                description: Some("Hand-curated smoke cases for local dev.".into()),
                purpose: Some(DatasetPurpose::Eval),
                trace_count: 2,
                event_count: Some(6),
                updated_at: Some(Utc::now()),
                created_by: Some("system".into()),
                tags: Some(vec!["smoke".into(), "dev".into()]),
            },
            traces: vec![
                trace_summary("trc_password_reset", "Password reset"),
                trace_summary("trc_refund_request", "Refund request"),
            ],
            clusters: vec![],
            edges: vec![],
            events: Some(vec![
                // ── Trace 1: password reset ─────────────────────
                tev(
                    "ev1",
                    "trc_password_reset",
                    -300,
                    Some("customer"),
                    Some(
                        "I forgot my password. How do I reset it?",
                    ),
                    "support.message.inbound",
                ),
                tev(
                    "ev2",
                    "trc_password_reset",
                    -240,
                    Some("agent"),
                    Some(
                        "Visit https://app.example.com/reset and enter your account email — \
                         we'll send a one-time link.",
                    ),
                    "support.message.outbound",
                ),
                tev(
                    "ev3",
                    "trc_password_reset",
                    -180,
                    Some("system"),
                    Some("Conversation marked resolved."),
                    "support.conversation.resolved",
                ),
                // ── Trace 2: refund ────────────────────────────
                tev(
                    "ev4",
                    "trc_refund_request",
                    -120,
                    Some("customer"),
                    Some(
                        "I'd like a refund on order #12345 — the product arrived damaged.",
                    ),
                    "support.message.inbound",
                ),
                tev(
                    "ev5",
                    "trc_refund_request",
                    -90,
                    Some("agent"),
                    Some(
                        "I'm sorry to hear that. I've issued a full refund to your original \
                         payment method — it should land in 3-5 business days. Is there \
                         anything else I can help with?",
                    ),
                    "support.message.outbound",
                ),
                tev(
                    "ev6",
                    "trc_refund_request",
                    -60,
                    Some("system"),
                    Some("Refund of $42.50 issued via Stripe."),
                    "billing.refund.issued",
                ),
            ]),
        },
    );
    out
}

fn trace_summary(id: &str, label: &str) -> TraceSummary {
    TraceSummary {
        trace_id: id.into(),
        label: label.into(),
        primary_source: "support".into(),
        sources: vec!["support".into()],
        event_count: 3,
        started_at: Utc::now() - Duration::minutes(10),
        duration_ms: 240_000,
        status: TraceStatus::Ok,
        split: None,
        cluster_id: None,
        added_at: Some(Utc::now() - Duration::days(1)),
        added_by: Some("system".into()),
        note: None,
        embedding: None,
    }
}

fn tev(
    id: &str,
    trace_id: &str,
    seconds_ago: i64,
    actor: Option<&str>,
    message: Option<&str>,
    event_type: &str,
) -> StreamTimelineEvent {
    StreamTimelineEvent {
        id: id.into(),
        source: "support".into(),
        event_type: event_type.into(),
        occurred_at: Utc::now() + Duration::seconds(seconds_ago),
        actor: actor.map(str::to_string),
        message: message.map(str::to_string),
        payload: None,
        stream: None,
        color: None,
        trace_id: Some(trace_id.into()),
        parent_event_id: None,
        correlation_key: None,
        trace_label: None,
    }
}
