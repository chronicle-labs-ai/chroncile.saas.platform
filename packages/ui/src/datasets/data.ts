/*
 * Datasets — deterministic mock seeds for Storybook.
 *
 * Every dot in the graph view represents a *trace* (a multi-event
 * series), not a single event. The seeded RNG keeps stories visually
 * stable across reloads (so VRT snapshots don't churn).
 *
 * Sourcing modes:
 *
 *   "scenarios"  — start from the curated multi-source `TRACE_SCENARIOS`
 *                  in `../stream-timeline/data` (great for the Timeline
 *                  tab where causal chains matter). When the requested
 *                  trace count exceeds the scenario count, we synthesize
 *                  additional multi-event traces below.
 *
 *   "synthetic"  — every trace is generated locally as a 4–15 event
 *                  multi-source sequence with chained parents and
 *                  realistic actor/message variety. Times are
 *                  sequenced within a trace span (~30s–5min).
 *
 * The synthetic generator picks per-cluster source mixes (e.g. the
 * "Billing" cluster favors stripe + intercom, the "API errors"
 * cluster favors github + pagerduty) so the dots in the canvas read
 * as a real production firehose.
 */

import {
  STREAM_TIMELINE_MOCK_ANCHOR_MS,
  TRACE_SCENARIOS,
  datasetsSeed as streamTimelineDatasetsSeed,
  streamTimelineSeed,
} from "../stream-timeline/data";
import type {
  Dataset,
  StreamTimelineEvent,
} from "../stream-timeline/types";

import { clusterColor } from "./cluster-color";
import type {
  DatasetCluster,
  DatasetSimilarityEdge,
  DatasetSnapshot,
  TraceStatus,
  TraceSummary,
} from "./types";

/* ── Public dataset list ───────────────────────────────────── */

const ANCHOR_MS = STREAM_TIMELINE_MOCK_ANCHOR_MS;

export const datasetsManagerSeed: readonly Dataset[] = [
  ...streamTimelineDatasetsSeed,
  {
    id: "ds_eval_v2_draft",
    name: "Eval suite v2 (draft)",
    description:
      "Next-gen regression suite covering multi-source agent flows. Promoted from `Review queue` after sign-off.",
    purpose: "eval",
    traceCount: 0,
    eventCount: 0,
    updatedAt: new Date(ANCHOR_MS - 4 * 60 * 60 * 1000).toISOString(),
    createdBy: "ernesto",
    tags: ["regression", "multi-source"],
  },
  {
    id: "ds_train_support_long",
    name: "Training · Long-tail support",
    description:
      "Tail of low-volume support topics (export, SSO, billing edge cases). Used for SFT diversity batches.",
    purpose: "training",
    traceCount: 0,
    eventCount: 0,
    updatedAt: new Date(ANCHOR_MS - 36 * 60 * 60 * 1000).toISOString(),
    createdBy: "alex",
    tags: ["sft", "longtail"],
  },
];

/* ── RNG + small helpers ───────────────────────────────────── */

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]!;
}

/**
 * Box-Muller transform — turns two uniform `[0, 1)` samples into a
 * standard-normal sample (mean 0, variance 1). We pair this with the
 * per-cluster covariance below to draw points from anisotropic 2D
 * Gaussians, which is what produces the "real UMAP" look.
 */
