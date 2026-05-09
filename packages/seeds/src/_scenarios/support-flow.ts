/*
 * Support flow — a focused, narrative-coherent scenario shared
 * across the connections, agents, and datasets domains.
 *
 * The story:
 *
 *   A single `support-agent` (Vercel AI SDK, three versions, current
 *   = 1.2.0) handles inbound customer messages. It owns four tools,
 *   each backed by one of the four connections in the workspace:
 *
 *     - lookupCustomer    → Intercom
 *     - searchOrders      → Shopify
 *     - processRefund     → Stripe
 *     - escalateToHuman   → Slack
 *
 *   Seven traces cover the typical outcomes: quick order lookup,
 *   refund success, refund-out-of-policy escalation, missing-order
 *   error, subscription cancellation, multi-step verification, and
 *   a knowledge-only FAQ response. Trace IDs are reused across
 *   every domain so navigating from a `Run` (agents) to a trace
 *   (timeline) to a dataset row lands on the same logical event.
 *
 * This module exports the raw materials. Per-domain seed files
 * (`connections/support-flow.ts`, `agents/support-flow.ts`,
 * `datasets/support-flow.ts`) import these and adapt to their own
 * wire shapes.
 */

import type { StreamTimelineEvent } from "chronicle/types/datasets";

/* ── Anchors + identity constants ──────────────────────── */

/** Fixed wall-clock anchor so every fixture timestamp is
 *  deterministic. Picked far enough in the past that "last 7 days"
 *  semantics still feel current when rebased to `Date.now()` by
 *  the seed util. */
export const SUPPORT_FLOW_ANCHOR_MS = Date.UTC(2026, 3, 29, 14, 0, 0);

export const SUPPORT_FLOW_AGENT_NAME = "support-agent";
export const SUPPORT_FLOW_AGENT_CURRENT = "1.2.0";
export const SUPPORT_FLOW_AGENT_VERSIONS = ["1.0.0", "1.1.0", "1.2.0"] as const;
export type SupportFlowAgentVersion =
  (typeof SUPPORT_FLOW_AGENT_VERSIONS)[number];

/** Stable connection ids. Used by every domain seed so a delivery
 *  row in connections/ ties to the same conversation a trace row
 *  in datasets/ shows. */
export const SUPPORT_FLOW_CONNECTION_IDS = {
  intercom: "conn_support_intercom",
  shopify: "conn_support_shopify",
  stripe: "conn_support_stripe",
  slack: "conn_support_slack",
} as const;

/* ── Trace blueprints ──────────────────────────────────── */

/**
 * Compact event template — the `delayMs` is the offset from the
 * trace's `startMs`, and `parent` is an index into the same event
 * array. The materializer fills in concrete IDs + ISO timestamps.
 */
export interface SupportFlowEventTpl {
  source: "intercom" | "shopify" | "stripe" | "slack" | "agent";
  type: string;
  delayMs: number;
  actor?: string;
  message?: string;
  payload?: Record<string, unknown>;
  /** Index in the same trace's events array. Omit for the root. */
  parent?: number;
}

export interface SupportFlowTrace {
  traceId: string;
  label: string;
  scenario:
    | "order-lookup"
    | "refund-success"
    | "refund-denied"
    | "missing-order"
    | "cancel-subscription"
    | "multi-step-refund"
    | "faq";
  status: "ok" | "warn" | "error";
  /** Minutes before the anchor when the trace started. Higher =
   *  older. Spread across the last 7 days so stories show "last
   *  Sunday" etc. */
  startMinutesBack: number;
  /** End-to-end duration in ms. Sum of `delayMs` plus a tail. */
  durationMs: number;
  /** Customer / actor that started this conversation. */
  customer: string;
  events: readonly SupportFlowEventTpl[];
  /** Optional Slack channel for escalations / notifications. */
  slackChannel?: string;
}

/* ── The seven traces ──────────────────────────────────── */

