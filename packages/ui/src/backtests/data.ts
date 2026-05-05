/*
 * Backtests — deterministic mock fixtures for Storybook.
 *
 * Mirrors the `BT` global from the original Backtests Standalone
 * mockup (candidates / datasets / graders / metrics / divergences /
 * liveCases / transcript) and adds `JOB_PRESETS` — the 4 starting
 * recipes the Jobs Picker offers.
 *
 * Sparkline values are produced by a seeded mulberry32 RNG so VRT
 * snapshots stay byte-stable across reloads.
 */

import type {
  BacktestAgent,
  BacktestDataScenario,
  BacktestDataset,
  BacktestDivergence,
  BacktestEnvironmentRef,
  BacktestGrader,
  BacktestJobPreset,
  BacktestLiveCase,
  BacktestMetric,
  BacktestProposedGrader,
  BacktestRecipe,
  BacktestRunSummary,
  BacktestScenarioBucket,
} from "./types";

/* ── Candidate agents ──────────────────────────────────────── */

export const BACKTEST_CANDIDATES: readonly BacktestAgent[] = [
  {
    id: "support-v3",
    label: "support-v3",
    notes: "current production · locked 18 days ago",
    hue: "#9aa0a6",
    role: "baseline",
  },
  {
    id: "support-v4.0",
    label: "support-v4.0",
    notes: "tool-use retrained · new refund policy prompt",
    hue: "var(--c-event-teal)",
    role: "candidate",
  },
  {
    id: "support-v4.1",
    label: "support-v4.1",
    notes: "v4.0 + stricter escalation rubric",
    hue: "var(--c-event-violet)",
    role: "candidate",
  },
  {
    id: "support-v4.2",
    label: "support-v4.2-rc",
    notes: "experimental · reasoning traces on",
    hue: "var(--c-ember)",
    role: "candidate",
  },
];

/** Lookup helper used by the JobPresets and the editors. */
export function findCandidate(id: string): BacktestAgent | undefined {
  return BACKTEST_CANDIDATES.find((c) => c.id === id);
}

/* ── Saved datasets ────────────────────────────────────────── */

export const BACKTEST_DATASETS: readonly BacktestDataset[] = [
  {
    id: "refund-escal-v2",
    label: "refund-escalations-v2",
    cases: 412,
    source: "production · last 30d",
    updated: "2d ago",
  },
  {
    id: "flaky-ci-v1",
    label: "flaky-ci-v1",
    cases: 156,
    source: "production · curated",
    updated: "1w ago",
  },
  {
    id: "billing-edge-v3",
    label: "billing-edge-cases-v3",
    cases: 274,
    source: "synthesized",
    updated: "6d ago",
  },
  {
    id: "long-loops-v1",
    label: "long-research-loops-v1",
    cases: 67,
    source: "production · curated",
    updated: "3w ago",
  },
];

/* ── Library graders ───────────────────────────────────────── */

export const BACKTEST_LIBRARY_GRADERS: readonly Omit<
  BacktestGrader,
  "weight" | "source"
>[] = [
  {
    id: "g_outcome",
    label: "Outcome matches expected",
    kind: "rubric",
    evidence: "String-match outcome label to labeled expected value.",
  },
  {
    id: "g_policy",
    label: "No policy violations",
    kind: "classifier",
    evidence: "LLM grader on PII / refund limits / escalation rules.",
  },
  {
    id: "g_latency",
    label: "p95 latency < 15s",
    kind: "metric",
    evidence: "Threshold on total response time.",
  },
  {
    id: "g_similarity",
    label: "Response ≈ golden answer",
    kind: "embedding",
    evidence: "Cosine similarity to labeled answer, min 0.78.",
  },
  {
    id: "g_tools",
    label: "Expected tool called",
    kind: "assertion",
    evidence: "Tool call sequence must include expected verbs.",
  },
];

/* ── Metrics (baseline vs candidates) ──────────────────────── */

