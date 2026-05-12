/*
 * Stream Timeline — deterministic mock data for Storybook.
 *
 * The seeded RNG keeps stories visually stable across reloads (so VRT
 * snapshots don't churn). Times are anchored to a frozen ISO so the
 * generated timestamps don't drift each render — stories that want a
 * "live" feel re-anchor to `Date.now()` themselves.
 */

import type {
  Dataset,
  RecordingStream,
  StreamTimelineEvent,
} from "./types";

/* ── Seeded RNG (mulberry32) ────────────────────────────────── */

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

interface SourceTemplate {
  source: string;
  types: string[];
  /** Relative weight in the firehose (0–1). */
  weight: number;
  actors: string[];
  messages: string[];
}

const SOURCES: SourceTemplate[] = [
  {
    source: "intercom",
    types: [
      "conversation.created",
      "conversation.message.created",
      "conversation.assigned",
      "conversation.closed",
    ],
    weight: 0.36,
    actors: ["Sara K.", "James M.", "support-bot"],
    messages: [
      "I can't reset my password",
      "Can you help me with my invoice?",
      "Looks like the login button isn't working today",
      "Where can I find my API keys?",
    ],
  },
  {
    source: "stripe",
    types: [
      "charge.succeeded",
      "invoice.paid",
      "customer.subscription.created",
      "charge.refunded",
    ],
    weight: 0.22,
    actors: ["webhook", "billing"],
    messages: [
      "Charge succeeded for $49.00",
      "Invoice paid",
      "Subscription started",
      "Refund issued",
    ],
  },
  {
    source: "slack",
    types: [
      "message.posted",
      "channel.joined",
      "reaction.added",
    ],
    weight: 0.18,
    actors: ["#support", "#alerts", "#launches"],
    messages: [
      "@here new release deployed",
      "+1 :rocket:",
      "joined #alerts",
    ],
  },
  {
    source: "hubspot",
    types: [
      "contact.created",
      "deal.updated",
      "form.submitted",
    ],
    weight: 0.12,
    actors: ["lifecycle", "marketing-bot"],
    messages: [
      "New contact: lead@example.com",
      "Deal moved to Closed Won",
      "Form submitted: Demo request",
    ],
  },
  {
    source: "github",
    types: [
      "push",
      "pull_request.opened",
      "pull_request.merged",
      "issue.commented",
    ],
    weight: 0.12,
    actors: ["bot/ci", "alex", "ernesto"],
    messages: [
      "Pushed 3 commits to main",
      "Opened PR: feat: add timeline viewer",
      "Merged PR #128",
      "Commented on #91",
    ],
  },
];

/** Anchor for deterministic mock streams — Mar 14 2026 12:00:00 UTC. */
const MOCK_ANCHOR_MS = Date.UTC(2026, 2, 14, 12, 0, 0);

/* ── Trace scenarios (multi-source, with causal chains) ─────── */

interface TraceScenario {
  traceId: string;
  label: string;
  /** Minutes before the anchor when the trace starts. */
  startsAtMinutesAgo: number;
  /** Total wall-clock duration of the trace, in seconds. */
  durationSecs: number;
  /** Optional correlationKey (e.g. customer id, conversation id). */
  correlationKey?: string;
  /** Sequence of (source, type, message?, parentIndex?). `parentIndex`
   *  references an earlier step in the same scenario; omitted = no
   *  explicit causal link (sequential edge will be inferred). */
  steps: ReadonlyArray<{
    source: string;
    type: string;
    actor?: string;
    message?: string;
    parentIndex?: number;
  }>;
}

