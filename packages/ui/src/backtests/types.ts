/*
 * Backtests — type model for the Configure → Running → Results flow.
 *
 * Mirrors the fixtures in the standalone HTML mockup but reshaped to
 * fit the rest of the design system (no `--bt-*` tokens, no
 * localStorage). Every visual surface in `backtests/` is fed by these
 * types; mock seeds in `data.ts` produce them, stories pass them
 * through.
 */

/* ── Stage state machine ───────────────────────────────────── */

/**
 * `list`      — manager landing page: table of past / scheduled /
 *               draft backtests + "+ New backtest".
 * `configure` — the directional pipeline (steps 01..04) for a
 *               single run.
 * `running`   — live progress for a launched run.
 * `results`   — verdict, metrics, divergences for a finished run.
 */
export type BacktestStage = "list" | "configure" | "running" | "results";
export type BacktestRunStatus =
  | "running"
  | "done"
  | "paused"
  | "scheduled"
  | "draft"
  | "failed";

/**
 * Phases inside the Configure stage. The configure flow is now a
 * directional pipeline:
 *
 *   pick → dataset → enrich → environment → versions → launch
 *
 * Each preset (`replay`, `compare`, `regression`, `suite`) seeds
 * different defaults and may auto-skip steps (Replay skips Enrich).
 */
export type BacktestConfigurePhase =
  | "pick"
  | "dataset"
  | "enrich"
  | "environment"
  | "versions";

/** Ordered list of pipeline steps shown in the stepper rail. */
export const BACKTEST_PIPELINE_STEPS = [
  "dataset",
  "enrich",
  "environment",
  "versions",
] as const satisfies readonly BacktestConfigurePhase[];

/** Concrete subset of `BacktestConfigurePhase` covering only the
 *  4 pipeline steps (excludes `"pick"`). */
export type BacktestPipelineStep = (typeof BACKTEST_PIPELINE_STEPS)[number];

/* ── Agents under test ─────────────────────────────────────── */

export type BacktestAgentRole = "baseline" | "candidate";

export interface BacktestAgent {
  id: string;
  label: string;
  /** Tag rendered next to the label, e.g. "current production". */
  notes: string;
  /** CSS color token / hex. Used by `CandidateHueDot`. */
  hue: string;
  /** Defaults to "candidate"; the Results table treats the first
   *  baseline as the reference column. */
  role?: BacktestAgentRole;
}

/* ── Datasets, graders, environments ───────────────────────── */

export interface BacktestDataset {
  id: string;
  label: string;
  /** Number of cases in the dataset. */
  cases: number;
  source: string;
  updated: string;
}

export type BacktestGraderKind =
  | "rubric"
  | "classifier"
  | "metric"
  | "embedding"
  | "assertion";

/** Grader weight bucket — `low | med | high` matches the Linear
 *  segmented control we render in the GraderBuilder tray. */
export type BacktestGraderWeight = "low" | "med" | "high";

/** Grader source — where this grader came from when it was added to
 *  the recipe. Determines the chip copy ("proposed" vs "library" vs
 *  "custom" vs "dataset"). */
export type BacktestGraderSource =
  | "proposed"
  | "library"
  | "custom"
  | "dataset";

export interface BacktestGrader {
  id: string;
  label: string;
  kind: BacktestGraderKind;
  weight: BacktestGraderWeight;
  source: BacktestGraderSource;
  /** Optional human-readable explanation of why this grader was
   *  proposed. Rendered under the label in the proposed list. */
  evidence?: string;
}

/** A grader the system *proposed* but the user has not accepted yet.
 *  Carries a confidence score and a small live-preview sample. */
export interface BacktestProposedGrader {
  id: string;
  label: string;
  kind: BacktestGraderKind;
  weight: BacktestGraderWeight;
  /** 0..1 — rendered as a percentage in the proposed card. */
  confidence: number;
  evidence: string;
  preview: BacktestGraderPreviewRow[];
}

export interface BacktestGraderPreviewRow {
  case: string;
  baseline: string;
  expected?: string;
  judgment?: string;
  threshold?: string;
  pass: boolean;
}

/* ── Data composition ──────────────────────────────────────── */

/**
 * `composed`   = a tray of production trace sources + generated
 *                scenarios, optionally saved later as a reusable
 *                dataset.
 * `dataset`    = the user picked a saved dataset; `dataset` /
 *                `datasetLabel` are populated.
 * `production` = the Replay preset — pipes a production traffic
 *                window straight through, no enrichment.
 */