function gaussianSample(rng: () => number): number {
  // Avoid `Math.log(0)` by clamping away from the boundary.
  let u1 = rng();
  if (u1 < 1e-9) u1 = 1e-9;
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Sample one (x, y) point from an anisotropic 2D Gaussian centred at
 * `(cx, cy)`, with `sigmaX` / `sigmaY` along axes that are then
 * rotated by `rotation` radians. Output stays in normalized `[-1, 1]`
 * embedding space (the canvas rescales to px at render time).
 */
function sampleEllipseGaussian(
  rng: () => number,
  embedding: ClusterEmbedding,
): [number, number] {
  const x0 = gaussianSample(rng) * embedding.sigmaX;
  const y0 = gaussianSample(rng) * embedding.sigmaY;
  const cosT = Math.cos(embedding.rotation);
  const sinT = Math.sin(embedding.rotation);
  const rx = x0 * cosT - y0 * sinT;
  const ry = x0 * sinT + y0 * cosT;
  return [embedding.cx + rx, embedding.cy + ry];
}

/**
 * Per-cluster 2D embedding shape. Inspired by the MNIST UMAP layout
 * shown in McInnes et al. 2018 (Fig. 2) and the umap-explorer demo
 * (https://grantcuster.github.io/umap-explorer/) — clusters are
 * irregular ellipses of varying density, some isolated and some
 * overlapping.
 */
interface ClusterEmbedding {
  /** Centroid in normalized `[-1, 1]` embedding space. */
  cx: number;
  cy: number;
  /** Spread along the major axis (before rotation). */
  sigmaX: number;
  /** Spread along the minor axis. */
  sigmaY: number;
  /** Rotation of the ellipse, in radians. */
  rotation: number;
}

const STATUS_POOL: readonly TraceStatus[] = [
  "ok",
  "ok",
  "ok",
  "ok",
  "ok",
  "ok",
  "warn",
  "warn",
  "error",
];

const ADDED_BY_POOL = ["ernesto", "alex", "sara", "james", "alerts-bot"] as const;

/* ── Source templates for synthetic events ─────────────────── */

interface SourceTemplate {
  source: string;
  types: readonly string[];
  actors: readonly string[];
  messages: readonly string[];
}

const SOURCE_TEMPLATES: Record<string, SourceTemplate> = {
  intercom: {
    source: "intercom",
    types: [
      "conversation.created",
      "conversation.message.created",
      "conversation.assigned",
      "conversation.note.added",
      "conversation.closed",
    ],
    actors: [
      "Sara K.",
      "James M.",
      "Priya P.",
      "support-bot",
      "billing-bot",
    ],
    messages: [
      "I can't reset my password",
      "My invoice didn't arrive",
      "Where do I find my API keys?",
      "The login button isn't working",
      "Is SSO available on the team plan?",
      "Hi — let me look into that for you.",
      "Resolved · password reset link delivered",
      "Sent receipt to billing@…",
    ],
  },
  stripe: {
    source: "stripe",
    types: [
      "charge.succeeded",
      "charge.failed",
      "invoice.paid",
      "invoice.payment_failed",
      "customer.subscription.updated",
      "charge.refunded",
    ],
    actors: ["webhook", "billing", "dunning"],
    messages: [
      "Charge succeeded for $49.00",
      "Charge failed: insufficient funds",
      "Invoice paid",
      "Subscription updated · annual",
      "Refund issued",
      "Dunning · attempt 2 of 3",
    ],
  },
  slack: {
    source: "slack",
    types: ["message.posted", "channel.joined", "reaction.added"],
    actors: ["#support", "#alerts", "#launches", "#billing"],
    messages: [
      "@here new ticket from a billing customer",
      "+1 :rocket:",
      "✅ Deployed to staging",
      "🔥 5xx spike on /events",
      "Marked resolved",
    ],
  },
  github: {
    source: "github",
    types: [
      "push",
      "pull_request.opened",
      "pull_request.merged",
      "pull_request.review_requested",
      "issue.commented",
      "check_run.completed",
    ],
    actors: ["bot/ci", "alex", "ernesto", "renovate[bot]"],
    messages: [
      "Pushed 3 commits to main",
      "feat: stream timeline viewer",
      "Reviewed — looks great",
      "Merged PR",
      "Re-ran failing checks",
    ],
  },
  pagerduty: {
    source: "pagerduty",
    types: [
      "incident.triggered",
      "incident.acknowledged",
      "incident.resolved",
      "incident.escalated",
    ],
    actors: ["alerts-bot", "oncall"],
    messages: [
      "5xx rate above threshold on /events",
      "Acknowledged · investigating",
      "Resolved · cache miss surge",
      "Escalated to secondary",
    ],
  },
  hubspot: {
    source: "hubspot",
    types: ["contact.created", "deal.updated", "form.submitted"],
    actors: ["lifecycle", "marketing-bot"],
    messages: [
      "New contact: lead@example.com",
      "Deal moved to Closed Won",
      "Form submitted: Demo request",
    ],
  },
  shopify: {
    source: "shopify",
    types: [
      "orders.create",
      "orders.paid",
      "orders.fulfilled",
      "checkouts.create",
    ],
    actors: ["storefront", "fulfillment-bot"],
    messages: [
      "New order #1024",
      "Order #1024 paid",
      "Fulfilled · UPS 1Z…",
      "Checkout abandoned at shipping",
    ],
  },
};

/* ── Cluster archetypes drive realistic source mixes ───────── */

interface ClusterArchetype {
  /** Display label for the cluster card / legend. */
  label: string;
  /** Source weights (must sum to 1; normalized below). */
  sourceMix: Record<string, number>;
  /** Optional leading-source label fragment, e.g. "Receipts" → trace
   *  labels like "Receipts · stripe charge". */
  labelTopic?: string;
  /** Per-trace event count distribution. */
  eventCount: { min: number; max: number };
  /** Per-trace duration window (ms). */
  durationMs: { min: number; max: number };
  /** UMAP-style 2D blob shape — irregular ellipses with rotation. */
  embedding: ClusterEmbedding;
}

/* ── Realistic 2D centroids ────────────────────────────────────
 *
 * These positions and covariances mimic a real UMAP run on a
 * heterogeneous trace dataset. Picked by hand from MNIST + Fashion-
 * MNIST UMAP reference plots (McInnes 2018, umap-explorer) so that:
 *
 *   - Some clusters are tightly packed; others sprawl.
 *   - A couple of clusters slightly overlap (billing ↔ receipts,
 *     password ↔ search) to model the soft-boundary case.
 *   - One cluster (engineering) is well-isolated.
 *   - Rotations are non-zero so blobs are clearly anisotropic, not
 *     concentric circles.
 *
 * Coordinates are in normalized `[-1, 1]` space; the canvas rescales
 * them at render time. */
const PASSWORD_EMBED: ClusterEmbedding = {
  cx: -0.42,
  cy: 0.35,
  sigmaX: 0.16,
  sigmaY: 0.09,
  rotation: -0.45,
};
const BILLING_EMBED: ClusterEmbedding = {
  cx: 0.46,
  cy: -0.18,
  sigmaX: 0.18,
  sigmaY: 0.11,
  rotation: 0.32,
};
const RECEIPTS_EMBED: ClusterEmbedding = {
  cx: 0.62,
  cy: -0.05,
  sigmaX: 0.10,
  sigmaY: 0.08,
  rotation: -0.25,
};
const DUNNING_EMBED: ClusterEmbedding = {
  cx: 0.30,
  cy: -0.46,
  sigmaX: 0.12,
  sigmaY: 0.07,
  rotation: 0.55,
};
const ONBOARDING_EMBED: ClusterEmbedding = {
  cx: -0.55,
  cy: -0.42,
  sigmaX: 0.20,
  sigmaY: 0.13,
  rotation: 0.18,
};
const API_ERRORS_EMBED: ClusterEmbedding = {
  cx: 0.12,
  cy: 0.55,
  sigmaX: 0.20,
  sigmaY: 0.10,
  rotation: 1.05,
};
const SEARCH_EMBED: ClusterEmbedding = {
  cx: -0.18,
  cy: 0.18,
  sigmaX: 0.10,
  sigmaY: 0.16,
  rotation: -0.62,
};
const SYNC_EMBED: ClusterEmbedding = {
  cx: -0.10,
  cy: -0.62,
  sigmaX: 0.16,
  sigmaY: 0.08,
  rotation: 1.45,
};
const ENGINEERING_EMBED: ClusterEmbedding = {
  cx: 0.70,
  cy: 0.55,
  sigmaX: 0.11,
  sigmaY: 0.08,
  rotation: 0.25,
};
const COMMERCE_EMBED: ClusterEmbedding = {
  cx: -0.65,
  cy: 0.62,
  sigmaX: 0.09,
  sigmaY: 0.16,
  rotation: 0.85,
};
const UNSORTED_EMBED: ClusterEmbedding = {
  cx: 0,
  cy: 0,
  sigmaX: 0.45,
  sigmaY: 0.40,
  rotation: 0,
};

const ARCHETYPES: Record<string, ClusterArchetype> = {
  password: {
    label: "Password reset",
    sourceMix: { intercom: 0.7, slack: 0.2, github: 0.1 },
    labelTopic: "Password reset",
    eventCount: { min: 4, max: 9 },
    durationMs: { min: 60_000, max: 6 * 60_000 },
    embedding: PASSWORD_EMBED,
  },
  billing: {
    label: "Billing inquiries",
    sourceMix: { stripe: 0.55, intercom: 0.35, slack: 0.1 },
    labelTopic: "Billing inquiry",
    eventCount: { min: 5, max: 12 },
    durationMs: { min: 60_000, max: 12 * 60_000 },
    embedding: BILLING_EMBED,
  },
  onboarding: {
    label: "Onboarding flow",
    sourceMix: { intercom: 0.4, hubspot: 0.4, slack: 0.2 },
    labelTopic: "Onboarding",
    eventCount: { min: 6, max: 14 },
    durationMs: { min: 5 * 60_000, max: 30 * 60_000 },
    embedding: ONBOARDING_EMBED,
  },
  apiErrors: {
    label: "API errors",
    sourceMix: { pagerduty: 0.5, github: 0.3, slack: 0.2 },
    labelTopic: "API error",
    eventCount: { min: 5, max: 11 },
    durationMs: { min: 60_000, max: 15 * 60_000 },
    embedding: API_ERRORS_EMBED,
  },
  receipts: {
    label: "Stripe receipts",
    sourceMix: { stripe: 0.7, intercom: 0.3 },
    labelTopic: "Stripe receipt",
    eventCount: { min: 4, max: 8 },
    durationMs: { min: 30_000, max: 4 * 60_000 },
    embedding: RECEIPTS_EMBED,
  },
  dunning: {
    label: "Dunning",
    sourceMix: { stripe: 0.6, intercom: 0.3, slack: 0.1 },
    labelTopic: "Dunning",
    eventCount: { min: 4, max: 10 },
    durationMs: { min: 60_000, max: 8 * 60_000 },
    embedding: DUNNING_EMBED,
  },
  engineering: {
    label: "Engineering · merges",
    sourceMix: { github: 0.7, slack: 0.2, pagerduty: 0.1 },
    labelTopic: "PR merge",
    eventCount: { min: 4, max: 10 },
    durationMs: { min: 5 * 60_000, max: 60 * 60_000 },
    embedding: ENGINEERING_EMBED,
  },
  search: {
    label: "Search",
    sourceMix: { intercom: 0.45, slack: 0.25, github: 0.3 },
    labelTopic: "Search question",
    eventCount: { min: 4, max: 9 },
    durationMs: { min: 60_000, max: 8 * 60_000 },
    embedding: SEARCH_EMBED,
  },
  sync: {
    label: "Data sync",
    sourceMix: { github: 0.4, pagerduty: 0.4, slack: 0.2 },
    labelTopic: "Sync",
    eventCount: { min: 5, max: 12 },
    durationMs: { min: 60_000, max: 12 * 60_000 },
    embedding: SYNC_EMBED,
  },
  commerce: {
    label: "Commerce",
    sourceMix: { shopify: 0.6, stripe: 0.3, intercom: 0.1 },
    labelTopic: "Order",
    eventCount: { min: 5, max: 11 },
    durationMs: { min: 60_000, max: 8 * 60_000 },
    embedding: COMMERCE_EMBED,
  },
  unsorted: {
    label: "Unsorted",
    sourceMix: {
      intercom: 0.25,
      stripe: 0.2,
      slack: 0.15,
      github: 0.15,
      pagerduty: 0.15,
      hubspot: 0.1,
    },
    labelTopic: "Unsorted",
    eventCount: { min: 4, max: 12 },
    durationMs: { min: 60_000, max: 12 * 60_000 },
    embedding: UNSORTED_EMBED,
  },
};

/* ── Synthetic trace generator ─────────────────────────────── */

interface SynthesizeArgs {
  archetype: ClusterArchetype;
  count: number;
  rng: () => number;
  /** Anchor end time for the synthesized window. */
  anchorMs: number;
  /** ID prefix to keep traces stable across reloads. */
  idPrefix: string;
  /** Cluster id stamped onto each trace. */
  clusterId: string;
}

function pickWeightedSource(
  rng: () => number,
  mix: Record<string, number>,
): string {
  const entries = Object.entries(mix);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [source, weight] of entries) {
    r -= weight;
    if (r <= 0) return source;
  }
  return entries[0]![0];
}