export const SUPPORT_FLOW_TRACES: readonly SupportFlowTrace[] = [
  {
    traceId: "trc_support_001",
    label: "Order status query · #4827",
    scenario: "order-lookup",
    status: "ok",
    startMinutesBack: 12,
    durationMs: 1_500,
    customer: "ada@northwind.example",
    events: [
      {
        source: "intercom",
        type: "conversation.created",
        delayMs: 0,
        actor: "ada@northwind.example",
        message: "Hi, where is my order #4827?",
      },
      {
        source: "agent",
        type: "run.started",
        delayMs: 200,
        actor: "support-agent@1.2.0",
        parent: 0,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 500,
        actor: "support-agent@1.2.0",
        message: "searchOrders({ orderId: '4827' })",
        parent: 1,
      },
      {
        source: "shopify",
        type: "order.fetched",
        delayMs: 700,
        message: "shipped · DHL · ETA Apr 30",
        payload: { orderId: "4827", status: "shipped" },
        parent: 2,
      },
      {
        source: "agent",
        type: "run.complete",
        delayMs: 1_200,
        actor: "support-agent@1.2.0",
        parent: 3,
      },
      {
        source: "intercom",
        type: "conversation.message",
        delayMs: 1_500,
        actor: "support-agent@1.2.0",
        message: "Your order #4827 shipped via DHL — ETA Apr 30.",
        parent: 4,
      },
    ],
  },

  {
    traceId: "trc_support_002",
    label: "Refund granted · order #4801",
    scenario: "refund-success",
    status: "ok",
    startMinutesBack: 53,
    durationMs: 3_100,
    customer: "byron@gulfstream.example",
    events: [
      {
        source: "intercom",
        type: "conversation.created",
        delayMs: 0,
        actor: "byron@gulfstream.example",
        message: "Item from order #4801 arrived damaged. Refund please.",
      },
      {
        source: "agent",
        type: "run.started",
        delayMs: 180,
        actor: "support-agent@1.2.0",
        parent: 0,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 400,
        actor: "support-agent@1.2.0",
        message: "lookupCustomer({ email })",
        parent: 1,
      },
      {
        source: "intercom",
        type: "user.profile",
        delayMs: 600,
        message: "byron@gulfstream.example · 14 prior orders",
        payload: { trustedReturns: true },
        parent: 2,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 1_000,
        actor: "support-agent@1.2.0",
        message: "searchOrders({ orderId: '4801' })",
        parent: 3,
      },
      {
        source: "shopify",
        type: "order.fetched",
        delayMs: 1_300,
        message: "delivered · 8 days ago · $48.20",
        payload: { orderId: "4801", deliveredDaysAgo: 8 },
        parent: 4,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 2_000,
        actor: "support-agent@1.2.0",
        message: "processRefund({ chargeId, amount: 4820 })",
        parent: 5,
      },
      {
        source: "stripe",
        type: "refund.created",
        delayMs: 2_400,
        message: "re_3PJ4z7… · $48.20 · succeeded",
        payload: { chargeId: "ch_xxx", amount: 4820 },
        parent: 6,
      },
      {
        source: "agent",
        type: "run.complete",
        delayMs: 2_800,
        actor: "support-agent@1.2.0",
        parent: 7,
      },
      {
        source: "intercom",
        type: "conversation.message",
        delayMs: 3_100,
        actor: "support-agent@1.2.0",
        message:
          "Refund of $48.20 issued for order #4801 — funds back in 3–5 business days.",
        parent: 8,
      },
    ],
  },

  {
    traceId: "trc_support_003",
    label: "Refund out of policy · order #3120",
    scenario: "refund-denied",
    status: "warn",
    startMinutesBack: 138,
    durationMs: 2_200,
    customer: "claire@valenz.example",
    slackChannel: "#cx-alerts",
    events: [
      {
        source: "intercom",
        type: "conversation.created",
        delayMs: 0,
        actor: "claire@valenz.example",
        message: "Refund request for order #3120 (purchased Feb 22)",
      },
      {
        source: "agent",
        type: "run.started",
        delayMs: 200,
        actor: "support-agent@1.2.0",
        parent: 0,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 450,
        actor: "support-agent@1.2.0",
        message: "searchOrders({ orderId: '3120' })",
        parent: 1,
      },
      {
        source: "shopify",
        type: "order.fetched",
        delayMs: 750,
        message: "delivered · 67 days ago · $129.00",
        payload: { orderId: "3120", deliveredDaysAgo: 67 },
        parent: 2,
      },
      {
        source: "agent",
        type: "policy.check",
        delayMs: 950,
        actor: "support-agent@1.2.0",
        message: "Outside 60-day refund window — escalating",
        parent: 3,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 1_200,
        actor: "support-agent@1.2.0",
        message: "escalateToHuman({ channel: '#cx-alerts' })",
        parent: 4,
      },
      {
        source: "slack",
        type: "message.posted",
        delayMs: 1_550,
        message: "🟠 Out-of-policy refund · claire@valenz.example",
        payload: { channel: "#cx-alerts" },
        parent: 5,
      },
      {
        source: "agent",
        type: "run.complete",
        delayMs: 1_900,
        actor: "support-agent@1.2.0",
        parent: 6,
      },
      {
        source: "intercom",
        type: "conversation.message",
        delayMs: 2_200,
        actor: "support-agent@1.2.0",
        message:
          "Order #3120 falls outside our 60-day window. A teammate will follow up shortly.",
        parent: 7,
      },
    ],
  },

  {
    traceId: "trc_support_004",
    label: "Missing order error · #9991",
    scenario: "missing-order",
    status: "error",
    startMinutesBack: 240,
    durationMs: 2_500,
    customer: "diego@lumera.example",
    slackChannel: "#cx-alerts",
    events: [
      {
        source: "intercom",
        type: "conversation.created",
        delayMs: 0,
        actor: "diego@lumera.example",
        message: "Tracking #9991 says it's lost?",
      },
      {
        source: "agent",
        type: "run.started",
        delayMs: 200,
        actor: "support-agent@1.2.0",
        parent: 0,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 450,
        actor: "support-agent@1.2.0",
        message: "searchOrders({ orderId: '9991' })",
        parent: 1,
      },
      {
        source: "shopify",
        type: "error.not_found",
        delayMs: 800,
        message: "404 · order_id=9991 not in account",
        payload: { status: 404 },
        parent: 2,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 1_200,
        actor: "support-agent@1.2.0",
        message: "escalateToHuman({ channel: '#cx-alerts', priority: 'high' })",
        parent: 3,
      },
      {
        source: "slack",
        type: "message.posted",
        delayMs: 1_700,
        message: "🔴 Missing order · diego@lumera.example",
        payload: { channel: "#cx-alerts" },
        parent: 4,
      },
      {
        source: "agent",
        type: "run.error",
        delayMs: 2_100,
        actor: "support-agent@1.2.0",
        message: "Order not found in tenant — handed off to human",
        parent: 5,
      },
      {
        source: "intercom",
        type: "conversation.message",
        delayMs: 2_500,
        actor: "support-agent@1.2.0",
        message:
          "I couldn't locate order #9991 on your account — flagging this with our team for a closer look.",
        parent: 6,
      },
    ],
  },

  {
    traceId: "trc_support_005",
    label: "Subscription cancellation · esme@finch",
    scenario: "cancel-subscription",
    status: "ok",
    startMinutesBack: 410,
    durationMs: 2_000,
    customer: "esme@finchpaper.example",
    events: [
      {
        source: "intercom",
        type: "conversation.created",
        delayMs: 0,
        actor: "esme@finchpaper.example",
        message: "Please cancel my subscription at the end of this period.",
      },
      {
        source: "agent",
        type: "run.started",
        delayMs: 180,
        actor: "support-agent@1.2.0",
        parent: 0,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 400,
        actor: "support-agent@1.2.0",
        message: "lookupCustomer({ email })",
        parent: 1,
      },
      {
        source: "intercom",
        type: "user.profile",
        delayMs: 600,
        message: "esme@finchpaper.example · subscriber 8 months",
        parent: 2,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 1_000,
        actor: "support-agent@1.2.0",
        message: "processRefund({ subscription: 'cancel_at_period_end' })",
        parent: 3,
      },
      {
        source: "stripe",
        type: "subscription.updated",
        delayMs: 1_400,
        message: "sub_1NA4z… · cancel_at_period_end=true",
        payload: { cancelAtPeriodEnd: true, periodEnd: "2026-05-22T00:00:00Z" },
        parent: 4,
      },
      {
        source: "agent",
        type: "run.complete",
        delayMs: 1_750,
        actor: "support-agent@1.2.0",
        parent: 5,
      },
      {
        source: "intercom",
        type: "conversation.message",
        delayMs: 2_000,
        actor: "support-agent@1.2.0",
        message:
          "Your subscription is set to cancel on May 22 — you keep access until then.",
        parent: 6,
      },
    ],
  },

  {
    traceId: "trc_support_006",
    label: "Verified refund · order #4790",
    scenario: "multi-step-refund",
    status: "ok",
    startMinutesBack: 1_120,
    durationMs: 4_000,
    customer: "felipe@orsay.example",
    events: [
      {
        source: "intercom",
        type: "conversation.created",
        delayMs: 0,
        actor: "felipe@orsay.example",
        message: "Refund order #4790 — wrong size delivered.",
      },
      {
        source: "agent",
        type: "run.started",
        delayMs: 220,
        actor: "support-agent@1.2.0",
        parent: 0,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 500,
        actor: "support-agent@1.2.0",
        message: "lookupCustomer({ email })",
        parent: 1,
      },
      {
        source: "intercom",
        type: "user.profile",
        delayMs: 800,
        message: "felipe@orsay.example · returning customer",
        parent: 2,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 1_300,
        actor: "support-agent@1.2.0",
        message: "searchOrders({ orderId: '4790' })",
        parent: 3,
      },
      {
        source: "shopify",
        type: "order.fetched",
        delayMs: 1_700,
        message: "delivered · 4 days ago · $84.00",
        parent: 4,
      },
      {
        source: "agent",
        type: "policy.check",
        delayMs: 2_100,
        actor: "support-agent@1.2.0",
        message: "Within 60 days · trusted customer · approved",
        parent: 5,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 2_700,
        actor: "support-agent@1.2.0",
        message: "processRefund({ chargeId, amount: 8400 })",
        parent: 6,
      },
      {
        source: "stripe",
        type: "refund.created",
        delayMs: 3_200,
        message: "re_3PK1z7… · $84.00 · succeeded",
        parent: 7,
      },
      {
        source: "agent",
        type: "run.complete",
        delayMs: 3_700,
        actor: "support-agent@1.2.0",
        parent: 8,
      },
      {
        source: "intercom",
        type: "conversation.message",
        delayMs: 4_000,
        actor: "support-agent@1.2.0",
        message:
          "Refund of $84.00 issued for order #4790 — sorry about the size, prepaid return label inbound.",
        parent: 9,
      },
    ],
  },

  {
    traceId: "trc_support_007",
    label: "FAQ · shipping policy",
    scenario: "faq",
    status: "ok",
    startMinutesBack: 5_400,
    durationMs: 850,
    customer: "gabe@thornwell.example",
    events: [
      {
        source: "intercom",
        type: "conversation.created",
        delayMs: 0,
        actor: "gabe@thornwell.example",
        message: "How long does shipping usually take?",
      },
      {
        source: "agent",
        type: "run.started",
        delayMs: 150,
        actor: "support-agent@1.2.0",
        parent: 0,
      },
      {
        source: "agent",
        type: "knowledge.lookup",
        delayMs: 350,
        actor: "support-agent@1.2.0",
        message: "shipping-policy.md · §2",
        parent: 1,
      },
      {
        source: "agent",
        type: "run.complete",
        delayMs: 600,
        actor: "support-agent@1.2.0",
        parent: 2,
      },
      {
        source: "intercom",
        type: "conversation.message",
        delayMs: 850,
        actor: "support-agent@1.2.0",
        message:
          "Standard shipping is 3–5 business days; express orders ship same-day before 2pm.",
        parent: 3,
      },
    ],
  },
];

