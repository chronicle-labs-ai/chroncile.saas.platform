//! Project a `DatasetSnapshot` into `RecipeCase` records the
//! orchestrator can run as trials.
//!
//! Phase 7 — first pass:
//!
//! * Each trace becomes one case.
//! * `case_id` = trace.trace_id (stable across re-runs).
//! * `case_cluster` = trace label (or primary source as fallback) so
//!   the dashboard can group similar traces in `chronicle jobs show`.
//! * `instruction` = the first message-bearing event in the trace
//!   (typically the inbound user/customer message).
//! * `expected_outcome` = a JSON serialization of the rest of the
//!   trace's events. Rubric graders see this verbatim;
//!   trace-state-diff / tool-call-match graders (Phase 7.5) parse it
//!   to extract tool calls + final state.
//!
//! Failure modes are tolerant: a trace with no events or no
//! message-bearing event is skipped with a debug log rather than
//! failing the whole job — runs against partially-redacted datasets
//! still produce something useful.

use chronicle_domain::{DatasetSnapshot, StreamTimelineEvent, TraceSummary};
use serde::Serialize;

use super::recipe_builder::RecipeCase;

/// Convert a `DatasetSnapshot` into one `RecipeCase` per trace.
///
/// Returns `(cases, skipped_trace_ids)` so the caller can surface a
/// warning if many traces were unusable.
pub fn derive_cases_from_snapshot(
    snapshot: &DatasetSnapshot,
) -> (Vec<RecipeCase>, Vec<SkippedTrace>) {
    let events = snapshot.events.as_deref().unwrap_or(&[]);
    let mut cases = Vec::with_capacity(snapshot.traces.len());
    let mut skipped = Vec::new();

    for trace in &snapshot.traces {
        match project_trace(trace, events) {
            Ok(case) => cases.push(case),
            Err(reason) => skipped.push(SkippedTrace {
                trace_id: trace.trace_id.clone(),
                reason,
            }),
        }
    }

    (cases, skipped)
}

#[derive(Debug, Clone)]
pub struct SkippedTrace {
    pub trace_id: String,
    pub reason: String,
}

/// Internal: project a single trace into a `RecipeCase`. Returns an
/// `Err` when the trace can't be turned into a sensible case (no
/// events, no instruction-bearing event, etc.).
fn project_trace(
    trace: &TraceSummary,
    all_events: &[StreamTimelineEvent],
) -> Result<RecipeCase, String> {
    let mut events: Vec<&StreamTimelineEvent> = all_events
        .iter()
        .filter(|e| e.trace_id.as_deref() == Some(trace.trace_id.as_str()))
        .collect();
    if events.is_empty() {
        return Err("trace has no events in snapshot".to_string());
    }

    events.sort_by_key(|e| e.occurred_at);

    // Pick the first event that has a non-empty message body. Fall
    // back to the earliest event's `event_type` framed as a synthetic
    // instruction if no message field exists.
    let (instruction, instruction_idx) = events
        .iter()
        .enumerate()
        .find_map(|(idx, e)| {
            e.message
                .as_deref()
                .filter(|m| !m.trim().is_empty())
                .map(|m| (m.to_string(), idx))
        })
        .unwrap_or_else(|| {
            // Fallback synthetic instruction. Useful for traces with
            // structured payloads but no human-readable message
            // (e.g. webhook events without a `text` field).
            (
                format!(
                    "Replay this trace ({label}). Initial event: {kind}.",
                    label = trace.label,
                    kind = events[0].event_type,
                ),
                0,
            )
        });

    // The "gold trace" the grader sees is everything AFTER the
    // instruction event — i.e. how the original agent responded.
    // We strip a few fields the grader doesn't need (color, embedding
    // hints) to keep prompt size bounded.
    let gold_events: Vec<GoldEvent> = events
        .iter()
        .skip(instruction_idx + 1)
        .map(|e| GoldEvent::from(*e))
        .collect();
    let expected_outcome = if gold_events.is_empty() {
        None
    } else {
        Some(serde_json::to_string(&GoldTrace {
            trace_id: &trace.trace_id,
            label: &trace.label,
            primary_source: &trace.primary_source,
            events: &gold_events,
        })
        .map_err(|e| format!("serialize gold trace: {e}"))?)
    };

    let cluster = if !trace.label.is_empty() {
        Some(trace.label.clone())
    } else {
        Some(trace.primary_source.clone())
    };

    Ok(RecipeCase {
        case_id: trace.trace_id.clone(),
        case_cluster: cluster,
        instruction,
        expected_outcome,
        agent_trial_ids: Default::default(),
    })
}

/// Compact projection of a `StreamTimelineEvent` for grader
/// consumption. We keep just the fields a judge needs to score the
/// agent's behaviour against — type, source, message, payload — and
/// drop UI-only metadata (color, embedding, stream).
#[derive(Debug, Clone, Serialize)]
struct GoldEvent {
    #[serde(rename = "type")]
    event_type: String,
    source: String,
    occurred_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    actor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    payload: Option<serde_json::Value>,
}