interface SynthesizedTrace {
  trace: TraceSummary;
  events: StreamTimelineEvent[];
}

function synthesizeTrace(
  args: Omit<SynthesizeArgs, "count"> & { index: number },
): SynthesizedTrace {
  const { archetype, rng, anchorMs, idPrefix, clusterId, index } = args;

  const traceId = `${idPrefix}_${index.toString().padStart(4, "0")}`;
  const eventCount = Math.floor(
    archetype.eventCount.min +
      rng() * (archetype.eventCount.max - archetype.eventCount.min + 1),
  );
  const durationMs =
    archetype.durationMs.min +
    rng() * (archetype.durationMs.max - archetype.durationMs.min);
  // ~5% of cluster members are "stragglers" — drawn from a much wider
  // Gaussian so they sit on the edge of (or between) clusters, the
  // way UMAP outputs always include some misclassified points.
  const isStraggler = rng() < 0.05;
  const embeddingStats: ClusterEmbedding = isStraggler
    ? {
        ...archetype.embedding,
        sigmaX: archetype.embedding.sigmaX * 3,
        sigmaY: archetype.embedding.sigmaY * 3,
      }
    : archetype.embedding;

  // Anchor the trace start somewhere in the last 14 days.
  const traceStartMs =
    anchorMs -
    Math.floor(rng() * 14 * 24 * 60 * 60 * 1000) -
    durationMs;

  const events: StreamTimelineEvent[] = [];
  let parentEventId: string | undefined = undefined;
  const sourcesSeen = new Map<string, number>();

  // First step: usually the cluster's primary source.
  const primarySource = pickWeightedSource(rng, archetype.sourceMix);
  const traceLabel = `${archetype.labelTopic ?? archetype.label} · ${primarySource}`;

  for (let i = 0; i < eventCount; i++) {
    const source =
      i === 0
        ? primarySource
        : pickWeightedSource(rng, archetype.sourceMix);
    const template = SOURCE_TEMPLATES[source];
    if (!template) continue;
    const offset =
      eventCount === 1
        ? durationMs / 2
        : (i / (eventCount - 1)) * durationMs;
    const occurredAt = new Date(traceStartMs + offset).toISOString();
    const eventId = `${traceId}_e${i.toString().padStart(2, "0")}`;
    const eventType = pick(rng, template.types);
    const actor = pick(rng, template.actors);
    const message = pick(rng, template.messages);

    events.push({
      id: eventId,
      source,
      type: eventType,
      occurredAt,
      actor,
      message,
      traceId,
      traceLabel,
      parentEventId,
      payload: {
        traceLabel,
        actor,
        text: message,
        step: i,
      },
    });

    sourcesSeen.set(source, (sourcesSeen.get(source) ?? 0) + 1);
    // Most steps causally follow the previous one. Branching keeps the
    // visual variety in the timeline tab.
    parentEventId = rng() > 0.15 ? eventId : parentEventId;
  }

  const status = STATUS_POOL[Math.floor(rng() * STATUS_POOL.length)]!;
  const split: TraceSummary["split"] | undefined =
    rng() > 0.45
      ? rng() > 0.66
        ? "train"
        : rng() > 0.5
          ? "validation"
          : "test"
      : undefined;
  const addedBy = ADDED_BY_POOL[Math.floor(rng() * ADDED_BY_POOL.length)];
  const sortedSources = Array.from(sourcesSeen.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([s]) => s);

  const startedAt = events[0]!.occurredAt;
  const endedAt = events[events.length - 1]!.occurredAt;
  const durationActualMs =
    new Date(endedAt).getTime() - new Date(startedAt).getTime();

  // Sample a 2D embedding from this cluster's anisotropic Gaussian
  // (or its widened variant for stragglers) so the graph view shows a
  // real UMAP-style blob with realistic edge-case scatter.
  const embedding = sampleEllipseGaussian(rng, embeddingStats);

  const trace: TraceSummary = {
    traceId,
    label: traceLabel,
    primarySource: sortedSources[0] ?? primarySource,
    sources: sortedSources,
    eventCount: events.length,
    startedAt,
    durationMs: Math.max(durationActualMs, 1_000),
    status,
    split,
    clusterId,
    addedAt: new Date(
      new Date(startedAt).getTime() + Math.floor(rng() * 6) * 3_600_000,
    ).toISOString(),
    addedBy,
    embedding,
  };

  return { trace, events };
}

