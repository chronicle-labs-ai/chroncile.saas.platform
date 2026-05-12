//! Backtests — wire shapes for the Configure → Running → Results flow,
//! plus the runtime contract the in-process orchestrator persists against.
//!
//! Two concerns share this file because they answer the same question
//! from different ends:
//!
//! * **Wire shapes** mirror `packages/ui/src/backtests/types.ts` so the
//!   `chronicle` data provider can consume them through the same ts-rs
//!   pipeline that already powers `agents.rs`, `connections.rs`,
//!   `datasets.rs`. The dashboard reads `BacktestRunSummary[]`,
//!   `BacktestRecipe`, `BacktestDivergence`, `BacktestMetric`; the
//!   server side returns them verbatim.
//!
//! * **Runtime types** (`JobStatus`, `TrialStatus`, `TrialPhase`,
//!   `TrialEvent`, `JobConfig`, `RetryConfig`, `SandboxDriver`,
//!   `BacktestJobRecord`, `BacktestTrialRecord`) describe the
//!   orchestrator's own state machine. They map onto the rows defined
//!   in `migrations/013_create_backtest_runtime.sql` and onto the SSE
//!   events the trial lifecycle emits.
//!
//! The split mirrors Harbor's separation between `models/task/config.py`
//! (the user-authored recipe) and `models/trial/result.py` (the
//! orchestrator's output). Wire types are stable and externally owned;
//! runtime types belong to the server and may evolve independently.
//!
//! Naming + serialization conventions match `domain::datasets`:
//! `#[serde(rename_all = "camelCase")]` on structs,
//! `#[serde(rename_all = "kebab-case")]` on framework / status enums
//! (those have multi-word kebab-case spellings on the wire),
//! `#[serde(rename_all = "lowercase")]` on the simple short-tag enums.

use chrono::{DateTime, Utc};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use ts_rs::TS;

/* ── Stage state machine ─────────────────────────────────── */

