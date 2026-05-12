/*
 * Support-flow datasets seed.
 *
 * Three datasets, each composed of the same `support-agent` traces
 * filtered by purpose:
 *
 *   - "Production traces · last 7 days"  (eval) — all 7 traces
 *   - "Replay corpus · refund flow"      (replay) — refund-related
 *   - "Training · first response"        (training) — clean OK paths
 *
 * Trace ids match the agents/runs seed, so the dataset detail
 * page's Timeline tab and the agent's run drawer point at the same
 * conversations.
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
  SUPPORT_FLOW_ANCHOR_MS,
  SUPPORT_FLOW_TRACES,
  materializeAllEvents,
  materializeTraceEvents,
  selectTraces,
  type SupportFlowTrace,
} from "../_scenarios/support-flow";
import type { DatasetsSeed, DatasetsSeedData } from "./types";

const DatasetListSchema = z.array(DatasetSchema);
const DatasetSnapshotMapSchema = z.record(DatasetSnapshotSchema);

const ANCHOR = SUPPORT_FLOW_ANCHOR_MS;
const iso = (offsetMin: number) =>
  new Date(ANCHOR - offsetMin * 60_000).toISOString();

/* ── Cluster catalog ─────────────────────────────────── */

const CLUSTER_REFUND: DatasetCluster = {
  id: "cl_refund",
  label: "Refund handling",
  color: "var(--c-event-violet)",
  traceIds: [],
  description: "Conversations that ended in a refund decision.",
};
const CLUSTER_LOOKUP: DatasetCluster = {
  id: "cl_lookup",
  label: "Order / FAQ lookup",
  color: "var(--c-event-teal)",
  traceIds: [],
  description: "Reads from Shopify or knowledge — no mutations.",
};
const CLUSTER_ESCALATION: DatasetCluster = {
  id: "cl_escalation",
  label: "Human escalation",
  color: "var(--c-event-amber)",
  traceIds: [],
  description: "Forwarded to #cx-alerts for a human to follow up.",
};
const CLUSTER_SUBSCRIPTION: DatasetCluster = {
  id: "cl_subscription",
  label: "Subscription mgmt",
  color: "var(--c-event-indigo)",
  traceIds: [],
  description: "Cancellations, renewals, billing changes.",
};

function clusterIdFor(scenario: SupportFlowTrace["scenario"]): string {
  switch (scenario) {
    case "refund-success":
    case "multi-step-refund":
      return CLUSTER_REFUND.id;
    case "refund-denied":
    case "missing-order":
      return CLUSTER_ESCALATION.id;
    case "cancel-subscription":
      return CLUSTER_SUBSCRIPTION.id;
    case "order-lookup":
    case "faq":
    default:
      return CLUSTER_LOOKUP.id;
  }
}

/* ── Trace summary materialiser ──────────────────────── */

function traceSummary(trace: SupportFlowTrace): TraceSummary {
  const startMs = ANCHOR - trace.startMinutesBack * 60_000;
  const sources = Array.from(
    new Set(trace.events.map((e) => e.source)),
  );
  return {
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
    addedBy: "support-agent",
  };
}

function attachClusters(
  traces: readonly TraceSummary[],
): DatasetCluster[] {
  const buckets = new Map<string, string[]>();
  for (const t of traces) {
    if (!t.clusterId) continue;
    const list = buckets.get(t.clusterId) ?? [];
    list.push(t.traceId);
    buckets.set(t.clusterId, list);
  }
  const seeded = [
    CLUSTER_REFUND,
    CLUSTER_LOOKUP,
    CLUSTER_ESCALATION,
    CLUSTER_SUBSCRIPTION,
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
  traces: readonly SupportFlowTrace[],
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
    tags: ["support-agent", "production"],
  };
}

function makeSnapshot(
  dataset: Dataset,
  selected: readonly SupportFlowTrace[],
): DatasetSnapshot {
  const summaries = selected.map(traceSummary);
  const events = selected.flatMap(materializeTraceEvents).sort(
    (a, b) =>
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );
  const clusters = attachClusters(summaries);
  /* Edges connect refund traces to each other (similar handling)
     and order-lookup traces to each other. Light affinity, no
     explosion. */
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
  "ds_support_prod_7d",
  "Production traces · last 7 days",
  "eval",
  "Live customer conversations the support-agent handled. Used for daily regression checks.",
  SUPPORT_FLOW_TRACES,
);
const REPLAY_DATASET = makeDataset(
  "ds_support_refund_replay",
  "Replay corpus · refund flow",
  "replay",
  "Refund-related conversations frozen for replay. Lets us test new refund-policy versions before promoting them.",
  selectTraces([
    "refund-success",
    "refund-denied",
    "multi-step-refund",
    "cancel-subscription",
  ]),
);
const TRAINING_DATASET = makeDataset(
  "ds_support_first_response",
  "Training · first response",
  "training",
  "Clean OK paths used as positive examples for first-response SFT batches.",
  selectTraces(["order-lookup", "refund-success", "cancel-subscription", "faq"]),
);

const DATASETS: Dataset[] = [PROD_DATASET, REPLAY_DATASET, TRAINING_DATASET];

const SNAPSHOTS_BY_ID: Record<string, DatasetSnapshot> = {
  [PROD_DATASET.id]: makeSnapshot(PROD_DATASET, SUPPORT_FLOW_TRACES),
  [REPLAY_DATASET.id]: makeSnapshot(
    REPLAY_DATASET,
    selectTraces([
      "refund-success",
      "refund-denied",
      "multi-step-refund",
      "cancel-subscription",
    ]),
  ),
  [TRAINING_DATASET.id]: makeSnapshot(
    TRAINING_DATASET,
    selectTraces(["order-lookup", "refund-success", "cancel-subscription", "faq"]),
  ),
};

/* Sanity: surface unused if `materializeAllEvents` becomes orphan. */
void materializeAllEvents;

/* ── Seed factory ────────────────────────────────────── */

export const supportFlowDatasetsSeed: DatasetsSeed = {
  id: "support-flow",
  label: "Support flow",
  description:
    "3 datasets composed of the same `support-agent` traces — production eval, refund replay corpus, and training first-response set.",
  build(): DatasetsSeedData {
    const datasets = structuredClone(DATASETS) as Dataset[];
    const snapshotsById = structuredClone(SNAPSHOTS_BY_ID) as Record<
      string,
      DatasetSnapshot
    >;
    validateInDev(
      DatasetListSchema,
      datasets,
      "datasets:support-flow datasets",
    );
    validateInDev(
      DatasetSnapshotMapSchema,
      snapshotsById,
      "datasets:support-flow snapshotsById",
    );
    return { datasets, snapshotsById };
  },
};
