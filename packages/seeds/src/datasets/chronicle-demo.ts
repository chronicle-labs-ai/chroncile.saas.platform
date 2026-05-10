/*
 * Chronicle-demo datasets seed.
 *
 * Two datasets composed from the same `billing-agent` traces:
 *
 *   - "Production traces · last 7 days"  (eval) — all 7 traces
 *   - "Replay corpus · billing flow"     (replay) — same 7, frozen
 *
 * Trace ids match the agents/runs seed, so the dataset detail
 * page's Timeline tab and the agent's run drawer point at the same
 * conversations.
 *
 * Failed traces carry the Chronicle flag verdict copy verbatim in
 * `TraceSummary.note` so the dataset row literally renders the
 * "Chronicle flag: …" message that the demo script reads aloud.
 */

import {
  DatasetSchema,
  DatasetSnapshotSchema,
} from "chronicle/schemas/datasets";
import type {
  Dataset,
  DatasetCluster,
  DatasetSimilarityEdge,
  DatasetSnapshot,
  TraceSummary,
} from "chronicle/types/datasets";
import { z } from "zod";

import { validateInDev } from "../_validate";
import {
  CHRONICLE_DEMO_ANCHOR_MS,
  CHRONICLE_DEMO_TRACES,
  materializeAllEvents,
  materializeTraceEvents,
  type ChronicleDemoTrace,
} from "../_scenarios/chronicle-demo";
import type { DatasetsSeed, DatasetsSeedData } from "./types";

const DatasetListSchema = z.array(DatasetSchema);
const DatasetSnapshotMapSchema = z.record(DatasetSnapshotSchema);

const ANCHOR = CHRONICLE_DEMO_ANCHOR_MS;
const iso = (offsetMin: number) =>
  new Date(ANCHOR - offsetMin * 60_000).toISOString();

/* ── Cluster catalog ─────────────────────────────────── */

const CLUSTER_PASSING: DatasetCluster = {
  id: "cl_billing_passing",
  label: "Happy path",
  color: "var(--c-event-teal)",
  traceIds: [],
  description:
    "Cancellations, refunds, and plan changes that completed cleanly within policy.",
};
const CLUSTER_UNAUTHORIZED: DatasetCluster = {
  id: "cl_billing_flagged_unauthorized",
  label: "Flag · unauthorized cancel",
  color: "var(--c-event-amber)",
  traceIds: [],
  description:
    "Agent issued a billing change without verifying the requester is the billing admin.",
};
const CLUSTER_OVER_REFUND: DatasetCluster = {
  id: "cl_billing_flagged_over_refund",
  label: "Flag · over-refund",
  color: "var(--c-event-pink)",
  traceIds: [],
  description:
    "Agent issued a refund that exceeded the refund policy ceiling.",
};
const CLUSTER_MISMATCH: DatasetCluster = {
  id: "cl_billing_flagged_mismatch",
  label: "Flag · cross-system mismatch",
  color: "var(--c-event-violet)",
  traceIds: [],
  description:
    "Stripe, Salesforce, and the product DB disagreed; agent reported resolution anyway.",
};

function clusterIdFor(scenario: ChronicleDemoTrace["scenario"]): string {
  switch (scenario) {
    case "unauthorized-cancel":
      return CLUSTER_UNAUTHORIZED.id;
    case "over-refund":
      return CLUSTER_OVER_REFUND.id;
    case "state-mismatch":
      return CLUSTER_MISMATCH.id;
    case "cancel-billing-admin":
    case "double-charge-refund":
    case "plan-change":
    case "in-policy-refund":
    default:
      return CLUSTER_PASSING.id;
  }
}

/* ── Trace summary materialiser ──────────────────────── */

function traceSummary(trace: ChronicleDemoTrace): TraceSummary {
  const startMs = ANCHOR - trace.startMinutesBack * 60_000;
  const sources = Array.from(new Set(trace.events.map((e) => e.source)));
  const summary: TraceSummary = {
    traceId: trace.traceId,
    label: trace.label,
    primarySource: "intercom",
    sources,
    eventCount: trace.events.length,
    startedAt: new Date(startMs).toISOString(),
    durationMs: trace.durationMs,
    status: trace.status,
    clusterId: clusterIdFor(trace.scenario),
    addedAt: iso(trace.startMinutesBack - 5),
    addedBy: "billing-agent",
  };
  if (trace.flag) summary.note = trace.flag.note;
  return summary;
}

