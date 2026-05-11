//! Timeline — wire shapes for the dashboard "Timeline" surface.
//!
//! The unit event type (`StreamTimelineEvent`) lives in
//! `domain::datasets` because it is also the row type of a curated
//! dataset's traces. This module models the **live observability**
//! surface that streams events as they arrive across all sources:
//!
//!   - `TimelineWindow`            — a paginated read response.
//!   - `TimelineSubscriptionEvent` — the SSE envelope a client
//!                                    consumes from `…/timeline/subscribe`.
//!
//! The frontend mock provider, the Next.js host route, and the
//! eventual Rust backend handler all return these exact shapes so
//! the data middleware can hot-swap modes without code changes.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::datasets::StreamTimelineEvent;

/* ── List response: a window of recent events ──────────────── */

/// A page of timeline events. The response carries the window
/// boundaries that produced it so clients can stitch successive
/// pages back together (and so the playhead anchor on first paint
/// uses the server's clock, not the browser's).
#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/timeline/")]
pub struct TimelineWindow {
    /// Events in the window, sorted ascending by `occurredAt`.
    pub events: Vec<StreamTimelineEvent>,
    /// Inclusive lower bound (ISO 8601). Omitted when the request
    /// did not pin a `from` and the server returned the most-recent
    /// `limit` events.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub from: Option<String>,
    /// Inclusive upper bound (ISO 8601). Defaults to "now" when the
    /// caller does not specify one.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub to: Option<String>,
    /// `true` if events older than `from` exist that the caller can
    /// page back to. Drives the timeline's "load older" affordance.
    pub has_more: bool,
    /// Total count if the backend can supply it cheaply, otherwise
    /// `None`. The dashboard does not require this; it's surfaced
    /// for diagnostics only.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub total_count: Option<u32>,
}

/* ── Subscription envelope ─────────────────────────────────── */

/// Live envelope pushed over SSE. Three variants cover every
/// transition the viewer's cache reducer needs to handle:
///
///   - `snapshot`  — the server replays the most-recent window.
///                   Used as the first frame after `(re)connect`
///                   and on resync after a backend pause.
///   - `appended`  — a single new event landed; cache prepends.
///   - `heartbeat` — keep-alive so the EventSource doesn't time
///                   out behind a load balancer.
#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(tag = "kind", rename_all = "camelCase")]
#[ts(export, export_to = "types/timeline/")]
pub enum TimelineSubscriptionEvent {
    #[serde(rename = "snapshot")]
    Snapshot {
        events: Vec<StreamTimelineEvent>,
        /// ISO timestamp marking the moment the snapshot was taken.
        #[serde(rename = "occurredAt")]
        occurred_at: String,
    },
    #[serde(rename = "appended")]
    Appended { event: StreamTimelineEvent },
    #[serde(rename = "heartbeat")]
    Heartbeat {
        #[serde(rename = "occurredAt")]
        occurred_at: String,
    },
}