export const BACKTEST_METRICS: readonly BacktestMetric[] = [
  {
    id: "resolve",
    label: "Resolution rate",
    unit: "%",
    baseline: 78.2,
    higher: true,
    rows: {
      "support-v4.0": 83.4,
      "support-v4.1": 81.9,
      "support-v4.2": 85.1,
    },
  },
  {
    id: "escal",
    label: "Escalation rate",
    unit: "%",
    baseline: 12.4,
    higher: false,
    rows: {
      "support-v4.0": 9.1,
      "support-v4.1": 10.4,
      "support-v4.2": 6.8,
    },
  },
  {
    id: "fail",
    label: "Failure rate",
    unit: "%",
    baseline: 3.6,
    higher: false,
    rows: {
      "support-v4.0": 2.8,
      "support-v4.1": 2.2,
      "support-v4.2": 4.1,
    },
  },
  {
    id: "csat",
    label: "CSAT proxy",
    unit: "/5",
    baseline: 4.14,
    higher: true,
    rows: {
      "support-v4.0": 4.31,
      "support-v4.1": 4.27,
      "support-v4.2": 4.38,
    },
  },
  {
    id: "p50",
    label: "p50 latency",
    unit: "s",
    baseline: 6.8,
    higher: false,
    rows: {
      "support-v4.0": 5.9,
      "support-v4.1": 7.2,
      "support-v4.2": 9.4,
    },
  },
  {
    id: "p95",
    label: "p95 latency",
    unit: "s",
    baseline: 18.4,
    higher: false,
    rows: {
      "support-v4.0": 16.1,
      "support-v4.1": 19.8,
      "support-v4.2": 27.2,
    },
  },
  {
    id: "cost",
    label: "Cost / trace",
    unit: "¢",
    baseline: 1.82,
    higher: false,
    rows: {
      "support-v4.0": 1.78,
      "support-v4.1": 2.11,
      "support-v4.2": 3.44,
    },
  },
  {
    id: "policy",
    label: "Policy violations",
    unit: "‱",
    baseline: 7,
    higher: false,
    rows: {
      "support-v4.0": 4,
      "support-v4.1": 3,
      "support-v4.2": 6,
    },
  },
  {
    id: "tools",
    label: "Tool-call precision",
    unit: "%",
    baseline: 91.2,
    higher: true,
    rows: {
      "support-v4.0": 93.7,
      "support-v4.1": 94.1,
      "support-v4.2": 89.8,
    },
  },
];

/* ── Seeded sparkline generator ────────────────────────────── */