export type BacktestDataKind = "composed" | "dataset" | "production";

export interface BacktestDataSource {
  id: string;
  /** `prod` rows come from production trace clusters, `dataset` rows
   *  echo the chosen saved dataset. */
  kind: "prod" | "dataset";
  label: string;
  count: number;
  filters?: {
    window?: string;
    clusters?: readonly string[];
    outcome?: string;
    seed?: string;
  };
}

/**
 * Cluster bucket emitted by the data-science layer when the system
 * looks for missing scenarios in a dataset:
 *
 *   captured  — clusters already represented in the dataset.
 *   adjacent  — small variations / mutations of captured clusters.
 *   emerging  — new patterns observed in production but not yet
 *               in the dataset.
 *   edge      — rare/long-tail cases worth probing.
 */
export type BacktestScenarioBucket =
  | "captured"
  | "adjacent"
  | "emerging"
  | "edge";

export interface BacktestDataScenario {
  id: string;
  /** The "expansion move" the scenario was generated from. */
  kind: "adversarial" | "nonEnglish" | "toolFailure" | "longTurn";
  label: string;
  count: number;
  /** Discovery bucket — drives the column the scenario lives in
   *  on the Enrich step. Optional so older composed-data flows
   *  still type-check. */
  bucket?: BacktestScenarioBucket;
  /** 0..1 confidence that this scenario surfaces a coverage gap. */
  confidence?: number;
  /** Whether the user has accepted this scenario into the run.
   *  Defaults to true when omitted (legacy composed scenarios). */
  accepted?: boolean;
}

export interface BacktestData {
  kind: BacktestDataKind;
  /** Populated only when `kind === "dataset"`. */
  dataset?: string;
  datasetLabel?: string;
  /** Composed trace sources. */
  sources: readonly BacktestDataSource[];
  /** Generated scenario buckets. */
  scenarios: readonly BacktestDataScenario[];
  /** Optional name the user wants to save this composed dataset as. */
  savedAs?: string | null;
}

/* ── Environments ──────────────────────────────────────────── */

/**
 * Reference to the environment the run will execute in. Mirrors
 * the shape used by `EnvironmentsManager` (`SandboxEnvironment`)
 * but without the heavy detail snapshot — the recipe only needs
 * the identity + status to render summary chrome.
 */
export interface BacktestEnvironmentRef {
  id: string;
  label: string;
  /** Optional snapshot identifier (matches
   *  `EnvironmentDataSnapshot.id`) so we can verify the
   *  environment is seeded with the same dataset. */
  snapshotId?: string;
  /** Optional snapshot label — usually the source dataset slug. */
  snapshotLabel?: string;
  /** Mirror of `SandboxRuntimeStatus` strings ("started",
   *  "stopped", …). Kept loose so callers don't need to import
   *  the environments package. */
  status?: string;
  /** Whether this environment is a freshly cloned ephemeral
   *  sandbox or a saved long-lived environment. */
  ephemeral?: boolean;
}

/* ── Recipes (the main Configure value) ────────────────────── */

/** Job preset that seeds the recipe — one of the 4 starting cards. */
export type BacktestJobMode =
  | "replay"
  | "compare"
  | "regression"
  | "suite";

/** Job preset id — the values rendered as the 4 picker cards. */
export type BacktestJobId = "replay" | "compare" | "regression" | "suite";

/** Glyph name used by the JobsPicker icons. */
export type BacktestJobIcon = "replay" | "compare" | "shield" | "suite";

export interface BacktestJobPreset {
  id: BacktestJobId;
  title: string;
  sub: string;
  why: string;
  icon: BacktestJobIcon;
  /** CSS color (token or hex) painted on the card glyph. */
  hue: string;
  recipe: BacktestRecipe;
}

export interface BacktestRecipe {
  /** Echo of the job mode the recipe started from. Used by the
   *  Results screen to pick a verdict template. */
  mode: BacktestJobMode;
  /** 1..N agents under test. The first is treated as the comparison
   *  baseline by `BacktestResults`. */
  agents: readonly BacktestAgent[];
  data: BacktestData;
  graders: readonly BacktestGrader[];
  /** Optional environment the run targets. Pipeline step 03 sets
   *  this; consumers without an environment fall back to the
   *  default ephemeral sandbox. */
  environment?: BacktestEnvironmentRef;
  /** Free-text run name shown in the recipe header + top nav. */
  name: string;
  /** Optional pinned trace seed; used by the Replay preset to
   *  reproduce a single trace as the focal point of the run. */
  seed?: string;
}