function synthesizeCluster(args: SynthesizeArgs): SynthesizedTrace[] {
  const out: SynthesizedTrace[] = [];
  for (let i = 0; i < args.count; i++) {
    out.push(
      synthesizeTrace({
        archetype: args.archetype,
        rng: args.rng,
        anchorMs: args.anchorMs,
        idPrefix: args.idPrefix,
        clusterId: args.clusterId,
        index: i,
      }),
    );
  }
  return out;
}

/* ── Adapt scenario events into TraceSummaries ─────────────── */

function summarizeFromEvents(
  traceId: string,
  events: readonly StreamTimelineEvent[],
  rng: () => number,
  clusterId: string,
  clusterEmbedding: ClusterEmbedding | null,
): TraceSummary {
  const sortedByTime = [...events].sort(
    (a, b) =>
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );
  const first = sortedByTime[0]!;
  const last = sortedByTime[sortedByTime.length - 1]!;
  const startedMs = new Date(first.occurredAt).getTime();
  const endedMs = new Date(last.occurredAt).getTime();

  const sourceCounts = new Map<string, number>();
  for (const event of events) {
    sourceCounts.set(event.source, (sourceCounts.get(event.source) ?? 0) + 1);
  }
  const sources = Array.from(sourceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([s]) => s);

  const status = STATUS_POOL[Math.floor(rng() * STATUS_POOL.length)]!;
  const split: TraceSummary["split"] | undefined =
    rng() > 0.45 ? (rng() > 0.5 ? "train" : "validation") : undefined;
  const addedBy = ADDED_BY_POOL[Math.floor(rng() * ADDED_BY_POOL.length)];
  const embedding = clusterEmbedding
    ? sampleEllipseGaussian(rng, clusterEmbedding)
    : undefined;

  return {
    traceId,
    label: first.traceLabel ?? `${first.source} · ${first.type}`,
    primarySource: sources[0] ?? "unknown",
    sources,
    eventCount: events.length,
    startedAt: first.occurredAt,
    durationMs: Math.max(endedMs - startedMs, 1_000),
    status,
    split,
    clusterId,
    addedAt: new Date(
      startedMs - Math.floor(rng() * 6) * 3_600_000,
    ).toISOString(),
    addedBy,
    embedding,
  };
}