function mulberry32(seed: number) {
  return function next() {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build a deterministic random walk of `n` points anchored at
 *  `mean` with a per-step `drift`. */
export function backtestSparkline(
  seed: number,
  mean: number,
  drift: number,
  n = 24,
): number[] {
  const rnd = mulberry32(seed);
  const out: number[] = [];
  let v = mean;
  for (let i = 0; i < n; i++) {
    v += (rnd() - 0.5) * drift * 0.5 + (rnd() - 0.5) * drift * 0.15;
    out.push(v);
  }
  return out;
}

/* ── Divergences ───────────────────────────────────────────── */

export const BACKTEST_DIVERGENCES: readonly BacktestDivergence[] = [
  {
    id: "tr_186ac",
    prompt: "tests pass locally but fail in CI on the user-service repo",
    cluster: "Flaky CI detect",
    hue: "var(--c-event-violet)",
    baseline: {
      outcome: "resolved",
      turns: 12,
      latency: "2m 48s",
      verdict: "suggested rerun — user accepted",
    },
    candidate: {
      label: "support-v4.2",
      outcome: "pr_opened",
      turns: 22,
      latency: "4m 08s",
      verdict: "opened PR with parallel-safe fixture fix",
    },
    delta: "regression",
    severity: "high",
    grader: "g_tools",
    note: "Candidate took a different tool path — read CI logs before suggesting rerun, then opened PR. Longer but higher-value outcome.",
  },
  {
    id: "tr_186b1",
    prompt: "my team's invoice PDF shows the wrong billing address",
    cluster: "Escalate w/ tool",
    hue: "var(--c-event-orange)",
    baseline: {
      outcome: "escalated",
      turns: 6,
      latency: "18.0s",
      verdict: "escalated to human after 2 tool retries",
    },
    candidate: {
      label: "support-v4.1",
      outcome: "resolved",
      turns: 4,
      latency: "11.2s",
      verdict: "used update_billing_address tool directly",
    },
    delta: "improvement",
    severity: "high",
    grader: "g_outcome",
    note: "Baseline escalated unnecessarily. Candidate recognized the PDF path and resolved without a human.",
  },
  {
    id: "tr_186b9",
    prompt: "cancel my plan and refund last month",
    cluster: "Refund → resolve",
    hue: "var(--c-event-teal)",
    baseline: {
      outcome: "resolved",
      turns: 3,
      latency: "6.2s",
      verdict: "refunded $49 as requested",
    },
    candidate: {
      label: "support-v4.2",
      outcome: "partial",
      turns: 7,
      latency: "21.3s",
      verdict: "refunded only pro-rata, cited new policy",
    },
    delta: "regression",
    severity: "medium",
    grader: "g_policy",
    note: "Candidate applied new refund policy rubric. Policy-correct but CSAT risk. Worth a human review.",
  },
  {
    id: "tr_186c2",
    prompt: "swap date helpers to Temporal across the monorepo",
    cluster: "Refactor suggest",
    hue: "var(--c-event-violet)",
    baseline: {
      outcome: "pr_opened",
      turns: 14,
      latency: "2m 40s",
      verdict: "opened draft PR for /auth only",
    },
    candidate: {
      label: "support-v4.0",
      outcome: "pr_opened",
      turns: 19,
      latency: "3m 22s",
      verdict: "opened PRs across 4 packages",
    },
    delta: "improvement",
    severity: "low",
    grader: "g_similarity",
    note: "Broader scope. Both correct but candidate matched the user intent better.",
  },
  {
    id: "tr_186c7",
    prompt: "summarize current state of post-training 2026",
    cluster: "Research synth",
    hue: "var(--c-event-amber)",
    baseline: {
      outcome: "resolved",
      turns: 9,
      latency: "38.1s",
      verdict: "cited 6 sources, 2 blog posts",
    },
    candidate: {
      label: "support-v4.2",
      outcome: "resolved",
      turns: 14,
      latency: "1m 04s",
      verdict: "cited 11 sources, all peer-reviewed",
    },
    delta: "improvement",
    severity: "medium",
    grader: "g_similarity",
    note: "Higher source quality, longer latency. Grader approves.",
  },
  {
    id: "tr_186d1",
    prompt: "find the pricing for Opus via the docs",
    cluster: "Stale doc crawl",
    hue: "var(--c-event-red)",
    baseline: {
      outcome: "failed",
      turns: 11,
      latency: "55.3s",
      verdict: "docs crawler returned 404 chain",
    },
    candidate: {
      label: "support-v4.1",
      outcome: "resolved",
      turns: 6,
      latency: "19.4s",
      verdict: "fell back to cached doc snapshot",
    },
    delta: "improvement",
    severity: "high",
    grader: "g_outcome",
    note: "Candidate handled doc-crawl failure gracefully.",
  },
  {
    id: "tr_186d6",
    prompt: "open PR to add dark mode to marketing site",
    cluster: "PR → merged",
    hue: "var(--c-event-green)",
    baseline: {
      outcome: "merged",
      turns: 14,
      latency: "2m 40s",
      verdict: "shipped in 1 PR",
    },
    candidate: {
      label: "support-v4.2",
      outcome: "merged",
      turns: 16,
      latency: "3m 11s",
      verdict: "added a11y audit step",
    },
    delta: "neutral",
    severity: "low",
    grader: "g_similarity",
    note: "Both merged, candidate added extra thoroughness.",
  },
  {
    id: "tr_186e0",
    prompt: "why is my team being charged for deleted seats?",
    cluster: "Refund → escalate",
    hue: "var(--c-event-orange)",
    baseline: {
      outcome: "escalated",
      turns: 4,
      latency: "12.4s",
      verdict: "escalated for manual audit",
    },
    candidate: {
      label: "support-v4.0",
      outcome: "resolved",
      turns: 5,
      latency: "14.8s",
      verdict: "applied pro-rate refund tool",
    },
    delta: "improvement",
    severity: "high",
    grader: "g_outcome",
    note: "Resolved autonomously with the new billing-tools context.",
  },
];

/* ── Live trace feed (Running stage) ───────────────────────── */

const LIVE_PROMPTS: readonly Omit<BacktestLiveCase, "status" | "durationSec" | "agentId">[] = [
  { id: "tr_6a1", cluster: "Refund → escalate",  prompt: "charged twice for pro plan — refund?",          ts: "09:42:11" },
  { id: "tr_6a2", cluster: "Flaky CI detect",    prompt: "tests pass locally, fail in CI",                ts: "09:42:08" },
  { id: "tr_6a3", cluster: "Refund → resolve",   prompt: "cancel and refund last month",                  ts: "09:42:04" },
  { id: "tr_6a4", cluster: "Research synth",     prompt: "summarize post-training 2026 with citations",   ts: "09:41:58" },
  { id: "tr_6a5", cluster: "Escalate w/ tool",   prompt: "invoice PDF shows wrong billing address",       ts: "09:41:51" },
  { id: "tr_6a6", cluster: "Refactor suggest",   prompt: "split packages/auth into smaller modules",      ts: "09:41:47" },
  { id: "tr_6a7", cluster: "Stale doc crawl",    prompt: "find pricing for Opus via the docs",            ts: "09:41:40" },
  { id: "tr_6a8", cluster: "Long research loop", prompt: "compare model cards across providers",          ts: "09:41:34" },
];

const LIVE_STATUS_CYCLE: readonly BacktestLiveCase["status"][] = [
  "pass", "pass", "pass", "pass", "mixed", "pass", "fail", "pass", "pass", "running",
];

/** Build a deterministic stream of `count` live cases for the
 *  Running screen feed. The first 3 rows are always `running` so the
 *  spinner indicators read as live activity. */
export function buildLiveFeed(
  count: number,
  candidateIds: readonly string[],
): BacktestLiveCase[] {
  const rnd = mulberry32(0x9e3779b9);
  const rows: BacktestLiveCase[] = [];
  for (let i = 0; i < count; i++) {
    const c = LIVE_PROMPTS[i % LIVE_PROMPTS.length]!;
    const status = i < 3 ? "running" : LIVE_STATUS_CYCLE[i % LIVE_STATUS_CYCLE.length]!;
    const dur = Number((2.1 + rnd() * 8).toFixed(1));
    const agentId = candidateIds[(i + 1) % candidateIds.length]!;
    rows.push({
      id: `${c.id}_${i.toString(16)}`,
      cluster: c.cluster,
      prompt: c.prompt,
      ts: c.ts,
      status,
      durationSec: dur,
      agentId,
    });
  }
  return rows;
}

/* ── Proposed graders (driven by the data tray) ────────────── */

/** Build the list of graders the system *proposes* given a recipe's
 *  data tray. Proposals carry a confidence score and a 3-row
 *  preview — see GraderBuilder's "Proposed" tab. */
export function buildProposedGraders(data: BacktestRecipe["data"]): readonly BacktestProposedGrader[] {
  const hasLabels = data.kind === "dataset" || data.sources.some((s) => s.kind === "dataset");
  const traces = data.sources.reduce((acc, s) => acc + (s.count || 0), 0);
  const clusters = new Set<string>();
  for (const s of data.sources) {
    for (const c of s.filters?.clusters ?? []) clusters.add(c);
  }
  const hasRefund = Array.from(clusters).some((c) => /refund|escalate/i.test(c));

  const list: BacktestProposedGrader[] = [];

  if (hasLabels || clusters.size > 0) {
    list.push({
      id: "g_outcome",
      kind: "rubric",
      label: "Outcome matches labeled value",
      weight: "high",
      confidence: 0.98,
      evidence: hasLabels
        ? "dataset has labeled outcomes for every case"
        : `${Math.round(traces * 0.92).toLocaleString()} of ${traces.toLocaleString()} traces have outcome labels (resolved, escalated, failed, pr_opened).`,
      preview: [
        { case: "tr_186b1", baseline: "escalated", expected: "resolved", pass: false },
        { case: "tr_186e0", baseline: "escalated", expected: "escalated", pass: true },
        { case: "tr_186b9", baseline: "resolved", expected: "resolved", pass: true },
      ],
    });
  }

  if (hasRefund) {
    list.push({
      id: "g_policy",
      kind: "classifier",
      label: "No policy violations",
      weight: "high",
      confidence: 0.91,
      evidence:
        "found refund-policy.md in your repo. chronicle extracted 14 rules (max $200 refund, requires auth, no double refunds).",
      preview: [
        { case: "tr_186b9", baseline: "refund $49", judgment: "pro-rata required — violation", pass: false },
        { case: "tr_186e0", baseline: "pro-rate refund", judgment: "rule #4 satisfied", pass: true },
        { case: "tr_186b1", baseline: "escalate", judgment: "no refund issued — n/a", pass: true },
      ],
    });
  }

  list.push({
    id: "g_latency",
    kind: "metric",
    label: "p95 latency < 15s",
    weight: "med",
    confidence: 0.99,
    evidence: `baseline p95 on these traces is 18.4s · 14 of ${traces.toLocaleString()} cases exceeded 30s.`,
    preview: [
      { case: "tr_186b1", baseline: "18.0s", threshold: "<15s", pass: false },
      { case: "tr_186e0", baseline: "12.4s", threshold: "<15s", pass: true },
      { case: "tr_186b9", baseline: "6.2s", threshold: "<15s", pass: true },
    ],
  });

  list.push({
    id: "g_tools",
    kind: "assertion",
    label: "Expected tool was called",
    weight: "med",
    confidence: 0.84,
    evidence: `14 distinct tools appear in these traces. most common: read_account (412), escalate (203), update_billing_address (187).`,
    preview: [
      { case: "tr_186b1", baseline: "read_account → escalate", expected: "read_account + update_billing_address", pass: false },
      { case: "tr_186e0", baseline: "read_account → pro_rate_refund", expected: "pro_rate_refund", pass: true },
      { case: "tr_186b9", baseline: "refund", expected: "refund", pass: true },
    ],
  });

  if (hasLabels) {
    list.push({
      id: "g_similarity",
      kind: "embedding",
      label: "Response ≈ golden answer",
      weight: "med",
      confidence: 0.88,
      evidence:
        "dataset has golden answers for 412/412 cases · cosine similarity ≥ 0.78 required.",
      preview: [
        { case: "ds_001", baseline: "sim 0.84", threshold: "≥0.78", pass: true },
        { case: "ds_002", baseline: "sim 0.71", threshold: "≥0.78", pass: false },
        { case: "ds_003", baseline: "sim 0.92", threshold: "≥0.78", pass: true },
      ],
    });
  }

  return list;
}

/* ── Environments — seeded refs for the pipeline step ──────── */

/**
 * Lightweight seed of `BacktestEnvironmentRef` values used by the
 * presets and the environment picker step. Keys are referenced by
 * the presets directly. The shape mirrors `SandboxEnvironment` but
 * carries only the identity / snapshot fields the recipe needs.
 */
export const BACKTEST_ENVIRONMENTS_SEED: readonly BacktestEnvironmentRef[] = [
  {
    id: "env_acme_refunds",
    label: "Acme Support Sandbox",
    snapshotId: "snap_refunds_2026_05_04",
    snapshotLabel: "refund-escalations-v2",
    status: "started",
    ephemeral: false,
  },
  {
    id: "env_acme_billing",
    label: "Acme Billing Replay",
    snapshotId: "snap_billing_edge_2026_04_22",
    snapshotLabel: "billing-edge-cases-v3",
    status: "started",
    ephemeral: false,
  },
  {
    id: "env_acme_research",
    label: "Research Web Sandbox",
    snapshotId: "snap_research_2026_05_01",
    snapshotLabel: "long-research-loops-v1",
    status: "stopped",
    ephemeral: false,
  },
];

/** Quick lookup map used by presets. */
const ENV_REFS = {
  refunds: BACKTEST_ENVIRONMENTS_SEED[0]!,
  billing: BACKTEST_ENVIRONMENTS_SEED[1]!,
  research: BACKTEST_ENVIRONMENTS_SEED[2]!,
};

/** Lookup helper used by the env-picker step. */
export function findEnvironmentRef(id: string): BacktestEnvironmentRef | undefined {
  return BACKTEST_ENVIRONMENTS_SEED.find((e) => e.id === id);
}

/* ── Scenario discovery buckets (Enrich step) ──────────────── */

export interface BacktestScenarioBucketMeta {
  id: BacktestScenarioBucket;
  label: string;
  description: string;
  hue: string;
  /** Visual progress glyph variant — mirrors framer prototype. */
  glyph: "filled" | "three-quarter" | "half" | "dotted";
}

export const BACKTEST_SCENARIO_BUCKETS: readonly BacktestScenarioBucketMeta[] = [
  {
    id: "captured",
    label: "Captured",
    description: "from real traces",
    hue: "var(--c-ember)",
    glyph: "filled",
  },
  {
    id: "adjacent",
    label: "Adjacent",
    description: "variations of captured",
    hue: "var(--c-event-violet)",
    glyph: "three-quarter",
  },
  {
    id: "emerging",
    label: "Emerging",
    description: "new patterns in prod",
    hue: "var(--c-event-amber)",
    glyph: "half",
  },
  {
    id: "edge",
    label: "Edge",
    description: "rare / long-tail",
    hue: "var(--c-ink-dim)",
    glyph: "dotted",
  },
];

/** Deterministic catalog of *proposed* discovery scenarios that the
 *  Enrich step lists for the user to accept/decline. Counts are case
 *  totals once accepted. */
export const BACKTEST_DISCOVERY_PROPOSALS: readonly BacktestDataScenario[] = [
  { id: "ds_captured_a",  bucket: "captured", kind: "longTurn",    label: "refund.standard",            count: 234, confidence: 0.96, accepted: true },
  { id: "ds_captured_b",  bucket: "captured", kind: "toolFailure", label: "refund.late_request",        count: 89,  confidence: 0.93, accepted: true },
  { id: "ds_captured_c",  bucket: "captured", kind: "longTurn",    label: "refund.partial",             count: 156, confidence: 0.91, accepted: true },
  { id: "ds_adjacent_a",  bucket: "adjacent", kind: "adversarial", label: "refund.with_promo",          count: 45,  confidence: 0.82, accepted: true },
  { id: "ds_adjacent_b",  bucket: "adjacent", kind: "adversarial", label: "refund.duplicate_charge",    count: 23,  confidence: 0.78, accepted: false },
  { id: "ds_emerging_a",  bucket: "emerging", kind: "longTurn",    label: "refund.subscription_paused", count: 12,  confidence: 0.71, accepted: false },
  { id: "ds_emerging_b",  bucket: "emerging", kind: "toolFailure", label: "refund.bnpl_partial",        count: 7,   confidence: 0.66, accepted: false },
  { id: "ds_edge_a",      bucket: "edge",     kind: "toolFailure", label: "refund.race_condition",      count: 3,   confidence: 0.42, accepted: false },
  { id: "ds_edge_b",      bucket: "edge",     kind: "adversarial", label: "refund.fraud_flagged",       count: 2,   confidence: 0.38, accepted: false },
  { id: "ds_edge_c",      bucket: "edge",     kind: "nonEnglish",  label: "refund.es_locale",           count: 4,   confidence: 0.34, accepted: false },
];

/** Lookup helper for the bucket meta (color, glyph, copy). */
export function bucketMeta(
  bucket: BacktestScenarioBucket,
): BacktestScenarioBucketMeta {
  const meta = BACKTEST_SCENARIO_BUCKETS.find((m) => m.id === bucket);
  if (!meta) throw new Error(`Unknown scenario bucket: ${bucket}`);
  return meta;
}

/* ── Job presets (Phase 1 of Configure) ────────────────────── */

function asAgent(id: string): BacktestAgent {
  const c = findCandidate(id);
  if (!c) throw new Error(`Unknown candidate: ${id}`);
  return c;
}

export const BACKTEST_JOB_PRESETS: readonly BacktestJobPreset[] = [
  {
    id: "replay",
    title: "Replay production",
    sub: "Run prod traffic through every candidate.",
    why: "Skip enrichment — pipe a window of production traces straight through every agent version, side-by-side.",
    icon: "replay",
    hue: "var(--c-event-teal)",
    recipe: {
      mode: "replay",
      agents: [asAgent("support-v3"), asAgent("support-v4.0"), asAgent("support-v4.1")],
      data: {
        kind: "production",
        sources: [
          {
            id: "s1",
            kind: "prod",
            label: "recent prod · 7d",
            count: 482,
            filters: { window: "7d", clusters: ["Refund → escalate", "Escalate w/ tool"] },
          },
        ],
        scenarios: [],
        savedAs: null,
      },
      graders: [
        { id: "g_outcome", kind: "rubric", label: "Outcome matches labeled", weight: "high", source: "proposed", evidence: "482 production traces with outcome labels" },
      ],
      environment: ENV_REFS.refunds,
      name: "replay · prod 7d across versions",
    },
  },
  {
    id: "compare",
    title: "Compare versions",
    sub: "Which of my builds is better?",
    why: "Pick a dataset, enrich it with discovery to fill coverage gaps, then run two or more candidates side-by-side.",
    icon: "compare",
    hue: "var(--c-event-violet)",
    recipe: {
      mode: "compare",
      agents: [asAgent("support-v3"), asAgent("support-v4.0")],
      data: {
        kind: "composed",
        sources: [
          {
            id: "s1",
            kind: "prod",
            label: "recent prod · 7d",
            count: 482,
            filters: { window: "7d", clusters: ["Refund → escalate", "Escalate w/ tool"] },
          },
        ],
        scenarios: [],
        savedAs: null,
      },
      graders: [
        { id: "g_outcome", kind: "rubric", label: "Outcome matches labeled", weight: "high", source: "proposed", evidence: "412 traces have outcome labels" },
        { id: "g_policy", kind: "classifier", label: "No policy violations", weight: "high", source: "proposed", evidence: "matched refund-policy.md in repo" },
      ],
      environment: ENV_REFS.refunds,
      name: "compare v3 vs v4.0",
    },
  },
  {
    id: "regression",
    title: "Check for regressions",
    sub: "Did my change break anything?",
    why: "Replay recent production traffic enriched with adjacent + edge cases — Chronicle surfaces cases whose behaviour changed.",
    icon: "shield",
    hue: "var(--c-event-amber)",
    recipe: {
      mode: "regression",
      agents: [asAgent("support-v3"), asAgent("support-v4.0"), asAgent("support-v4.1")],
      data: {
        kind: "composed",
        sources: [
          {
            id: "s1",
            kind: "prod",
            label: "30d · focused clusters",
            count: 1098,
            filters: {
              window: "30d",
              clusters: ["Refund → escalate", "Escalate w/ tool", "Refund → resolve"],
            },
          },
        ],
        scenarios: [],
        savedAs: null,
      },
      graders: [
        { id: "g_outcome", kind: "rubric", label: "Outcome matches labeled", weight: "high", source: "proposed", evidence: "1,098 traces have outcome labels" },
        { id: "g_policy", kind: "classifier", label: "No policy violations", weight: "high", source: "proposed", evidence: "matched refund-policy.md in repo" },
        { id: "g_tools", kind: "assertion", label: "Expected tool called", weight: "med", source: "proposed", evidence: "14 distinct tools appear in these traces" },
      ],
      environment: ENV_REFS.refunds,
      name: "regression v4 vs prod",
    },
  },
  {
    id: "suite",
    title: "Run a saved suite",
    sub: "Re-run an eval I already built.",
    why: "Use a curated dataset with labeled outcomes. Best for nightly CI or before-you-ship gates.",
    icon: "suite",
    hue: "var(--c-event-violet)",
    recipe: {
      mode: "suite",
      agents: [asAgent("support-v4.0")],
      data: {
        kind: "dataset",
        dataset: "refund-escal-v2",
        datasetLabel: "refund-escalations-v2",
        sources: [{ id: "s1", kind: "dataset", label: "refund-escalations-v2", count: 412 }],
        scenarios: [],
        savedAs: "refund-escalations-v2",
      },
      graders: [
        { id: "g_outcome", kind: "rubric", label: "Outcome matches labeled", weight: "high", source: "dataset", evidence: "from dataset spec" },
        { id: "g_policy", kind: "classifier", label: "No policy violations", weight: "high", source: "dataset", evidence: "from dataset spec" },
        { id: "g_latency", kind: "metric", label: "p95 latency < 15s", weight: "med", source: "dataset", evidence: "from dataset spec" },
        { id: "g_similarity", kind: "embedding", label: "Response ≈ golden answer", weight: "med", source: "dataset", evidence: "from dataset spec" },
        { id: "g_tools", kind: "assertion", label: "Expected tool called", weight: "med", source: "dataset", evidence: "from dataset spec" },
      ],
      environment: ENV_REFS.refunds,
      name: "suite · refund-escalations-v2",
    },
  },
];

/**
 * Hydrate a `BacktestRecipe` from a `BacktestRunSummary` by cloning
 * the matching preset and overlaying the run's specifics (name,
 * agents, environment, dataset hint). Used by the manager when the
 * user opens a previously saved / running run from the list view —
 * the row carries enough metadata to render Configure / Running /
 * Results without fetching the full backend recipe.
 */
export function hydrateRecipeFromRun(
  run: BacktestRunSummary,
): BacktestRecipe {
  const preset = BACKTEST_JOB_PRESETS.find((p) => p.id === run.mode);
  // Fallback to the first preset if `run.mode` is unknown — keeps
  // the type-safe contract (`BacktestRecipe`, not `null`).
  const base = cloneRecipe((preset ?? BACKTEST_JOB_PRESETS[0]!).recipe);

  const agents: BacktestAgent[] = run.agentIds
    .map((id) => findCandidate(id))
    .filter((a): a is BacktestAgent => Boolean(a))
    .map((a, idx) => ({ ...a, role: idx === 0 ? "baseline" : "candidate" }));

  let environment: BacktestEnvironmentRef | undefined = base.environment;
  if (run.environmentLabel) {
    const envByLabel = BACKTEST_ENVIRONMENTS_SEED.find(
      (e) => e.label === run.environmentLabel,
    );
    environment = envByLabel
      ? { ...envByLabel }
      : {
          id: `env_run_${run.id}`,
          label: run.environmentLabel,
          status: "started",
        };
  }

  return {
    ...base,
    name: run.name,
    agents: agents.length > 0 ? agents : base.agents,
    environment,
  };
}

/** Convenience: produce a deep copy of the recipe inside a job preset
 *  so consumers can mutate without poisoning other consumers. */
export function cloneRecipe(recipe: BacktestRecipe): BacktestRecipe {
  return {
    ...recipe,
    agents: [...recipe.agents],
    data: {
      ...recipe.data,
      sources: recipe.data.sources.map((s) => ({ ...s, filters: s.filters ? { ...s.filters, clusters: s.filters.clusters ? [...s.filters.clusters] : undefined } : undefined })),
      scenarios: recipe.data.scenarios.map((s) => ({ ...s })),
    },
    graders: recipe.graders.map((g) => ({ ...g })),
    environment: recipe.environment ? { ...recipe.environment } : undefined,
  };
}

/** Whether a scenario should be counted toward the case total — the
 *  Enrich step toggles `accepted`; legacy composed scenarios omit
 *  the field and are treated as accepted. */
export function isAcceptedScenario(s: BacktestDataScenario): boolean {
  return s.accepted !== false;
}

/** Convenience helper: derive total case count for a recipe. Only
 *  accepted scenarios contribute. */
export function recipeCaseCount(recipe: BacktestRecipe): number {
  const traces = recipe.data.sources.reduce((acc, s) => acc + (s.count || 0), 0);
  const gen = recipe.data.scenarios
    .filter(isAcceptedScenario)
    .reduce((acc, s) => acc + (s.count || 0), 0);
  return traces + gen;
}

/** Convenience helper: count of accepted enrichment scenarios across
 *  all buckets, used by the launch-dock summary. */
export function recipeEnrichmentCount(recipe: BacktestRecipe): number {
  return recipe.data.scenarios.filter(isAcceptedScenario).length;
}

/** Convenience helper: total agent count. */
export function recipeAgentCount(recipe: BacktestRecipe): number {
  return recipe.agents.length;
}

/* ── Pipeline-step completion checks ───────────────────────── */

/**
 * Whether the dataset step has been satisfied for the given recipe.
 * - Replay (`production`) — needs a window-style source.
 * - Suite (`dataset`) — needs a saved dataset id.
 * - Composed — needs at least one trace source.
 */
export function isDatasetStepDone(recipe: BacktestRecipe): boolean {
  const d = recipe.data;
  if (d.kind === "dataset") return Boolean(d.dataset);
  return d.sources.length > 0;
}

/** Whether the enrich step has been touched. Returns true for Replay
 *  by definition (the step is skipped). For other modes we only
 *  require the user has reviewed the proposals — accepting zero is
 *  a valid review outcome. */
export function isEnrichStepDone(recipe: BacktestRecipe): boolean {
  if (recipe.mode === "replay") return true;
  return recipe.data.scenarios.length > 0;
}

/** Whether the environment step has been satisfied. */
export function isEnvironmentStepDone(recipe: BacktestRecipe): boolean {
  return Boolean(recipe.environment?.id);
}

/** Whether the versions step has been satisfied (1+ agent). */
export function isVersionsStepDone(recipe: BacktestRecipe): boolean {
  return recipe.agents.length > 0;
}

/** Whether the recipe is ready to launch — all required steps done. */
export function isRecipeLaunchable(recipe: BacktestRecipe): boolean {
  return (
    isDatasetStepDone(recipe) &&
    isEnrichStepDone(recipe) &&
    isEnvironmentStepDone(recipe) &&
    isVersionsStepDone(recipe)
  );
}

/* ── Recent-runs strip on the Jobs picker ──────────────────── */

export interface BacktestRecentRun {
  id: string;
  name: string;
  hue: string;
  ago: string;
  verdict: string;
}

export const BACKTEST_RECENT_RUNS: readonly BacktestRecentRun[] = [
  {
    id: "rr_1",
    name: "support-v4 · refund regression",
    hue: "var(--c-event-teal)",
    ago: "2h ago",
    verdict: "v4.0 won",
  },
  {
    id: "rr_2",
    name: "nightly · refund-escalations-v2",
    hue: "var(--c-event-violet)",
    ago: "18h ago",
    verdict: "clean",
  },
];

/* ── List view fixture (BacktestsList) ─────────────────────── */

/** Mock seed of run rows shown on the manager landing page. Mixes
 *  done / running / scheduled / draft so all status branches render
 *  in stories. Wire to the backend run registry when available. */
export const BACKTEST_RUNS_SEED: readonly BacktestRunSummary[] = [
  {
    id: "run_186ac0",
    name: "regression v4 vs prod · 30d",
    mode: "regression",
    status: "done",
    updatedAt: "2026-05-04T08:42:00Z",
    datasetLabel: "prod · 30d focused clusters",
    environmentLabel: "Acme Support Sandbox",
    agentIds: ["support-v3", "support-v4.0", "support-v4.1"],
    totalRuns: 3294,
    verdict: "v4.0 won · 6 regressions held",
    hue: "var(--c-event-amber)",
    divergences: 184,
    owner: "ernesto",
  },
  {
    id: "run_186ab8",
    name: "compare v3 vs v4.0 · refunds",
    mode: "compare",
    status: "running",
    updatedAt: "2026-05-04T11:02:00Z",
    datasetLabel: "refund-escalations-v2",
    environmentLabel: "Acme Support Sandbox",
    agentIds: ["support-v3", "support-v4.0"],
    totalRuns: 824,
    hue: "var(--c-event-teal)",
    owner: "alex",
  },
  {
    id: "run_186aa1",
    name: "replay · prod 7d across versions",
    mode: "replay",
    status: "done",
    updatedAt: "2026-05-04T03:14:00Z",
    datasetLabel: "prod · 7d",
    environmentLabel: "Acme Support Sandbox",
    agentIds: ["support-v3", "support-v4.0", "support-v4.1"],
    totalRuns: 1446,
    verdict: "v4.1 led on resolution; v3 cheapest",
    hue: "var(--c-event-teal)",
    divergences: 92,
    owner: "alex",
  },
  {
    id: "run_18699e",
    name: "nightly · refund-escalations-v2",
    mode: "suite",
    status: "scheduled",
    updatedAt: "2026-05-03T22:00:00Z",
    scheduledFor: "2026-05-05T07:00:00Z",
    datasetLabel: "refund-escalations-v2",
    environmentLabel: "Acme Support Sandbox",
    agentIds: ["support-v4.0"],
    hue: "var(--c-event-violet)",
    owner: "alerts",
  },
  {
    id: "run_186997",
    name: "billing-edge regression",
    mode: "regression",
    status: "failed",
    updatedAt: "2026-05-02T16:48:00Z",
    datasetLabel: "billing-edge-cases-v3",
    environmentLabel: "Acme Billing Replay",
    agentIds: ["support-v4.0", "support-v4.2"],
    totalRuns: 548,
    verdict: "v4.2 over-refund regression",
    hue: "var(--c-event-red)",
    divergences: 41,
    owner: "ernesto",
  },
  {
    id: "run_186984",
    name: "draft · suite refund-escalations-v3",
    mode: "suite",
    status: "draft",
    updatedAt: "2026-05-04T10:31:00Z",
    datasetLabel: "refund-escalations-v3 (proposed)",
    environmentLabel: "Acme Support Sandbox",
    agentIds: ["support-v4.0"],
    hue: "var(--c-event-violet)",
    owner: "alex",
  },
];

/* ── Production trace clusters (DataBuilder · Prod tab) ─────── */

export interface BacktestClusterOption {
  id: string;
  label: string;
  count: number;
  hue: string;
}

export const BACKTEST_CLUSTER_OPTIONS: readonly BacktestClusterOption[] = [
  { id: "refund-esc", label: "Refund → escalate", count: 312, hue: "var(--c-event-orange)" },
  { id: "refund-res", label: "Refund → resolve", count: 584, hue: "var(--c-event-teal)" },
  { id: "esc-tool", label: "Escalate w/ tool", count: 218, hue: "var(--c-event-orange)" },
  { id: "flaky-ci", label: "Flaky CI detect", count: 147, hue: "var(--c-event-violet)" },
  { id: "refactor", label: "Refactor suggest", count: 89, hue: "var(--c-event-violet)" },
  { id: "stale-doc", label: "Stale doc crawl", count: 76, hue: "var(--c-event-red)" },
  { id: "research", label: "Research synth", count: 112, hue: "var(--c-event-amber)" },
  { id: "pr-merged", label: "PR → merged", count: 203, hue: "var(--c-event-green)" },
];

/* ── Scenario expansion moves (DataBuilder · Gen tab) ──────── */

export interface BacktestScenarioMove {
  key: "adversarial" | "nonEnglish" | "toolFailure" | "longTurn";
  label: string;
  sub: string;
  max: number;
  hue: string;
}

export const BACKTEST_SCENARIO_MOVES: readonly BacktestScenarioMove[] = [
  { key: "adversarial", label: "Adversarial phrasings", sub: "rude, manipulative, jailbreak attempts", max: 80, hue: "var(--c-event-red)" },
  { key: "nonEnglish", label: "Non-English variants", sub: "translate seeds to ES, FR, JA, DE", max: 60, hue: "var(--c-event-violet)" },
  { key: "toolFailure", label: "Tool-failure scenarios", sub: "inject 500s, timeouts, malformed returns", max: 40, hue: "var(--c-event-orange)" },
  { key: "longTurn", label: "Long multi-turn dialogs", sub: "10-20 turn conversations with context", max: 30, hue: "var(--c-event-teal)" },
];
