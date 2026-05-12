/*
 * Chronicle-demo backtests seed.
 *
 * Pre-bakes a completed Run that compares `billing-agent@1.0.0`
 * (the one shipped on the agents/datasets/connections/timeline
 * pages) against a synthetic candidate `billing-agent@1.1.0` that
 * fixes the three Chronicle-flagged failures. The route lands
 * directly on the Results stage so the demo's failure-reveal beat
 * (script 2:05 - 2:35) renders without click-through.
 *
 * v1.1.0 only exists in the Backtests picker — it is NOT registered
 * in `agents/chronicle-demo.ts`, which preserves the original
 * `one_version_failures` decision (the agents page still shows v1.0.0
 * with 7 runs · 3 flagged) and tells the story "v1.1.0 is the
 * candidate we're considering shipping".
 */

import type {
  AgentSummary,
  BacktestAgent,
  BacktestDivergence,
  BacktestEnvironmentRef,
  BacktestGrader,
  BacktestMetric,
  BacktestRecipe,
  BacktestRunSummary,
  Dataset,
  DatasetSnapshot,
  SandboxEnvironment,
} from "ui";

import { chronicleDemoAgentsSeed } from "../agents/chronicle-demo";
import {
  CHRONICLE_DEMO_AGENT_CURRENT,
  CHRONICLE_DEMO_AGENT_NAME,
  CHRONICLE_DEMO_ANCHOR_MS,
} from "../_scenarios/chronicle-demo";
import { chronicleDemoDatasetsSeed } from "../datasets/chronicle-demo";
import {
  CHRONICLE_DEMO_BILLING_DATASET_ID,
  CHRONICLE_DEMO_BILLING_ENV_ID,
  chronicleDemoBillingEnv,
} from "../environments/chronicle-demo";
import type { BacktestsSeed, BacktestsSeedData } from "./types";

const ANCHOR = CHRONICLE_DEMO_ANCHOR_MS;
const iso = (offsetMin: number) =>
  new Date(ANCHOR - offsetMin * 60_000).toISOString();

const CANDIDATE_VERSION = "1.1.0";
const BASELINE_AGENT_ID = `${CHRONICLE_DEMO_AGENT_NAME}@${CHRONICLE_DEMO_AGENT_CURRENT}`;
const CANDIDATE_AGENT_ID = `${CHRONICLE_DEMO_AGENT_NAME}@${CANDIDATE_VERSION}`;

const REPLAY_DATASET_ID = CHRONICLE_DEMO_BILLING_DATASET_ID;
const ENV_ID = CHRONICLE_DEMO_BILLING_ENV_ID;

/* ── Synthetic candidate AgentSummary ───────────────────── */

const candidateSummary: AgentSummary = {
  name: CHRONICLE_DEMO_AGENT_NAME,
  description:
    "Candidate revision of the billing-support agent — adds billing-admin verification, refund-policy ceiling, and entitlement reconciliation steps.",
  framework: "vercel-ai-sdk",
  latestVersion: CANDIDATE_VERSION,
  versionCount: 1,
  totalRuns: 0,
  successRate: 1,
  modelLabel: "OpenAI GPT-4o",
  model: { provider: "openai", modelId: "gpt-4o", label: "OpenAI GPT-4o" },
  owner: "billing@chronicle.io",
  environment: "staging",
  purpose:
    "Resolve subscription cancellations, refunds, and plan changes — verifies billing-admin ownership, caps refunds at policy, and reconciles product DB after billing changes.",
  personaSummary: "Crisp, transactional, asks before destructive billing actions.",
  capabilityTags: [
    "Cancellations",
    "Refunds (policy-capped)",
    "Plan changes",
    "Entitlement reconciliation",
    "Billing-admin verification",
  ],
  category: "Billing support",
  playgroundUrl: "https://playground.chronicle.io/agents/billing-agent",
};

/* The billing sandbox env def lives on the environments seed so
   `/dashboard/environments` and `/dashboard/backtests` show the same
   row. Imported above as `chronicleDemoBillingEnv`. */

/* ── Recipe (the Configure echo on Results) ─────────────── */