function attachClusters(traces: readonly TraceSummary[]): DatasetCluster[] {
  const buckets = new Map<string, string[]>();
  for (const t of traces) {
    if (!t.clusterId) continue;
    const list = buckets.get(t.clusterId) ?? [];
    list.push(t.traceId);
    buckets.set(t.clusterId, list);
  }
  const seeded = [
    CLUSTER_PASSING,
    CLUSTER_UNAUTHORIZED,
    CLUSTER_OVER_REFUND,
    CLUSTER_MISMATCH,
  ];
  return seeded
    .map((c) => ({ ...c, traceIds: buckets.get(c.id) ?? [] }))
    .filter((c) => c.traceIds.length > 0);
}

/* ── Datasets + snapshots ─────────────────────────────── */

function makeDataset(
  id: string,
  name: string,
  purpose: Dataset["purpose"],
  description: string,
  traces: readonly ChronicleDemoTrace[],
  tags: readonly string[],
): Dataset {
  return {
    id,
    name,
    description,
    purpose,
    traceCount: traces.length,
    eventCount: traces.reduce((acc, t) => acc + t.events.length, 0),
    updatedAt: iso(0),
    createdBy: "naomi@chronicle.io",
    tags: [...tags],
  };
}

function makeSnapshot(
  dataset: Dataset,
  selected: readonly ChronicleDemoTrace[],
): DatasetSnapshot {
  const summaries = selected.map(traceSummary);
  const events = selected.flatMap(materializeTraceEvents).sort(
    (a, b) =>
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );
  const clusters = attachClusters(summaries);
  /* Edges connect traces inside the same cluster to surface
     "the agent makes this same mistake repeatedly" affinity in
     the dataset's similarity graph. */
  const edges: DatasetSimilarityEdge[] = [];
  for (let i = 0; i < summaries.length; i += 1) {
    for (let j = i + 1; j < summaries.length; j += 1) {
      if (summaries[i].clusterId === summaries[j].clusterId) {
        edges.push({
          fromTraceId: summaries[i].traceId,
          toTraceId: summaries[j].traceId,
          weight: 0.7,
        });
      }
    }
  }
  return { dataset, traces: summaries, clusters, edges, events };
}

const PROD_DATASET = makeDataset(
  "ds_chronicle_demo_prod",
  "Production traces · last 7 days",
  "eval",
  "Live customer billing conversations the billing-agent handled. 4 pass cleanly; 3 were flagged by Chronicle for unauthorized changes, refund-policy violations, or cross-system mismatches.",
  CHRONICLE_DEMO_TRACES,
  ["billing-agent", "production"],
);
const REPLAY_DATASET = makeDataset(
  "ds_chronicle_demo_replay",
  "Replay corpus · billing flow",
  "replay",
  "The same seven conversations frozen for replay. Lets us test new billing-agent versions against the exact production situations Chronicle flagged before promoting them.",
  CHRONICLE_DEMO_TRACES,
  ["billing-agent", "replay"],
);

const DATASETS: Dataset[] = [PROD_DATASET, REPLAY_DATASET];

const SNAPSHOTS_BY_ID: Record<string, DatasetSnapshot> = {
  [PROD_DATASET.id]: makeSnapshot(PROD_DATASET, CHRONICLE_DEMO_TRACES),
  [REPLAY_DATASET.id]: makeSnapshot(REPLAY_DATASET, CHRONICLE_DEMO_TRACES),
};

/* Sanity: surface unused if `materializeAllEvents` becomes orphan. */
void materializeAllEvents;

/* ── Seed factory ────────────────────────────────────── */

export const chronicleDemoDatasetsSeed: DatasetsSeed = {
  id: "chronicle-demo",
  label: "Chronicle demo (billing)",
  description:
    "2 datasets — production eval (7 traces) and the same set frozen as a replay corpus. 3 traces carry Chronicle flag verdicts.",
  build(): DatasetsSeedData {
    const datasets = structuredClone(DATASETS) as Dataset[];
    const snapshotsById = structuredClone(SNAPSHOTS_BY_ID) as Record<
      string,
      DatasetSnapshot
    >;
    validateInDev(
      DatasetListSchema,
      datasets,
      "datasets:chronicle-demo datasets",
    );
    validateInDev(
      DatasetSnapshotMapSchema,
      snapshotsById,
      "datasets:chronicle-demo snapshotsById",
    );
    return { datasets, snapshotsById };
  },
};