/* ── Materializer ──────────────────────────────────────── */

/**
 * Turn a `SupportFlowTrace` into the actual `StreamTimelineEvent`
 * sequence the dashboard renders. Event ids embed the trace id so
 * the timeline's connector overlay can disambiguate.
 */
export function materializeTraceEvents(
  trace: SupportFlowTrace,
): StreamTimelineEvent[] {
  const startMs = SUPPORT_FLOW_ANCHOR_MS - trace.startMinutesBack * 60_000;
  return trace.events.map((tpl, idx) => {
    const occurredMs = startMs + tpl.delayMs;
    const event: StreamTimelineEvent = {
      id: `${trace.traceId}_e${String(idx).padStart(2, "0")}`,
      source: tpl.source,
      type: tpl.type,
      occurredAt: new Date(occurredMs).toISOString(),
      traceId: trace.traceId,
      traceLabel: trace.label,
    };
    if (tpl.actor !== undefined) event.actor = tpl.actor;
    if (tpl.message !== undefined) event.message = tpl.message;
    if (tpl.payload !== undefined) event.payload = tpl.payload;
    if (tpl.parent !== undefined) {
      event.parentEventId = `${trace.traceId}_e${String(tpl.parent).padStart(2, "0")}`;
    }
    return event;
  });
}