/* ── Edge synthesis (within-cluster + a few bridges) ───────── */

function buildEdges(
  traces: readonly TraceSummary[],
  rng: () => number,
  /** Edges per node within the cluster. Higher = denser graph. */
  inClusterDegree = 2,
): DatasetSimilarityEdge[] {
  const byCluster = new Map<string, TraceSummary[]>();
  for (const trace of traces) {
    const cid = trace.clusterId ?? "__none__";
    const list = byCluster.get(cid);
    if (list) list.push(trace);
    else byCluster.set(cid, [trace]);
  }

  const edges: DatasetSimilarityEdge[] = [];

  for (const list of byCluster.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let k = 1; k <= inClusterDegree; k++) {
        const j = (i + k) % list.length;
        if (i === j) continue;
        edges.push({
          fromTraceId: list[i]!.traceId,
          toTraceId: list[j]!.traceId,
          weight: 0.6 + rng() * 0.35,
        });
      }
    }
  }

  const allClusters = Array.from(byCluster.values()).filter(
    (l) => l.length > 0,
  );
  if (allClusters.length >= 2) {
    const bridges = Math.min(8, allClusters.length * 2);
    for (let b = 0; b < bridges; b++) {
      const fromCluster = allClusters[b % allClusters.length]!;
      const toCluster = allClusters[(b + 1) % allClusters.length]!;
      const from = fromCluster[Math.floor(rng() * fromCluster.length)]!;
      const to = toCluster[Math.floor(rng() * toCluster.length)]!;
      if (from.traceId === to.traceId) continue;
      edges.push({
        fromTraceId: from.traceId,
        toTraceId: to.traceId,
        weight: 0.15 + rng() * 0.2,
      });
    }
  }

  return edges;
}