/// `list`      — manager landing page: table of past / scheduled /
///               draft backtests + "+ New backtest".
/// `configure` — the directional pipeline (steps 01..04) for a single
///               run.
/// `running`   — live progress for a launched run.
/// `results`   — verdict, metrics, divergences for a finished run.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/backtests/")]
pub enum BacktestStage {
    List,
    Configure,
    Running,
    Results,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/backtests/")]
pub enum BacktestRunStatus {
    Running,
    Done,
    Paused,
    Scheduled,
    Draft,
    Failed,
}

/// Phases inside the Configure stage. The configure flow is a
/// directional pipeline: pick → coverage → environment → versions →
/// launch.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/backtests/")]
pub enum BacktestConfigurePhase {
    Pick,
    Coverage,
    Environment,
    Versions,
}

/* ── Agents under test ───────────────────────────────────── */

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/backtests/")]
pub enum BacktestAgentRole {
    Baseline,
    Candidate,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct BacktestAgent {
    pub id: String,
    pub label: String,
    /// Tag rendered next to the label, e.g. "current production".
    pub notes: String,
    /// CSS color token / hex. Used by `CandidateHueDot`.
    pub hue: String,
    /// Defaults to `candidate`; the Results table treats the first
    /// baseline as the reference column.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub role: Option<BacktestAgentRole>,
}

/* ── Datasets, graders ───────────────────────────────────── */

/// Dataset reference rendered inside the recipe. Distinct from
/// `domain::datasets::Dataset` (the catalog row) — this carries only
/// the identity + size metadata the recipe surface needs.
#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct BacktestDataset {
    pub id: String,
    pub label: String,
    /// Number of cases in the dataset.
    pub cases: u32,
    pub source: String,
    /// ISO timestamp of the most recent dataset update.
    pub updated: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/backtests/")]
pub enum BacktestGraderKind {
    Rubric,
    Classifier,
    Metric,
    Embedding,
    Assertion,
}

/// Grader weight bucket — `low | med | high` matches the segmented
/// control in the GraderBuilder tray.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/backtests/")]
pub enum BacktestGraderWeight {
    Low,
    Med,
    High,
}

/// Grader source — where this grader came from when it was added to
/// the recipe. Determines the chip copy ("proposed" vs "library" vs
/// "custom" vs "dataset").
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/backtests/")]
pub enum BacktestGraderSource {
    Proposed,
    Library,
    Custom,
    Dataset,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct BacktestGrader {
    pub id: String,
    pub label: String,
    pub kind: BacktestGraderKind,
    pub weight: BacktestGraderWeight,
    pub source: BacktestGraderSource,
    /// Optional human-readable explanation of why this grader was
    /// proposed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub evidence: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct BacktestGraderPreviewRow {
    #[serde(rename = "case")]
    pub case_label: String,
    pub baseline: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub expected: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub judgment: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub threshold: Option<String>,
    pub pass: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct BacktestProposedGrader {
    pub id: String,
    pub label: String,
    pub kind: BacktestGraderKind,
    pub weight: BacktestGraderWeight,
    /// 0..1 — rendered as a percentage in the proposed card.
    pub confidence: f64,
    pub evidence: String,
    pub preview: Vec<BacktestGraderPreviewRow>,
}

/* ── Data composition ───────────────────────────────────── */

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/backtests/")]
pub enum BacktestDataKind {
    Composed,
    Dataset,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/backtests/")]
pub enum BacktestDataSourceKind {
    Prod,
    Dataset,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct BacktestDataSourceFilters {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub window: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub clusters: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub outcome: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub seed: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct BacktestDataSource {
    pub id: String,
    pub kind: BacktestDataSourceKind,
    pub label: String,
    pub count: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub filters: Option<BacktestDataSourceFilters>,
}

/// Cluster bucket emitted by the data-science layer when looking for
/// missing scenarios in a dataset.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/backtests/")]
pub enum BacktestScenarioBucket {
    Captured,
    Adjacent,
    Emerging,
    Edge,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub enum BacktestDataScenarioKind {
    Adversarial,
    NonEnglish,
    ToolFailure,
    LongTurn,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct BacktestDataScenario {
    pub id: String,
    pub kind: BacktestDataScenarioKind,
    pub label: String,
    pub count: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub bucket: Option<BacktestScenarioBucket>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub confidence: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub accepted: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub cluster_label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub cluster_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct BacktestData {
    pub kind: BacktestDataKind,
    /// Populated only when `kind == "dataset"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub dataset: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub dataset_label: Option<String>,
    pub sources: Vec<BacktestDataSource>,
    pub scenarios: Vec<BacktestDataScenario>,
    /// Optional name the user wants to save this composed dataset as.
    /// `null` (vs absent) tells the UI the user opted out of saving.
    #[serde(default)]
    #[ts(optional, type = "string | null")]
    pub saved_as: Option<String>,
}

/* ── Environments ───────────────────────────────────────── */

/// Reference to the environment a run will execute in. Mirrors the
/// shape used by `EnvironmentsManager` (`SandboxEnvironment`) but
/// without the heavy detail snapshot — the recipe only needs the
/// identity + status to render summary chrome.
#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct BacktestEnvironmentRef {
    pub id: String,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub snapshot_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub snapshot_label: Option<String>,
    /// Mirror of `SandboxRuntimeStatus` strings ("started", "stopped",
    /// …). Kept loose so callers don't need to import the environments
    /// package.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub status: Option<String>,
    /// Whether this environment is a freshly cloned ephemeral sandbox
    /// or a saved long-lived environment.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub ephemeral: Option<bool>,
}

/* ── Recipes (the main Configure value) ─────────────────── */

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/backtests/")]
pub enum BacktestJobMode {
    Replay,
    Compare,
    Regression,
    Suite,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/backtests/")]
pub enum BacktestJobIcon {
    Replay,
    Compare,
    Shield,
    Suite,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct BacktestJobPreset {
    pub id: BacktestJobMode,
    pub title: String,
    pub sub: String,
    pub why: String,
    pub icon: BacktestJobIcon,
    /// CSS color (token or hex) painted on the card glyph.
    pub hue: String,
    pub recipe: BacktestRecipe,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct BacktestRecipe {
    pub mode: BacktestJobMode,
    /// 1..N agents under test. The first is treated as the comparison
    /// baseline by `BacktestResults`.
    pub agents: Vec<BacktestAgent>,
    pub data: BacktestData,
    pub graders: Vec<BacktestGrader>,
    /// Optional environment the run targets. Pipeline step 03 sets
    /// this; consumers without an environment fall back to the default
    /// ephemeral sandbox.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub environment: Option<BacktestEnvironmentRef>,
    /// Free-text run name shown in the recipe header + top nav.
    pub name: String,
    /// Optional pinned trace seed; used by the Replay preset to
    /// reproduce a single trace as the focal point of the run.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub seed: Option<String>,
}

/* ── List view (manager landing) ────────────────────────── */

/// Compact projection of a backtest run rendered on the list view.
/// Combines the recipe identity (mode, environment, agents, dataset)
/// with run lifecycle metadata (status, verdict, divergences).
#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct BacktestRunSummary {
    pub id: String,
    /// Display name of the run (matches `BacktestRecipe.name`).
    pub name: String,
    pub mode: BacktestJobMode,
    pub status: BacktestRunStatus,
    /// ISO timestamp of the most recent state change — drives "ago".
    pub updated_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub scheduled_for: Option<DateTime<Utc>>,
    /// Display label for the dataset / production window seed.
    pub dataset_label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub environment_label: Option<String>,
    /// Agent ids participating in the run; the first is the baseline.
    pub agent_ids: Vec<String>,
    /// Total cases × agents; null while still drafting.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub total_runs: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub verdict: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub hue: Option<String>,
    /// Divergences observed (only set when status is `done` / `failed`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub divergences: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub owner: Option<String>,
}

/* ── Running stage ──────────────────────────────────────── */

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/backtests/")]
pub enum BacktestLiveCaseStatus {
    Pass,
    Mixed,
    Fail,
    Running,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct BacktestLiveCase {
    pub id: String,
    pub cluster: String,
    pub prompt: String,
    pub ts: String,
    pub status: BacktestLiveCaseStatus,
    pub duration_sec: f64,
    pub agent_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct BacktestCandidateProgress {
    pub agent: BacktestAgent,
    pub is_baseline: bool,
    pub pct: f64,
    pub done: u32,
    pub total: u32,
    pub pass_pct: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub divergence_pct: Option<f64>,
    pub error_pct: f64,
    pub avg_duration: String,
    pub spent: String,
}

/* ── Divergences ────────────────────────────────────────── */

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/backtests/")]
pub enum BacktestDivergenceDelta {
    Improvement,
    Regression,
    Neutral,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/backtests/")]
pub enum BacktestDivergenceSeverity {
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "types/backtests/")]
pub enum BacktestOutcome {
    Resolved,
    Escalated,
    Failed,
    Partial,
    Merged,
    PrOpened,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct BacktestDivergenceSide {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub label: Option<String>,
    pub outcome: BacktestOutcome,
    pub turns: u32,
    pub latency: String,
    pub verdict: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct BacktestDivergence {
    pub id: String,
    pub prompt: String,
    pub cluster: String,
    pub hue: String,
    pub baseline: BacktestDivergenceSide,
    pub candidate: BacktestDivergenceSide,
    pub delta: BacktestDivergenceDelta,
    pub severity: BacktestDivergenceSeverity,
    /// Grader id (joins with `BacktestGrader.id`).
    pub grader: String,
    pub note: String,
}

/* ── Metrics ────────────────────────────────────────────── */

/// Per-metric row rendered in the Results metrics table. `rows` keys
/// match `BacktestAgent.id`.
#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct BacktestMetric {
    pub id: String,
    pub label: String,
    pub unit: String,
    /// Whether higher numbers are better — drives the delta tone.
    pub higher: bool,
    /// Baseline value the comparison column anchors against.
    pub baseline: f64,
    pub rows: HashMap<String, f64>,
}

/* ── Quick check (30-case preview) ──────────────────────── */

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/backtests/")]
pub enum BacktestQuickCheckCellState {
    Pending,
    Pass,
    Improv,
    Regr,
    Fail,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/backtests/")]
pub enum BacktestQuickCheckState {
    Running,
    Done,
}

/* ── Availability + scene (provider contracts) ──────────── */

/// Returned by `GET /api/platform/backtests/availability`. Matches the
/// frontend's `BacktestsAvailability`. Datasets, environments, and
/// agents come from their respective domain crates' types — the IDs in
/// these slices are what the recipe references.
#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct BacktestsAvailability {
    pub datasets: Vec<crate::datasets::Dataset>,
    pub dataset_snapshots: HashMap<String, crate::datasets::DatasetSnapshot>,
    /// Environment row identities + status. Detailed snapshot lives
    /// behind `GET /api/platform/environments/:id`.
    pub environments: Vec<BacktestEnvironmentRef>,
    pub agents: Vec<crate::agents::AgentSummary>,
}

/// Returned by `GET /api/platform/backtests/scene`. `null` (handled at
/// the route level) means "no pre-baked scene; fall back to list view".
#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct BacktestsScene {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub initial_stage: Option<BacktestStage>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub initial_recipe: Option<BacktestRecipe>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub divergences: Option<Vec<BacktestDivergence>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub metrics: Option<Vec<BacktestMetric>>,
}

/* ──────────────────────────────────────────────────────── */
/* Runtime types — orchestrator-owned                       */
/* ──────────────────────────────────────────────────────── */

/// Lifecycle state of an entire `BacktestJob`. Maps 1:1 onto the
/// `status` column in `migrations/013_create_backtest_runtime.sql`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/backtests/")]
pub enum JobStatus {
    Pending,
    Running,
    Succeeded,
    Failed,
    Cancelled,
}

/// Lifecycle state of a single `BacktestTrial` (one (case × agent)
/// cell).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/backtests/")]
pub enum TrialStatus {
    Pending,
    Setup,
    Running,
    Verifying,
    Succeeded,
    Failed,
    Cancelled,
}

/// Phase of execution emitted on the SSE stream as the trial progresses.
/// Distinct from `TrialStatus` — `TrialPhase` is fine-grained progress
/// inside the lifecycle, `TrialStatus` is the persisted summary.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "kebab-case")]
#[ts(export, export_to = "types/backtests/")]
pub enum TrialPhase {
    Queued,
    EnvironmentStart,
    EnvironmentReady,
    AgentSetup,
    AgentRunning,
    VerifierRunning,
    ArtifactCollection,
    Cleanup,
    Done,
}

/// Sandbox driver picked at submit time. Echoed onto the
/// `BacktestJob.sandboxDriver` column. The orchestrator reads this to
/// pick the implementation behind the `Sandbox` trait (Phase 1).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/backtests/")]
pub enum SandboxDriver {
    /// Local Docker daemon. Useful for CI + dev loops.
    Docker,
    /// Daytona cloud sandboxes. Default for production.
    Daytona,
    /// In-process echo sandbox; powers CLI smoke tests + unit tests
    /// without container infra.
    Mock,
}

impl SandboxDriver {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Docker => "docker",
            Self::Daytona => "daytona",
            Self::Mock => "mock",
        }
    }
}

/// Retry policy applied to transient trial failures (network errors,
/// sandbox-create timeouts). Mirrors Harbor's `RetryConfig`. Pass
/// `null` on the wire (`None` here) to fall back to defaults.
#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct RetryConfig {
    pub max_retries: u32,
    pub min_wait_sec: f64,
    pub max_wait_sec: f64,
    pub wait_multiplier: f64,
    /// When set, only exception kinds in this list trigger a retry.
    /// `None` means "retry every transient kind".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub include_exceptions: Option<Vec<String>>,
    /// Exception kinds that explicitly should not be retried even if
    /// otherwise matched by `include_exceptions`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub exclude_exceptions: Option<Vec<String>>,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 2,
            min_wait_sec: 1.0,
            max_wait_sec: 30.0,
            wait_multiplier: 2.0,
            include_exceptions: None,
            exclude_exceptions: Some(vec![
                "AgentExitedNonZero".to_string(),
                "VerifierFailed".to_string(),
            ]),
        }
    }
}

/// User-submitted job configuration. Persisted into
/// `BacktestJob.recipe` (the inline `BacktestRecipe`) plus a few
/// orchestrator-level columns (`nConcurrent`, `sandboxDriver`,
/// `retryConfig`).
#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct JobConfig {
    pub recipe: BacktestRecipe,
    pub n_concurrent: u32,
    pub sandbox_driver: SandboxDriver,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub retry_config: Option<RetryConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub scheduled_for: Option<DateTime<Utc>>,
}

/// Captured exception info for a failed trial. Mirrors Harbor's
/// `ExceptionInfo` — kind for routing/retry, message for humans.
#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct TrialException {
    pub kind: String,
    pub message: String,
}

/// Per-phase timing bookkeeping. Each pair is `(started_at,
/// finished_at)`; `None` until that phase starts/ends.
#[derive(Debug, Clone, Default, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct TrialTimings {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub env_setup_started_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub env_setup_finished_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub agent_setup_started_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub agent_setup_finished_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub agent_run_started_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub agent_run_finished_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub verifier_started_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub verifier_finished_at: Option<DateTime<Utc>>,
}

/// Final result of a single trial. Multi-key reward shape mirrors the
/// `BacktestTrialReward` table (one row per key) and Harbor's
/// `VerifierResult.rewards: dict[str, float]`.
#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct TrialResult {
    pub trial_id: String,
    pub status: TrialStatus,
    pub rewards: HashMap<String, f64>,
    pub timings: TrialTimings,
    /// Aggregate trial duration (`agent_run_finished_at - env_setup_started_at`)
    /// once a terminal status is reached.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub duration_ms: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub exception: Option<TrialException>,
}

/// Event emitted by the orchestrator on its broadcast channel; the SSE
/// handler at `/api/platform/backtests/jobs/:id/stream` re-emits these
/// to the dashboard + CLI. Variants match the dashboard's
/// `BacktestsEvent` plus per-trial fine grain.
#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(tag = "kind", rename_all = "kebab-case")]
#[ts(export, export_to = "types/backtests/")]
pub enum TrialEvent {
    /// The job moved into `running` (or back into `running` after a
    /// pause).
    JobStarted { job_id: String },
    /// A trial transitioned phases (queued → running → verifying →
    /// done).
    TrialPhaseChanged {
        job_id: String,
        trial_id: String,
        phase: TrialPhase,
    },
    /// A trial wrote a final reward set; the dashboard's metrics table
    /// updates incrementally.
    TrialRewardsRecorded {
        job_id: String,
        trial_id: String,
        rewards: HashMap<String, f64>,
    },
    /// A trial reached a terminal status.
    TrialFinished {
        job_id: String,
        trial_id: String,
        status: TrialStatus,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        exception: Option<TrialException>,
    },
    /// The job reached a terminal status. Carries a verdict so the
    /// list view can render without an extra fetch.
    JobFinished {
        job_id: String,
        status: JobStatus,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        verdict: Option<String>,
    },
}

/* ── DB row projections ─────────────────────────────────── */
/*
 * These mirror the rows in migration 013 verbatim. Repos return them;
 * the API layer projects them into wire shapes
 * (`BacktestRunSummary`, `TrialResult`, etc.) before sending.
 */

/// Row projection of `"BacktestJob"`.
#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct BacktestJobRecord {
    pub id: String,
    pub tenant_id: String,
    pub name: String,
    pub mode: BacktestJobMode,
    /// Full BacktestRecipe blob persisted at submit time.
    #[ts(type = "Record<string, unknown>")]
    pub recipe: serde_json::Value,
    pub status: JobStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub verdict: Option<String>,
    pub n_concurrent: u32,
    pub sandbox_driver: SandboxDriver,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub retry_config: Option<RetryConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub created_by: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub scheduled_for: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub started_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub finished_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub total_trials: Option<u32>,
    pub completed_trials: u32,
    pub failed_trials: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub exception_kind: Option<String>,
    pub updated_at: DateTime<Utc>,
}

/// Row projection of `"BacktestTrial"`.
#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct BacktestTrialRecord {
    pub id: String,
    pub job_id: String,
    pub tenant_id: String,
    pub agent_id: String,
    pub agent_label: String,
    pub is_baseline: bool,
    pub case_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub case_cluster: Option<String>,
    pub status: TrialStatus,
    pub timings: TrialTimings,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub duration_ms: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub sandbox_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub exception: Option<TrialException>,
    pub attempt: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Row projection of `"BacktestTrialReward"`. The repo typically
/// returns a `HashMap<String, f64>` for rendering, but exporting the
/// row itself lets the CLI inspector show provenance (which grader
/// scored which key).
#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct BacktestTrialRewardRecord {
    pub trial_id: String,
    pub key: String,
    pub value: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub grader_id: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Row projection of `"BacktestArtifact"`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "kebab-case")]
#[ts(export, export_to = "types/backtests/")]
pub enum BacktestArtifactKind {
    AgentLog,
    VerifierLog,
    Trajectory,
    Screenshot,
    RewardJson,
    RewardTxt,
    Tar,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct BacktestArtifactRecord {
    pub id: String,
    pub trial_id: String,
    pub kind: BacktestArtifactKind,
    pub path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub size_bytes: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub content_type: Option<String>,
    pub created_at: DateTime<Utc>,
}

/* ── Inputs (repository contract) ───────────────────────── */

/// Insert payload accepted by `BacktestJobRepository::create`. The
/// orchestrator typically builds this from a `JobConfig`; the API
/// layer accepts a `JobConfig` directly and translates.
#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct CreateBacktestJobInput {
    pub tenant_id: String,
    pub name: String,
    pub mode: BacktestJobMode,
    #[ts(type = "Record<string, unknown>")]
    pub recipe: serde_json::Value,
    pub n_concurrent: u32,
    pub sandbox_driver: SandboxDriver,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub retry_config: Option<RetryConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub created_by: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub scheduled_for: Option<DateTime<Utc>>,
}

/// Insert payload for `BacktestTrialRepository::create`.
#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/backtests/")]
pub struct CreateBacktestTrialInput {
    pub job_id: String,
    pub tenant_id: String,
    pub agent_id: String,
    pub agent_label: String,
    pub is_baseline: bool,
    pub case_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub case_cluster: Option<String>,
}
