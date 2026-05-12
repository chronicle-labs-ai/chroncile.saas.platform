//! Connections — wire shapes for the dashboard "Connections" surface.
//!
//! Distinct from `domain::saas::ConnectionRecord` (the persistence
//! row holding OAuth tokens etc.). This module models the dashboard
//! projection: per-tenant runtime state — health, recent event
//! counts, scopes, backfill history, deliveries, event-type
//! subscriptions.
//!
//! Source of truth for the original TS shapes:
//! `packages/ui/src/connections/data.ts`. After the rename, `ui`
//! re-exports these types from `chronicle/types/connections`.

use chrono::{DateTime, Utc};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/* ── Health + status enums ─────────────────────────────── */

/// Operational state of a live connection. Drives the
/// `ConnectionHealthBadge` colour, the row's right-side hint, and
/// whether the action menu shows "Reauth" / "Retry" / "Resume".
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/connections/")]
pub enum ConnectionHealth {
    Live,
    Paused,
    Error,
    Expired,
    Testing,
    Disconnected,
}

/// Outcome of the last `Test connection` run. `Pending` means the
/// test is in flight; the row's button stays in a wait state.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/connections/")]
pub enum ConnectionTestStatus {
    Ok,
    Fail,
    Pending,
}

/// Classifies a `health == "error"` failure for the connector
/// state-error modal. Mirrors the TS `ConnectorErrorKind` union.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "kebab-case")]
#[ts(export, export_to = "types/connections/")]
pub enum ConnectorErrorKind {
    Auth,
    Signature,
    RateLimit,
    Unknown,
}

/* ── Connection (dashboard projection) ─────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/connections/")]
pub struct Connection {
    /// Stable id (e.g. `conn_3PJz4Z…`).
    pub id: String,
    /// Catalog source id (joins with the design-system `SOURCES`
    /// catalog). Free-form string so adding a new vendor doesn't
    /// require bumping a Rust enum.
    pub source: String,
    /// Workspace alias for the connection. Defaults to
    /// `source.name` at install time.
    pub name: String,
    pub health: ConnectionHealth,
    /// ISO timestamp the connection was first authorized.
    pub connected_at: DateTime<Utc>,
    /// ISO timestamp of the most recent event observed.
    pub last_event_at: DateTime<Utc>,
    /// Rolling 24-hour event count.
    pub events_last_24h: u32,
    /// Granted scope ids — joins with the per-vendor scope catalog.
    pub scopes: Vec<String>,
    /// Optional point-of-contact email for the install.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub owner_email: Option<String>,
    /// 24-bucket sparkline values (events/hour).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub spark: Option<Vec<u32>>,
    /// Populated when `health == "error"`; classifies the failure.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub error_kind: Option<ConnectorErrorKind>,
    /// Populated when `health == "expired"`; ISO of token expiry.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub expires_at: Option<DateTime<Utc>>,
    /// Populated when `health == "error"`; raw payload string for
    /// the inspector.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub error_payload: Option<String>,
    /// ISO timestamp of the last manual "Test connection" run.
    /// Older connections that pre-date the field render a `—` cell.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub last_tested_at: Option<DateTime<Utc>>,
    /// Outcome of the last `Test connection` run.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub last_test_status: Option<ConnectionTestStatus>,
    /// Previous-period (24h) event count, used to compute a trend
    /// delta on the card view ("+12% vs prev 24h").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub prev_events_last_24h: Option<u32>,
}

/* ── Backfill history ──────────────────────────────────── */

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/connections/")]
pub enum ConnectionBackfillStatus {
    Running,
    Done,
    Failed,
}

/// Persisted backfill log row. The currently-running shape lives
/// in the onboarding store on the TS side; this is the historical
/// record returned by the dashboard.
#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/connections/")]
pub struct ConnectionBackfillRecord {
    pub id: String,
    /// Lookback window in days.
    pub window_days: u32,
    /// Subset of entity ids the user picked (e.g. `conversations`,
    /// `contacts`).
    pub entities: Vec<String>,
    /// Estimator output at submit time.
    pub est_events: u32,
    pub started_at: DateTime<Utc>,
    /// Absent while still running.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub finished_at: Option<DateTime<Utc>>,
    pub status: ConnectionBackfillStatus,
}

/* ── Event-type subscriptions ─────────────────────────── */

/// Per-event-type toggle row (e.g. Stripe `charge.succeeded`).
/// Renders inside the drawer's Event-types tab.
#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/connections/")]
pub struct ConnectionEventTypeSub {
    pub id: String,
    /// Optional Stripe-style object hint (`charge`, `customer`, …).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub object: Option<String>,
    pub enabled: bool,
    /// Whether this row was on by default at install time.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub default_on: Option<bool>,
}

/* ── Recent deliveries (Activity tab) ─────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/connections/")]
pub struct ConnectionDelivery {
    /// Wall-clock time string the activity tab renders directly
    /// (e.g. `13:02:14`). NOT a full ISO timestamp — the row's
    /// purpose is "what just happened in the last few minutes".
    pub ts: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub method: Option<String>,
    pub preview: String,
    /// HTTP status; `< 200` or `>= 300` tints the row red.
    pub status: u32,
}