/* ── Snapshot builder ──────────────────────────────────────── */

interface ClusterSpec {
  archetype: keyof typeof ARCHETYPES;
  /** Number of traces to put in this cluster. */
  size: number;
  /** Optional override for the cluster's display label. Falls back to
   *  the archetype's `label`. */
  label?: string;
}

interface BuildSnapshotOptions {
  dataset: Dataset;
  /** Cluster specs in order; produces deterministic cluster ids. */
  clusterSpecs: readonly ClusterSpec[];
  /** When true, the first scenario events are merged into the first
   *  cluster so the Timeline tab shows real causal chains. Defaults
   *  to true. */
  includeScenarioTraces?: boolean;
  /**
   * Fraction of total traces synthesized as cluster-less "noise"
   * outliers placed uniformly at random in the embedding space.
   * Defaults to 0.04 (4%) — matches what real UMAP runs typically
   * leave behind as un-grouped halo points.
   */
  noiseRatio?: number;
  seed: number;
}

function buildSnapshot({
  dataset,
  clusterSpecs,
  includeScenarioTraces = true,
  noiseRatio = 0.04,
  seed,
}: BuildSnapshotOptions): DatasetSnapshot {
  const rng = mulberry32(seed);

  const clusters: DatasetCluster[] = clusterSpecs.map((spec, i) => {
    const archetype = ARCHETYPES[spec.archetype];
    const id = `${dataset.id}_cluster_${i}`;
    return {
      id,
      label: spec.label ?? archetype.label,
      color: clusterColor(id),
      traceIds: [],
      description: undefined,
    };
  });

  const traces: TraceSummary[] = [];
  const events: StreamTimelineEvent[] = [];

  // Optional: real scenarios into cluster 0 so the Timeline tab gets
  // a few high-fidelity multi-source chains.
  if (includeScenarioTraces && clusters[0]) {
    const firstArchetype = ARCHETYPES[clusterSpecs[0]!.archetype]!;
    const scenariosByTraceId = new Map<string, StreamTimelineEvent[]>();
    for (const event of streamTimelineSeed) {
      if (!event.traceId) continue;
      const list = scenariosByTraceId.get(event.traceId);
      if (list) list.push(event);
      else scenariosByTraceId.set(event.traceId, [event]);
    }
    for (const scenario of TRACE_SCENARIOS.slice(0, 3)) {
      const evts = scenariosByTraceId.get(scenario.traceId);
      if (!evts || evts.length === 0) continue;
      traces.push(
        summarizeFromEvents(
          scenario.traceId,
          evts,
          rng,
          clusters[0]!.id,
          firstArchetype.embedding,
        ),
      );
      events.push(...evts);
      (clusters[0]!.traceIds as string[]).push(scenario.traceId);
    }
  }

  // Synthesize the rest.
  for (let i = 0; i < clusters.length; i++) {
    const spec = clusterSpecs[i]!;
    const cluster = clusters[i]!;
    const archetype = ARCHETYPES[spec.archetype];
    const remaining = Math.max(spec.size - cluster.traceIds.length, 0);
    if (remaining === 0) continue;
    const synthesized = synthesizeCluster({
      archetype,
      count: remaining,
      rng,
      anchorMs: ANCHOR_MS,
      idPrefix: cluster.id,
      clusterId: cluster.id,
    });
    for (const { trace, events: evts } of synthesized) {
      traces.push(trace);
      events.push(...evts);
      (cluster.traceIds as string[]).push(trace.traceId);
    }
  }

  // Outlier noise — uniformly placed traces with no cluster. These
  // render in neutral gray and read as the "halo" of un-grouped
  // points you see around the cluster blobs in real UMAP scatter
  // plots.
  if (noiseRatio > 0 && traces.length > 0) {
    const noiseCount = Math.max(1, Math.round(traces.length * noiseRatio));
    for (let i = 0; i < noiseCount; i++) {
      const noiseTrace = synthesizeNoiseTrace({
        rng,
        anchorMs: ANCHOR_MS,
        idPrefix: `${dataset.id}_noise`,
        index: i,
      });
      traces.push(noiseTrace.trace);
      events.push(...noiseTrace.events);
    }
  }

  const edges = buildEdges(traces, rng);

  events.sort(
    (a, b) =>
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );

  return {
    dataset: {
      ...dataset,
      traceCount: traces.length,
      eventCount: events.length,
    },
    traces,
    clusters,
    edges,
    events,
  };
}