impl From<&StreamTimelineEvent> for GoldEvent {
    fn from(e: &StreamTimelineEvent) -> Self {
        Self {
            event_type: e.event_type.clone(),
            source: e.source.clone(),
            occurred_at: e.occurred_at.to_rfc3339(),
            actor: e.actor.clone(),
            message: e.message.clone(),
            payload: e.payload.clone(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
struct GoldTrace<'a> {
    trace_id: &'a str,
    label: &'a str,
    primary_source: &'a str,
    events: &'a [GoldEvent],
}

#[cfg(test)]
mod tests {
    use super::*;
    use chronicle_domain::{Dataset, TraceStatus};
    use chrono::{TimeZone, Utc};

    fn ev(
        id: &str,
        trace: &str,
        secs: i64,
        message: Option<&str>,
        kind: &str,
    ) -> StreamTimelineEvent {
        StreamTimelineEvent {
            id: id.into(),
            source: "test".into(),
            event_type: kind.into(),
            occurred_at: Utc.timestamp_opt(secs, 0).unwrap(),
            actor: None,
            message: message.map(str::to_string),
            payload: None,
            stream: None,
            color: None,
            trace_id: Some(trace.into()),
            parent_event_id: None,
            correlation_key: None,
            trace_label: None,
        }
    }

    fn trace(id: &str, label: &str) -> TraceSummary {
        TraceSummary {
            trace_id: id.into(),
            label: label.into(),
            primary_source: "test".into(),
            sources: vec!["test".into()],
            event_count: 0,
            started_at: Utc.timestamp_opt(0, 0).unwrap(),
            duration_ms: 0,
            status: TraceStatus::Ok,
            split: None,
            cluster_id: None,
            added_at: None,
            added_by: None,
            note: None,
            embedding: None,
        }
    }

    fn snapshot(traces: Vec<TraceSummary>, events: Vec<StreamTimelineEvent>) -> DatasetSnapshot {
        DatasetSnapshot {
            dataset: Dataset {
                id: "ds".into(),
                name: "ds".into(),
                description: None,
                purpose: None,
                tags: None,
                trace_count: traces.len() as u32,
                event_count: Some(events.len() as u32),
                updated_at: Some(Utc.timestamp_opt(0, 0).unwrap()),
                created_by: None,
            },
            traces,
            clusters: vec![],
            edges: vec![],
            events: Some(events),
        }
    }

    #[test]
    fn projects_one_case_per_trace() {
        let s = snapshot(
            vec![trace("t1", "Onboarding"), trace("t2", "Refund")],
            vec![
                ev("e1", "t1", 100, Some("Hello, I'd like to sign up"), "msg.in"),
                ev("e2", "t1", 110, Some("Sure, here's how"), "msg.out"),
                ev("e3", "t2", 200, Some("Need a refund please"), "msg.in"),
                ev("e4", "t2", 210, Some("Refund issued"), "msg.out"),
            ],
        );
        let (cases, skipped) = derive_cases_from_snapshot(&s);
        assert_eq!(cases.len(), 2);
        assert!(skipped.is_empty());
        assert_eq!(cases[0].case_id, "t1");
        assert_eq!(cases[0].instruction, "Hello, I'd like to sign up");
        assert!(cases[0].expected_outcome.as_ref().unwrap().contains("Sure, here's how"));
        assert_eq!(cases[0].case_cluster.as_deref(), Some("Onboarding"));
    }

    #[test]
    fn skips_traces_with_no_events() {
        let s = snapshot(vec![trace("t1", "ghost")], vec![]);
        let (cases, skipped) = derive_cases_from_snapshot(&s);
        assert!(cases.is_empty());
        assert_eq!(skipped.len(), 1);
        assert_eq!(skipped[0].trace_id, "t1");
    }

    #[test]
    fn falls_back_to_synthetic_instruction_when_no_message() {
        let s = snapshot(
            vec![trace("t1", "")],
            vec![ev("e1", "t1", 100, None, "webhook.received")],
        );
        let (cases, _skipped) = derive_cases_from_snapshot(&s);
        assert_eq!(cases.len(), 1);
        assert!(cases[0].instruction.contains("webhook.received"));
        // No subsequent events → no expected_outcome.
        assert!(cases[0].expected_outcome.is_none());
    }

    #[test]
    fn instruction_is_first_message_chronologically() {
        // Out-of-order events get sorted by `occurred_at` first.
        let s = snapshot(
            vec![trace("t1", "")],
            vec![
                ev("late", "t1", 200, Some("later"), "msg"),
                ev("early", "t1", 100, Some("first"), "msg"),
            ],
        );
        let (cases, _skipped) = derive_cases_from_snapshot(&s);
        assert_eq!(cases[0].instruction, "first");
        assert!(cases[0].expected_outcome.as_ref().unwrap().contains("later"));
    }
}