const TRACE_SCENARIOS: readonly TraceScenario[] = [
  {
    traceId: "trace_conv_001",
    label: "Sara K. · Password reset",
    startsAtMinutesAgo: 24,
    durationSecs: 220,
    correlationKey: "conversation_001",
    steps: [
      {
        source: "intercom",
        type: "conversation.created",
        actor: "Sara K.",
        message: "I can't reset my password",
      },
      {
        source: "intercom",
        type: "conversation.message.created",
        actor: "Sara K.",
        message: "I keep getting an invalid token error",
        parentIndex: 0,
      },
      {
        source: "slack",
        type: "message.posted",
        actor: "#support",
        message: "@here new ticket from Sara K.",
        parentIndex: 1,
      },
      {
        source: "intercom",
        type: "conversation.assigned",
        actor: "James M.",
        message: "Assigned to James",
        parentIndex: 2,
      },
      {
        source: "intercom",
        type: "conversation.message.created",
        actor: "James M.",
        message: "Hi Sara — let me look into that for you.",
        parentIndex: 3,
      },
      {
        source: "intercom",
        type: "conversation.closed",
        actor: "James M.",
        message: "Resolved · password reset link delivered",
        parentIndex: 4,
      },
    ],
  },
  {
    traceId: "trace_bill_002",
    label: "Acme Co · Invoice $49",
    startsAtMinutesAgo: 18,
    durationSecs: 95,
    correlationKey: "customer_acme",
    steps: [
      {
        source: "stripe",
        type: "charge.succeeded",
        actor: "webhook",
        message: "Charge succeeded for $49.00",
      },
      {
        source: "stripe",
        type: "invoice.paid",
        actor: "billing",
        message: "Invoice paid",
        parentIndex: 0,
      },
      {
        source: "intercom",
        type: "conversation.message.created",
        actor: "billing-bot",
        message: "Receipt sent to acme@example.com",
        parentIndex: 1,
      },
      {
        source: "slack",
        type: "message.posted",
        actor: "#alerts",
        message: "+$49 from acme.co",
        parentIndex: 1,
      },
    ],
  },
  {
    traceId: "trace_pr_003",
    label: "PR #128 · timeline viewer",
    startsAtMinutesAgo: 12,
    durationSecs: 320,
    correlationKey: "pr_128",
    steps: [
      {
        source: "github",
        type: "pull_request.opened",
        actor: "ernesto",
        message: "feat: add timeline viewer",
      },
      {
        source: "github",
        type: "push",
        actor: "ernesto",
        message: "Pushed 2 commits",
        parentIndex: 0,
      },
      {
        source: "github",
        type: "issue.commented",
        actor: "alex",
        message: "Reviewed — looks great",
        parentIndex: 1,
      },
      {
        source: "github",
        type: "pull_request.merged",
        actor: "ernesto",
        message: "Merged PR #128",
        parentIndex: 0,
      },
      {
        source: "slack",
        type: "message.posted",
        actor: "#launches",
        message: "✅ Timeline viewer shipped to staging",
        parentIndex: 3,
      },
    ],
  },
];

function buildTraceEvents(
  scenarios: readonly TraceScenario[],
  anchorMs: number,
): StreamTimelineEvent[] {
  const out: StreamTimelineEvent[] = [];
  for (const scenario of scenarios) {
    const startMs = anchorMs - scenario.startsAtMinutesAgo * 60 * 1000;
    const totalMs = scenario.durationSecs * 1000;
    const stepIds = scenario.steps.map(
      (_, i) => `evt_${scenario.traceId}_${i.toString().padStart(2, "0")}`,
    );
    scenario.steps.forEach((step, i) => {
      const offset =
        scenario.steps.length === 1
          ? totalMs / 2
          : (i / (scenario.steps.length - 1)) * totalMs;
      const occurredAt = new Date(startMs + offset).toISOString();
      const parentEventId =
        step.parentIndex !== undefined
          ? stepIds[step.parentIndex]
          : undefined;
      out.push({
        id: stepIds[i]!,
        source: step.source,
        type: step.type,
        occurredAt,
        actor: step.actor,
        message: step.message,
        traceId: scenario.traceId,
        traceLabel: scenario.label,
        correlationKey: scenario.correlationKey,
        parentEventId,
        payload: {
          step: i,
          traceLabel: scenario.label,
          actor: step.actor,
          text: step.message,
        },
      });
    });
  }
  return out;
}

/** Trace scenarios merged into all seeds so highlight/connector
 *  modes have meaningful data without needing a special seed. */
const TRACE_EVENTS = buildTraceEvents(TRACE_SCENARIOS, MOCK_ANCHOR_MS);

interface GenerateOptions {
  count: number;
  /** Window the events span, in minutes, before/up-to the anchor. */
  windowMinutes?: number;
  /** Override anchor — defaults to the frozen mock anchor. */
  anchorMs?: number;
  /** RNG seed. */
  seed?: number;
  /** Subset of source templates to include. */
  sources?: readonly SourceTemplate[];
}

function generate({
  count,
  windowMinutes = 30,
  anchorMs = MOCK_ANCHOR_MS,
  seed = 0xc0ffee,
  sources = SOURCES,
}: GenerateOptions): StreamTimelineEvent[] {
  const rand = mulberry32(seed);
  const totalWeight = sources.reduce((sum, s) => sum + s.weight, 0);
  const start = anchorMs - windowMinutes * 60 * 1000;
  const events: StreamTimelineEvent[] = [];

  for (let i = 0; i < count; i++) {
    const r = rand() * totalWeight;
    let acc = 0;
    let template = sources[0]!;
    for (const s of sources) {
      acc += s.weight;
      if (r <= acc) {
        template = s;
        break;
      }
    }

    const type = template.types[Math.floor(rand() * template.types.length)]!;
    const actor =
      template.actors[Math.floor(rand() * template.actors.length)] ?? undefined;
    const message =
      template.messages[Math.floor(rand() * template.messages.length)] ?? undefined;
    const tFrac = rand();
    const occurredAt = new Date(
      start + tFrac * (anchorMs - start),
    ).toISOString();

    events.push({
      id: `evt_${template.source}_${i.toString().padStart(4, "0")}`,
      source: template.source,
      type,
      occurredAt,
      actor,
      message,
      payload: {
        index: i,
        actor,
        text: message,
        meta: { seed, weight: template.weight },
      },
    });
  }

  events.sort(
    (a, b) =>
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );
  return events;
}

