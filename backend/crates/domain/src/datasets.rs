//! Datasets — wire shapes for the Datasets surface.
//!
//! These types are the single source of truth for every dataset-shaped
//! payload that crosses the HTTP boundary. The frontend's
//! `packages/ui` collapses to thin re-exports of the ts-rs files
//! emitted alongside this module; the `chronicle` data-provider
//! parses Chronicle responses through Zod schemas generated from the
//! same definitions.
//!
//! Source-of-truth derivation — for the existing TS shapes see
//! `packages/ui/src/datasets/types.ts` (and the
//! `Dataset` / `DatasetPurpose` / `DatasetSplit` slice of
//! `packages/ui/src/stream-timeline/types.ts`). Field names use
//! `#[serde(rename_all = "camelCase")]` so the TS bindings keep the
//! `traceCount` / `failedTraceIds` / etc. spellings the dashboard
//! components consume today.

use chrono::{DateTime, Utc};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/* ── Dataset (the parent record) ──────────────────────────── */

/// Intended use of a dataset — drives the colored badge on the
/// picker and lets apps route additions to the right backend
/// (eval suite, training set, replay corpus, manual review queue).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/datasets/")]
pub enum DatasetPurpose {
    Eval,
    Training,
    Replay,
    Review,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/datasets/")]
pub struct Dataset {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub purpose: Option<DatasetPurpose>,
    /// Number of traces currently in the dataset.
    pub trace_count: u32,
    /// Optional total event count across all traces.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub event_count: Option<u32>,
    /// ISO timestamp of the most recent addition.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub updated_at: Option<DateTime<Utc>>,
    /// Display name of the dataset owner / creator.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub created_by: Option<String>,
    /// Free-form pinned tags.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub tags: Option<Vec<String>>,
}

/* ── Stream timeline event (referenced by DatasetSnapshot) ── */

/// Train / validation / test split assignment.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/datasets/")]
pub enum DatasetSplit {
    Train,
    Validation,
    Test,
}

/// A single event rendered as a mark on the stream timeline. The full
/// shape lives next to dataset shapes because `DatasetSnapshot.events`
/// is the only consumer that ships over the wire today.
#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/datasets/")]
pub struct StreamTimelineEvent {
    pub id: String,
    /// Source/system the event came from (e.g. `intercom`, `stripe`).
    pub source: String,
    /// Event type within the source (e.g. `conversation.created`).
    #[serde(rename = "type")]
    pub event_type: String,
    /// ISO timestamp.
    pub occurred_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub actor: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub message: Option<String>,
    /// Raw payload — shown JSON-pretty in the detail panel.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional, type = "Record<string, unknown>")]
    pub payload: Option<serde_json::Value>,
    /// Optional grouping (capture stream id) — currently informational.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub stream: Option<String>,
    /// Optional explicit color override; falls back to the source color.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub color: Option<String>,
    /// Trace this event belongs to.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub trace_id: Option<String>,
    /// Direct causal predecessor.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub parent_event_id: Option<String>,
    /// Looser, app-defined grouping key (e.g. `conversation_id`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub correlation_key: Option<String>,
    /// Human-friendly label for the trace.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub trace_label: Option<String>,
}

/* ── Per-trace summary ────────────────────────────────────── */

/// Health status of a trace as judged by the dataset owner.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/datasets/")]
pub enum TraceStatus {
    Ok,
    Warn,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/datasets/")]
pub struct TraceSummary {
    pub trace_id: String,
    pub label: String,
    pub primary_source: String,
    pub sources: Vec<String>,
    pub event_count: u32,
    pub started_at: DateTime<Utc>,
    pub duration_ms: u32,
    pub status: TraceStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub split: Option<DatasetSplit>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub cluster_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub added_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub added_by: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub note: Option<String>,
    /// Pre-computed 2D embedding in normalized `[-1, 1]` space.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub embedding: Option<[f64; 2]>,
}

/* ── Clusters + edges ────────────────────────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/datasets/")]
pub struct DatasetCluster {
    pub id: String,
    pub label: String,
    /// CSS color for the cluster (e.g. `"var(--c-event-teal)"`).
    pub color: String,
    pub trace_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub description: Option<String>,
    /// Optional pre-computed centroid hint in normalized [0..1] space.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub similarity_center: Option<[f64; 2]>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/datasets/")]
pub struct DatasetSimilarityEdge {
    pub from_trace_id: String,
    pub to_trace_id: String,
    /// Similarity weight in [0..1].
    pub weight: f64,
}

/* ── Snapshot ─────────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/datasets/")]
pub struct DatasetSnapshot {
    pub dataset: Dataset,
    pub traces: Vec<TraceSummary>,
    pub clusters: Vec<DatasetCluster>,
    pub edges: Vec<DatasetSimilarityEdge>,
    /// Optional pre-built event index used by the Timeline tab.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub events: Option<Vec<StreamTimelineEvent>>,
}

/* ── CRUD payloads ────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/datasets/")]
pub struct CreateDatasetPayload {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub purpose: Option<DatasetPurpose>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub tags: Option<Vec<String>>,
}

/// Editable subset of `Dataset` fields. Maps to TS
/// `Partial<Pick<Dataset, "name" | "description" | "purpose" | "tags">>`
/// — every field is optional and `None` means "leave alone".
#[derive(Debug, Clone, Default, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/datasets/")]
pub struct DatasetPatch {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub purpose: Option<DatasetPurpose>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/datasets/")]
pub struct UpdateDatasetPayload {
    pub id: String,
    pub patch: DatasetPatch,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/datasets/")]
pub struct DeleteDatasetPayload {
    pub id: String,
    /// True when the user confirmed deletion of a non-empty dataset.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub cascade: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/datasets/")]
pub struct RemoveTraceFromDatasetPayload {
    pub dataset_id: String,
    pub trace_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub reason: Option<String>,
}

/* ── Bulk + inline trace mutations ────────────────────────── */

/// Patch to apply to one or more traces. Distinguishes between
/// "leave alone" (`None`) and "clear" (`Some(NullableField::Clear)`)
/// — the TS side uses literal `null` for clearing; we serialize as a
/// flat `Option<...>` and reserve the `null` literal in the JSON
/// shape via `#[serde(default, deserialize_with = "...")]` if we
/// later need to distinguish. For now `None` covers both — frontends
/// use the absence to mean "leave alone" and explicit `null` to mean
/// "clear", which serde handles transparently.
#[derive(Debug, Clone, Default, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/datasets/")]
pub struct UpdateTracesPatch {
    /// New cluster id, or `null` to drop the trace from any cluster.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub cluster_id: Option<Option<String>>,
    /// New split, or `null` to mark unassigned.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub split: Option<Option<DatasetSplit>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub status: Option<TraceStatus>,
    /// Replace the membership note, or `null` to clear it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub note: Option<Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/datasets/")]
pub struct UpdateTracesPayload {
    pub dataset_id: String,
    pub trace_ids: Vec<String>,
    pub patch: UpdateTracesPatch,
}

/* ── Saved views ──────────────────────────────────────────── */

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/datasets/")]
pub enum DatasetSavedViewScope {
    Personal,
    Workspace,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/datasets/")]
pub struct DatasetSavedViewSort {
    pub id: String,
    pub desc: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/datasets/")]
pub struct DatasetSavedViewFilter {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub id: Option<String>,
    pub column_id: String,
    pub operator: String,
    /// Filter value — typed loosely so this module doesn't depend on
    /// `product/filters` types. Mirrors `unknown` on the TS side.
    #[ts(type = "unknown")]
    pub value: serde_json::Value,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/datasets/")]
pub struct DatasetSavedViewState {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub lens: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub group_by: Option<String>,
    /// Deprecated since the table moved to TanStack multi-column
    /// sort. New views write `sorting`; this stays as a back-compat
    /// fallback for views captured before the migration.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub ordering: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub sorting: Option<Vec<DatasetSavedViewSort>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub density: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub show_empty_groups: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub display_properties: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub filters: Option<Vec<DatasetSavedViewFilter>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub search: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/datasets/")]
pub struct DatasetSavedView {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub description: Option<String>,
    pub scope: DatasetSavedViewScope,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub created_by: Option<String>,
    pub state: DatasetSavedViewState,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub shortcut: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/datasets/")]
pub struct CreateSavedViewPayload {
    pub dataset_id: String,
    pub name: String,
    pub scope: DatasetSavedViewScope,
    pub state: DatasetSavedViewState,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/datasets/")]
pub struct DatasetSavedViewPatch {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub scope: Option<DatasetSavedViewScope>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub created_by: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub state: Option<DatasetSavedViewState>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub shortcut: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/datasets/")]
pub struct UpdateSavedViewPayload {
    pub dataset_id: String,
    pub view_id: String,
    pub patch: DatasetSavedViewPatch,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/datasets/")]
pub struct DeleteSavedViewPayload {
    pub dataset_id: String,
    pub view_id: String,
}

/* ── Eval runs ────────────────────────────────────────────── */

/// Status badge tone for an eval run.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/datasets/")]
pub enum DatasetEvalRunStatus {
    Passing,
    Regressed,
    Running,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/datasets/")]
pub struct DatasetEvalRun {
    pub id: String,
    /// Display label — usually `agent.name@version` or a build hash.
    pub agent_label: String,
    pub started_at: DateTime<Utc>,
    pub status: DatasetEvalRunStatus,
    /// 0–1; null while running.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub pass_rate: Option<f64>,
    pub total_count: u32,
    pub failed_trace_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub note: Option<String>,
}