interface NoiseArgs {
  rng: () => number;
  anchorMs: number;
  idPrefix: string;
  index: number;
}

/** Build a single un-clustered "noise" trace. Picks a random source
 *  template and produces a short event sequence so the trace still
 *  reads as a real series in the Timeline tab. */
function synthesizeNoiseTrace({
  rng,
  anchorMs,
  idPrefix,
  index,
}: NoiseArgs): SynthesizedTrace {
  const sourceKeys = Object.keys(SOURCE_TEMPLATES);
  const primarySource = sourceKeys[Math.floor(rng() * sourceKeys.length)]!;
  const archetype: ClusterArchetype = {
    label: "Outlier",
    sourceMix: { [primarySource]: 1 },
    labelTopic: "Outlier",
    eventCount: { min: 3, max: 7 },
    durationMs: { min: 60_000, max: 6 * 60_000 },
    embedding: { cx: 0, cy: 0, sigmaX: 0.95, sigmaY: 0.95, rotation: 0 },
  };
  const built = synthesizeTrace({
    archetype,
    rng,
    anchorMs,
    idPrefix,
    clusterId: "__noise__",
    index,
  });
  // Strip the clusterId so the graph view treats it as truly orphan
  // (gray dot, scattered between blobs).
  const traceWithoutCluster: TraceSummary = {
    ...built.trace,
    clusterId: undefined,
    label: `Outlier · ${primarySource}`,
  };
  return { trace: traceWithoutCluster, events: built.events };
}

/* ── Exported snapshots ────────────────────────────────────── */

