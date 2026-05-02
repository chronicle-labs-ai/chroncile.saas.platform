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

export type BacktestStage = "configure" | "running" | "results";
export type BacktestRunStatus = "running" | "done" | "paused";

/** Phases inside the Configure stage. */
export type BacktestConfigurePhase = "pick" | "recipe";

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
 * `composed` = a tray of production trace sources + generated
 * scenarios, optionally saved later as a reusable dataset.
 * `dataset`  = the user picked a saved dataset; `dataset` /
 *              `datasetLabel` are populated.
 */
export type BacktestDataKind = "composed" | "dataset";

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

export interface BacktestDataScenario {
  id: string;
  /** The "expansion move" the scenario was generated from. */
  kind: "adversarial" | "nonEnglish" | "toolFailure" | "longTurn";
  label: string;
  count: number;
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

/* ── Recipes (the main Configure value) ────────────────────── */

/** Job preset that seeds the recipe — one of the 4 starting cards. */
export type BacktestJobMode = "compare" | "regression" | "bug" | "suite";

/** Job preset id — the values rendered as the 4 picker cards. */
export type BacktestJobId = "compare" | "regression" | "bug" | "suite";

/** Glyph name used by the JobsPicker icons. */
export type BacktestJobIcon = "compare" | "shield" | "bug" | "suite";

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
  /** Free-text run name shown in the recipe header + top nav. */
  name: string;
  /** Optional pinned trace seed; used by the "reproduce a bug"
   *  preset to surface a banner above the recipe. */
  seed?: string;
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