/* ── List view (manager landing) ───────────────────────────── */

/**
 * Compact projection of a backtest run rendered on the list view.
 * Combines the recipe identity (mode, environment, agents, dataset)
 * with run lifecycle metadata (status, verdict, divergences).
 *
 * `draft` rows have no run yet; `scheduled` rows are queued; `done`
 * + `failed` rows are historical.
 */
export interface BacktestRunSummary {
  id: string;
  /** Display name of the run (matches `BacktestRecipe.name`). */
  name: string;
  mode: BacktestJobMode;
  status: BacktestRunStatus;
  /** ISO timestamp of the most recent state change — drives "ago". */
  updatedAt: string;
  /** Optional ISO timestamp the run is scheduled to start. */
  scheduledFor?: string;
  /** Display label for the dataset / production window seed. */
  datasetLabel: string;
  /** Display label for the environment the run targets. */
  environmentLabel?: string;
  /** Agent ids participating in the run; the first is the baseline. */
  agentIds: readonly string[];
  /** Total cases × agents; null while still drafting. */
  totalRuns?: number;
  /** Verdict copy shown in the verdict column for `done` rows. */
  verdict?: string;
  /** CSS color (token) used for the run row's identity dot. */
  hue?: string;
  /** Divergences observed (only set when status is `done` / `failed`). */
  divergences?: number;
  /** Owner / actor who started the run. */
  owner?: string;
}

/* ── Running stage ─────────────────────────────────────────── */

/** Per-trace status displayed in the live feed table. */
export type BacktestLiveCaseStatus =
  | "pass"
  | "mixed"
  | "fail"
  | "running";

export interface BacktestLiveCase {
  id: string;
  cluster: string;
  prompt: string;
  ts: string;
  status: BacktestLiveCaseStatus;
  /** Duration in seconds. */
  durationSec: number;
  /** Agent id that ran this case. */
  agentId: string;
}

/** Per-candidate row on the Running screen. */
export interface BacktestCandidateProgress {
  agent: BacktestAgent;
  isBaseline: boolean;
  pct: number;
  done: number;
  total: number;
  passPct: number;
  divergencePct?: number;
  errorPct: number;
  avgDuration: string;
  spent: string;
}

/* ── Divergences ───────────────────────────────────────────── */

export type BacktestDivergenceDelta =
  | "improvement"
  | "regression"
  | "neutral";

export type BacktestDivergenceSeverity = "high" | "medium" | "low";

/** Outcome string from the mockup. Used by `outcome-meta.ts` to map
 *  to a tag tone. */
export type BacktestOutcome =
  | "resolved"
  | "escalated"
  | "failed"
  | "partial"
  | "merged"
  | "pr_opened";

export interface BacktestDivergenceSide {
  /** Optional candidate label rendered above the side. */
  label?: string;
  outcome: BacktestOutcome;
  turns: number;
  latency: string;
  verdict: string;
}

export interface BacktestDivergence {
  id: string;
  prompt: string;
  cluster: string;
  /** CSS color token / hex for the cluster dot. */
  hue: string;
  baseline: BacktestDivergenceSide;
  candidate: BacktestDivergenceSide;
  delta: BacktestDivergenceDelta;
  severity: BacktestDivergenceSeverity;
  /** Grader id (joins with `BacktestGrader.id`). */
  grader: string;
  note: string;
}

/* ── Metrics ───────────────────────────────────────────────── */

export interface BacktestMetric {
  id: string;
  label: string;
  unit: string;
  /** Whether higher numbers are better — drives the delta tone. */
  higher: boolean;
  /** Baseline value the comparison column anchors against. */
  baseline: number;
  /** Per-candidate scores keyed by `BacktestAgent.id`. */
  rows: Record<string, number>;
}

/* ── Quick check (30-case preview) ─────────────────────────── */

export type BacktestQuickCheckCellState =
  | "pending"
  | "pass"
  | "improv"
  | "regr"
  | "fail";

export type BacktestQuickCheckState = "running" | "done";