function mergeWithTraces(
  base: readonly StreamTimelineEvent[],
  traces: readonly StreamTimelineEvent[] = TRACE_EVENTS,
): readonly StreamTimelineEvent[] {
  const merged = [...base, ...traces];
  merged.sort(
    (a, b) =>
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );
  return merged;
}

/* ── Public seeds ───────────────────────────────────────────── */

/** Default mock — ~120 background events plus 3 multi-source traces. */
export const streamTimelineSeed: readonly StreamTimelineEvent[] = mergeWithTraces(
  generate({
    count: 120,
    windowMinutes: 30,
    seed: 0xc0ffee,
  }),
);

/** Sparse — single source, ~20 events, useful for empty/sparse stories. */
export const streamTimelineSparseSeed: readonly StreamTimelineEvent[] = generate({
  count: 20,
  windowMinutes: 30,
  seed: 0xfeed,
  sources: SOURCES.filter((s) => s.source === "intercom"),
});

/** Dense — ~400 events over 60 minutes, exercises bucketing visibly. */
export const streamTimelineDenseSeed: readonly StreamTimelineEvent[] = mergeWithTraces(
  generate({
    count: 400,
    windowMinutes: 60,
    seed: 0xdeadbeef,
  }),
);

/** Empty — no events, drives the empty-state story. */
export const streamTimelineEmptySeed: readonly StreamTimelineEvent[] = [];

/**
 * Trace-only seed — just the 3 scripted multi-source scenarios. Use
 * for the connector / trace-mode stories so the visualizations aren't
 * obscured by background firehose noise.
 */
export const streamTimelineTracesSeed: readonly StreamTimelineEvent[] = TRACE_EVENTS;

/** Public-facing trace metadata for stories that want to walk the list. */
export { TRACE_SCENARIOS };

/** Streams-panel seed — one row per known source plus a Live API entry. */
export const recordingStreamsSeed: readonly RecordingStream[] = [
  {
    id: "live-api",
    name: "Live API",
    enabled: true,
    status: "online",
    kind: "LiveApi",
    event_count: 0,
  },
  ...SOURCES.map<RecordingStream>((s, i) => ({
    id: `stream_${s.source}`,
    name: s.source,
    enabled: i < 3,
    status: i < 3 ? "online" : "paused",
    kind: "LiveApi",
    event_count: Math.round(streamTimelineSeed.filter(
      (e) => e.source === s.source,
    ).length),
  })),
];

/** Anchor used by the seed generators — exported so stories can re-anchor "live" demos. */
export const STREAM_TIMELINE_MOCK_ANCHOR_MS = MOCK_ANCHOR_MS;

/* ── Datasets ───────────────────────────────────────────────── */

/** Sample datasets used by the dataset-builder story. */
export const datasetsSeed: readonly Dataset[] = [
  {
    id: "ds_eval_v1",
    name: "Eval suite v1",
    description:
      "Hand-curated traces used as the agent regression suite. Adds here re-run on every release.",
    purpose: "eval",
    traceCount: 42,
    eventCount: 311,
    updatedAt: new Date(MOCK_ANCHOR_MS - 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: "ernesto",
    tags: ["regression", "stable"],
  },
  {
    id: "ds_train_q1",
    name: "Training · Q1 2026",
    description:
      "Customer-support traces with human-graded responses. Used for SFT batches.",
    purpose: "training",
    traceCount: 184,
    eventCount: 2103,
    updatedAt: new Date(MOCK_ANCHOR_MS - 6 * 60 * 60 * 1000).toISOString(),
    createdBy: "alex",
    tags: ["sft", "support"],
  },
  {
    id: "ds_replay_billing",
    name: "Replay · Billing edge cases",
    description:
      "Stripe + Intercom traces around subscription dunning, used to drive sandbox replay.",
    purpose: "replay",
    traceCount: 18,
    eventCount: 96,
    updatedAt: new Date(MOCK_ANCHOR_MS - 18 * 60 * 60 * 1000).toISOString(),
    createdBy: "pricing-bot",
    tags: ["billing", "stripe"],
  },
  {
    id: "ds_review_queue",
    name: "Review queue",
    description:
      "Inbox of traces flagged by alerting; QA team confirms before they go to eval or training.",
    purpose: "review",
    traceCount: 7,
    eventCount: 49,
    updatedAt: new Date(MOCK_ANCHOR_MS - 30 * 60 * 1000).toISOString(),
    createdBy: "alerts",
    tags: ["inbox"],
  },
];