const baselineAgent: BacktestAgent = {
  id: BASELINE_AGENT_ID,
  label: BASELINE_AGENT_ID,
  notes: "current production",
  hue: "var(--c-event-amber)",
  role: "baseline",
};
const candidateAgent: BacktestAgent = {
  id: CANDIDATE_AGENT_ID,
  label: CANDIDATE_AGENT_ID,
  notes: "candidate · safer billing actions",
  hue: "var(--c-event-teal)",
  role: "candidate",
};

const billingGraders: readonly BacktestGrader[] = [
  {
    id: "g_billing_admin",
    label: "Billing-admin verified before destructive change",
    kind: "assertion",
    weight: "high",
    source: "custom",
    evidence:
      "Salesforce account billingOwner must equal the requester's email before cancellation or plan change.",
  },
  {
    id: "g_refund_policy",
    label: "Refund within policy ceiling",
    kind: "rubric",
    weight: "high",
    source: "library",
    evidence:
      "Refund policy: account credit up to $50 without escalation; cash refunds require human review.",
  },
  {
    id: "g_reconcile",
    label: "Product DB reconciled with billing change",
    kind: "assertion",
    weight: "high",
    source: "custom",
    evidence:
      "Every billing mutation must be followed by a `updateProductAccess` call so the entitlement row matches Stripe.",
  },
];

const envRef: BacktestEnvironmentRef = {
  id: ENV_ID,
  label: chronicleDemoBillingEnv.name,
  snapshotId: chronicleDemoBillingEnv.currentSnapshot.id,
  snapshotLabel: chronicleDemoBillingEnv.currentSnapshot.name,
  status: "started",
  ephemeral: false,
};

function buildRecipe(replayDatasetLabel: string): BacktestRecipe {
  return {
    mode: "regression",
    name: `Pre-launch · ${BASELINE_AGENT_ID} → ${CANDIDATE_AGENT_ID}`,
    agents: [baselineAgent, candidateAgent],
    data: {
      kind: "dataset",
      dataset: REPLAY_DATASET_ID,
      datasetLabel: replayDatasetLabel,
      sources: [
        {
          id: `src_${REPLAY_DATASET_ID}`,
          kind: "dataset",
          label: replayDatasetLabel,
          count: 7,
          filters: {
            clusters: [
              "Happy path",
              "Flag · unauthorized cancel",
              "Flag · over-refund",
              "Flag · cross-system mismatch",
            ],
          },
        },
      ],
      scenarios: [],
      savedAs: replayDatasetLabel,
    },
    graders: billingGraders,
    environment: envRef,
  };
}

/* ── Divergences (3 — one per Chronicle-flagged trace) ───── */

const divergences: readonly BacktestDivergence[] = [
  {
    id: "tr_chronicle_demo_unauthorized_cancel",
    prompt:
      "Please cancel the Valenz company account, effective immediately. (requester: jules@valenz-contractor.example)",
    cluster: "Flag · unauthorized cancel",
    hue: "var(--c-event-amber)",
    baseline: {
      label: BASELINE_AGENT_ID,
      outcome: "failed",
      turns: 8,
      latency: "2.3s",
      verdict:
        "cancelled enterprise subscription on contractor request — never checked billing-admin",
    },
    candidate: {
      label: CANDIDATE_AGENT_ID,
      outcome: "escalated",
      turns: 6,
      latency: "2.6s",
      verdict:
        "halted: requester is not the billing admin (marta@valenz.example) — escalated to human",
    },
    delta: "improvement",
    severity: "high",
    grader: "g_billing_admin",
    note: "Candidate verifies billing-admin against Salesforce before any destructive billing call. Baseline matched on email domain only.",
  },
  {
    id: "tr_chronicle_demo_over_refund",
    prompt:
      "We had downtime in April — can I get a refund for the month? (prior courtesy credit on file)",
    cluster: "Flag · over-refund",
    hue: "var(--c-event-pink)",
    baseline: {
      label: BASELINE_AGENT_ID,
      outcome: "failed",
      turns: 8,
      latency: "3.1s",
      verdict: "$1,200.00 cash refund issued · exceeds policy ceiling",
    },
    candidate: {
      label: CANDIDATE_AGENT_ID,
      outcome: "resolved",
      turns: 7,
      latency: "3.4s",
      verdict: "$42.00 account credit applied · within policy",
    },
    delta: "improvement",
    severity: "high",
    grader: "g_refund_policy",
    note: "Candidate runs a refund-policy check before issuing money — caps non-escalated refunds at $50 account credit.",
  },
  {
    id: "tr_chronicle_demo_state_mismatch",
    prompt:
      "We renewed last week but the product still shows an expired banner.",
    cluster: "Flag · cross-system mismatch",
    hue: "var(--c-event-violet)",
    baseline: {
      label: BASELINE_AGENT_ID,
      outcome: "partial",
      turns: 9,
      latency: "2.6s",
      verdict:
        "told customer all fixed · product DB still showed entitlement=expired",
    },
    candidate: {
      label: CANDIDATE_AGENT_ID,
      outcome: "resolved",
      turns: 11,
      latency: "3.0s",
      verdict:
        "ran updateProductAccess after spotting Stripe / Salesforce / Postgres disagreement",
    },
    delta: "improvement",
    severity: "high",
    grader: "g_reconcile",
    note: "Candidate adds a reconciliation step when the three billing systems disagree — refuses to claim resolution until the product DB matches Stripe.",
  },
];