/** Flatten every trace's materialized events into one ordered array. */
export function materializeAllEvents(): StreamTimelineEvent[] {
  return SUPPORT_FLOW_TRACES.flatMap(materializeTraceEvents).sort(
    (a, b) =>
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );
}

/** Convenience: pick traces matching one or more scenario tags. */
export function selectTraces(
  scenarios: readonly SupportFlowTrace["scenario"][],
): SupportFlowTrace[] {
  const set = new Set(scenarios);
  return SUPPORT_FLOW_TRACES.filter((t) => set.has(t.scenario));
}

/* ── Background traffic for the timeline view ──────────── */

/**
 * Off-trace webhook arrivals — Intercom heartbeats, Shopify
 * order-updated events, Stripe charges, etc. These don't link to
 * any agent run; they make the live `/dashboard/timeline` feel
 * like a real production stream rather than an empty canvas
 * between conversations.
 *
 * The cadence is intentionally sparse (one event every few
 * minutes) so trace events still stand out when grouped by topic.
 */
interface BackgroundEventSpec {
  source: "intercom" | "shopify" | "stripe" | "slack";
  type: string;
  message: string;
  payload?: Record<string, unknown>;
}

const BACKGROUND_PALETTE: readonly BackgroundEventSpec[] = [
  {
    source: "shopify",
    type: "orders/create",
    message: "order #4901 placed · $138.50",
    payload: { orderId: "4901", amount: 13850 },
  },
  {
    source: "stripe",
    type: "charge.succeeded",
    message: "ch_3PJ4z9 · $138.50 · paid",
    payload: { chargeId: "ch_3PJ4z9" },
  },
  {
    source: "shopify",
    type: "orders/fulfilled",
    message: "order #4895 fulfilled",
    payload: { orderId: "4895", carrier: "DHL" },
  },
  {
    source: "intercom",
    type: "user.profile",
    message: "profile updated · maya@vance.example",
  },
  {
    source: "shopify",
    type: "orders/updated",
    message: "order #4830 status → in_transit",
    payload: { orderId: "4830", status: "in_transit" },
  },
  {
    source: "stripe",
    type: "customer.subscription.updated",
    message: "sub_1NAF · interval changed → annual",
  },
  {
    source: "intercom",
    type: "conversation.created",
    message: "user · pre-sales question (auto-routed)",
  },
  {
    source: "shopify",
    type: "orders/cancelled",
    message: "order #4811 cancelled by customer",
    payload: { orderId: "4811" },
  },
  {
    source: "stripe",
    type: "charge.succeeded",
    message: "ch_3PJ4za · $54.00 · paid",
  },
  {
    source: "shopify",
    type: "orders/create",
    message: "order #4912 placed · $24.00",
    payload: { orderId: "4912", amount: 2400 },
  },
  {
    source: "intercom",
    type: "user.tag.added",
    message: "tagged · vip · raghav@kavalan.example",
  },
];