const DATASET_BY_ID = new Map(datasetsManagerSeed.map((d) => [d.id, d]));

function requireDataset(id: string): Dataset {
  const dataset = DATASET_BY_ID.get(id);
  if (!dataset) throw new Error(`Unknown dataset id: ${id}`);
  return dataset;
}

/**
 * Training · Q1 2026 — the canonical happy-path snapshot. Realistically
 * sized (~250 traces across 6 clusters) so the graph view shows a
 * proper point cloud, every dot is a multi-event trace.
 */
export const trainingDatasetSnapshot: DatasetSnapshot = buildSnapshot({
  dataset: requireDataset("ds_train_q1"),
  clusterSpecs: [
    { archetype: "password", size: 52 },
    { archetype: "billing", size: 64 },
    { archetype: "onboarding", size: 38 },
    { archetype: "apiErrors", size: 42 },
    { archetype: "search", size: 30 },
    { archetype: "sync", size: 24 },
  ],
  seed: 0xc0ffee,
});

/**
 * Eval suite v1 — smaller curated suite, three tighter clusters,
 * scripted scenarios at the top.
 */
export const evalDatasetSnapshot: DatasetSnapshot = buildSnapshot({
  dataset: requireDataset("ds_eval_v1"),
  clusterSpecs: [
    { archetype: "password", size: 28, label: "Support · password" },
    { archetype: "receipts", size: 24, label: "Billing · receipts" },
    { archetype: "engineering", size: 22, label: "Engineering · merges" },
  ],
  seed: 0xfeed,
});

/** Replay · billing edge cases. */
export const replayDatasetSnapshot: DatasetSnapshot = buildSnapshot({
  dataset: requireDataset("ds_replay_billing"),
  clusterSpecs: [
    { archetype: "receipts", size: 30 },
    { archetype: "dunning", size: 22 },
  ],
  includeScenarioTraces: false,
  seed: 0xbada55,
});

/** Review queue — small, single-cluster ("Unsorted"), to seed the
 *  small-dataset story without scenario noise. */
export const reviewDatasetSnapshot: DatasetSnapshot = buildSnapshot({
  dataset: requireDataset("ds_review_queue"),
  clusterSpecs: [{ archetype: "unsorted", size: 24 }],
  includeScenarioTraces: false,
  seed: 0xfade,
});

/** Empty draft — zero traces. */
export const emptyDatasetSnapshot: DatasetSnapshot = {
  dataset: {
    ...requireDataset("ds_eval_v2_draft"),
    traceCount: 0,
    eventCount: 0,
  },
  traces: [],
  clusters: [],
  edges: [],
  events: [],
};

export const datasetSnapshotsById: Record<string, DatasetSnapshot> = {
  [trainingDatasetSnapshot.dataset.id]: trainingDatasetSnapshot,
  [evalDatasetSnapshot.dataset.id]: evalDatasetSnapshot,
  [replayDatasetSnapshot.dataset.id]: replayDatasetSnapshot,
  [reviewDatasetSnapshot.dataset.id]: reviewDatasetSnapshot,
  [emptyDatasetSnapshot.dataset.id]: emptyDatasetSnapshot,
};

/* ── Big synthetic snapshot for the dense graph story ──────── */

/** Heavy synthetic snapshot used by the `DenseDataset` graph story:
 *  ~520 traces across 8 clusters, no scenario events. Useful for
 *  stress-testing the canvas hover/zoom interaction. */
export const denseSyntheticSnapshot: DatasetSnapshot = buildSnapshot({
  dataset: {
    id: "ds_synth_dense",
    name: "Synthetic · 520 traces",
    description: "Heavy synthetic snapshot for graph view stress tests.",
    purpose: "training",
    traceCount: 0,
    eventCount: 0,
    createdBy: "stories",
    updatedAt: new Date(ANCHOR_MS - 60 * 60 * 1000).toISOString(),
    tags: ["synthetic", "dense"],
  },
  clusterSpecs: [
    { archetype: "password", size: 92 },
    { archetype: "billing", size: 110 },
    { archetype: "onboarding", size: 64 },
    { archetype: "apiErrors", size: 84 },
    { archetype: "search", size: 60 },
    { archetype: "sync", size: 52 },
    { archetype: "engineering", size: 32 },
    { archetype: "commerce", size: 28 },
  ],
  includeScenarioTraces: false,
  seed: 0xfacefeed,
});

/** Anchor used by the seed builders. */
export { ANCHOR_MS as DATASETS_MOCK_ANCHOR_MS };