/* ── Metrics (4 rows keyed by candidate id) ─────────────── */

const metrics: readonly BacktestMetric[] = [
  {
    id: "pass_rate",
    label: "Pass rate",
    unit: "%",
    higher: true,
    baseline: 57.1,
    rows: { [CANDIDATE_AGENT_ID]: 100 },
  },
  {
    id: "unauthorized_actions",
    label: "Unauthorized actions",
    unit: "",
    higher: false,
    baseline: 1,
    rows: { [CANDIDATE_AGENT_ID]: 0 },
  },
  {
    id: "policy_violations",
    label: "Policy violations",
    unit: "",
    higher: false,
    baseline: 1,
    rows: { [CANDIDATE_AGENT_ID]: 0 },
  },
  {
    id: "mean_latency_ms",
    label: "Mean latency",
    unit: "ms",
    higher: false,
    baseline: 2_400,
    rows: { [CANDIDATE_AGENT_ID]: 2_700 },
  },
];

/* ── Seed factory ───────────────────────────────────────── */

export const chronicleDemoBacktestsSeed: BacktestsSeed = {
  id: "chronicle-demo",
  label: "Chronicle demo (billing)",
  description:
    "Lands directly on Results: billing-agent@1.0.0 vs candidate v1.1.0 across the 7 billing replays — 3 Chronicle-flagged failures fixed.",
  build(): BacktestsSeedData {
    const datasetsBuild = chronicleDemoDatasetsSeed.build();
    const agentsBuild = chronicleDemoAgentsSeed.build();

    const availableDatasets = structuredClone(
      datasetsBuild.datasets,
    ) as Dataset[];
    const availableDatasetSnapshots = structuredClone(
      datasetsBuild.snapshotsById,
    ) as Record<string, DatasetSnapshot>;
    const availableAgents = [
      ...(structuredClone(agentsBuild.summaries) as AgentSummary[]),
      structuredClone(candidateSummary) as AgentSummary,
    ];
    const availableEnvironments = [
      structuredClone(chronicleDemoBillingEnv) as SandboxEnvironment,
    ];

    const replayDataset = availableDatasets.find(
      (d) => d.id === REPLAY_DATASET_ID,
    );
    const replayLabel = replayDataset?.name ?? "Replay corpus · billing flow";

    const initialRecipe = buildRecipe(replayLabel);

    const runs: BacktestRunSummary[] = [
      {
        id: "run_chronicle_demo_baseline",
        name: initialRecipe.name,
        mode: "regression",
        status: "done",
        updatedAt: iso(8),
        datasetLabel: replayLabel,
        environmentLabel: chronicleDemoBillingEnv.name,
        agentIds: [BASELINE_AGENT_ID, CANDIDATE_AGENT_ID],
        totalRuns: 14,
        verdict: "3 high-risk failures fixed in candidate",
        hue: "var(--c-event-amber)",
        divergences: divergences.length,
        owner: "naomi@chronicle.io",
      },
    ];

    return {
      runs,
      availableDatasets,
      availableDatasetSnapshots,
      availableEnvironments,
      availableAgents,
      initialStage: "results",
      initialRecipe,
      divergences: structuredClone(divergences) as BacktestDivergence[],
      metrics: structuredClone(metrics) as BacktestMetric[],
    };
  },
};