/**
 * Materialise the full timeline view: trace events for the seven
 * conversations + a sprinkling of background webhook events so
 * the dashboard doesn't render long empty gaps between traces.
 */
export function materializeTimelineEvents(): StreamTimelineEvent[] {
  const traceEvents = materializeAllEvents();
  /* Spread background events evenly across the same window the
     trace events span. Pick start = oldest trace, end = anchor. */
  const oldestMs =
    SUPPORT_FLOW_ANCHOR_MS -
    Math.max(...SUPPORT_FLOW_TRACES.map((t) => t.startMinutesBack)) *
      60_000 -
    5 * 60_000;
  const newestMs = SUPPORT_FLOW_ANCHOR_MS - 60_000;
  const span = newestMs - oldestMs;
  const background: StreamTimelineEvent[] = BACKGROUND_PALETTE.map(
    (spec, idx) => {
      const t = oldestMs + (span * (idx + 0.5)) / BACKGROUND_PALETTE.length;
      return {
        id: `bg_support_${String(idx).padStart(2, "0")}`,
        source: spec.source,
        type: spec.type,
        occurredAt: new Date(t).toISOString(),
        message: spec.message,
        payload: spec.payload,
      };
    },
  );
  return [...traceEvents, ...background].sort(
    (a, b) =>
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );
}
