/*
 * Support-flow connections seed.
 *
 * Four connections — the exact set the `support-agent`'s tools
 * call. Deliveries are derived from the trace events so the
 * Activity tab on each row shows the same conversations that
 * appear in the Timeline + Datasets surfaces.
 */

import {
  ConnectionBackfillRecordSchema,
  ConnectionDeliverySchema,
  ConnectionEventTypeSubSchema,
  ConnectionSchema,
} from "chronicle/schemas/connections";
import type {
  Connection,
  ConnectionBackfillRecord,
  ConnectionDelivery,
  ConnectionEventTypeSub,
} from "chronicle/types/connections";
import { z } from "zod";

import { validateInDev } from "../_validate";
import {
  SUPPORT_FLOW_ANCHOR_MS,
  SUPPORT_FLOW_CONNECTION_IDS,
  SUPPORT_FLOW_TRACES,
} from "../_scenarios/support-flow";
import type { ConnectionsSeed, ConnectionsSeedData } from "./types";

const ConnectionListSchema = z.array(ConnectionSchema);
const BackfillsByConnectionSchema = z.record(
  z.array(ConnectionBackfillRecordSchema),
);
const DeliveriesByConnectionSchema = z.record(
  z.array(ConnectionDeliverySchema),
);
const EventSubsByConnectionSchema = z.record(
  z.array(ConnectionEventTypeSubSchema),
);

const ANCHOR = SUPPORT_FLOW_ANCHOR_MS;

/* Sparkline matches the agent's actual usage profile so all four
   rows show similar patterns of activity. */
function sparkline(peak: number, jitter = 0.3): number[] {
  const out: number[] = [];
  for (let i = 0; i < 24; i += 1) {
    const phase = i / 23;
    const base = peak * (0.55 + 0.45 * Math.sin(phase * Math.PI));
    const noise = base * jitter * (Math.sin(i * 1.7) + Math.cos(i * 0.9)) * 0.5;
    out.push(Math.max(0, Math.round(base + noise)));
  }
  return out;
}

const iso = (offsetDays: number, hours = 12): string =>
  new Date(ANCHOR - offsetDays * 86_400_000 + hours * 3_600_000).toISOString();

/* ── Connections (4) ─────────────────────────────────── */

const connections: Connection[] = [
  {
    id: SUPPORT_FLOW_CONNECTION_IDS.intercom,
    source: "intercom",
    name: "Intercom · production",
    health: "live",
    connectedAt: iso(112, -8), // ~Jan 7
    lastEventAt: iso(0, -0.2),
    eventsLast24h: 4_120,
    prevEventsLast24h: 3_980,
    scopes: [
      "read_conversations",
      "write_conversations",
      "read_users",
      "write_tags",
    ],
    ownerEmail: "support@chronicle.io",
    spark: sparkline(190),
    lastTestedAt: iso(0, -3),
    lastTestStatus: "ok",
  },
  {
    id: SUPPORT_FLOW_CONNECTION_IDS.shopify,
    source: "shopify",
    name: "Shopify · checkout",
    health: "live",
    connectedAt: iso(112, -7),
    lastEventAt: iso(0, -0.1),
    eventsLast24h: 2_310,
    prevEventsLast24h: 2_280,
    scopes: ["read_orders", "read_customers", "read_products"],
    ownerEmail: "support@chronicle.io",
    spark: sparkline(110),
    lastTestedAt: iso(0, -3),
    lastTestStatus: "ok",
  },
  {
    id: SUPPORT_FLOW_CONNECTION_IDS.stripe,
    source: "stripe",
    name: "Stripe · live mode",
    health: "live",
    connectedAt: iso(112, -7),
    lastEventAt: iso(0, -0.5),
    eventsLast24h: 612,
    prevEventsLast24h: 580,
    scopes: ["charge.read", "refund.write", "subscription.read", "subscription.write"],
    ownerEmail: "billing@chronicle.io",
    spark: sparkline(36),
    lastTestedAt: iso(0, -3),
    lastTestStatus: "ok",
  },
  {
    id: SUPPORT_FLOW_CONNECTION_IDS.slack,
    source: "slack",
    name: "Slack · #cx-alerts",
    health: "live",
    connectedAt: iso(112, -6),
    lastEventAt: iso(0, -4), // last escalation 4h before anchor
    eventsLast24h: 18,
    prevEventsLast24h: 24,
    scopes: ["channels:read", "chat:write", "users:read"],
    spark: sparkline(2, 0.6),
  },
];

/* ── Backfills (per-connection) ──────────────────────── */

const backfillsByConnection: Record<string, ConnectionBackfillRecord[]> = {
  [SUPPORT_FLOW_CONNECTION_IDS.intercom]: [
    {
      id: "bf_intercom_initial",
      windowDays: 30,
      entities: ["conversations", "users", "tags"],
      estEvents: 12_400,
      startedAt: iso(112, -7.5),
      finishedAt: iso(112, -6),
      status: "done",
    },
  ],
  [SUPPORT_FLOW_CONNECTION_IDS.shopify]: [
    {
      id: "bf_shopify_initial",
      windowDays: 90,
      entities: ["orders", "customers"],
      estEvents: 28_900,
      startedAt: iso(112, -6.5),
      finishedAt: iso(112, -3),
      status: "done",
    },
    {
      id: "bf_shopify_refresh",
      windowDays: 7,
      entities: ["orders"],
      estEvents: 2_140,
      startedAt: iso(7, -2),
      finishedAt: iso(7, -1),
      status: "done",
    },
  ],
  [SUPPORT_FLOW_CONNECTION_IDS.stripe]: [
    {
      id: "bf_stripe_initial",
      windowDays: 30,
      entities: ["charges", "refunds", "subscriptions"],
      estEvents: 6_280,
      startedAt: iso(112, -6),
      finishedAt: iso(112, -5),
      status: "done",
    },
  ],
};

/* ── Deliveries (Activity tab) ───────────────────────── */

/* Pull recent events from the trace blueprints. The Activity tab
   renders short wall-clock strings, not full ISOs — extract HH:MM:SS
   from the materialised timestamp. */
function deliveriesFromTraces(
  source: "intercom" | "shopify" | "stripe" | "slack",
): ConnectionDelivery[] {
  const out: ConnectionDelivery[] = [];
  for (const trace of SUPPORT_FLOW_TRACES) {
    const startMs = ANCHOR - trace.startMinutesBack * 60_000;
    for (const ev of trace.events) {
      if (ev.source !== source) continue;
      const occurredMs = startMs + ev.delayMs;
      const date = new Date(occurredMs);
      const hh = String(date.getUTCHours()).padStart(2, "0");
      const mm = String(date.getUTCMinutes()).padStart(2, "0");
      const ss = String(date.getUTCSeconds()).padStart(2, "0");
      const status =
        ev.type.includes("error") || ev.type.includes("not_found") ? 404 : 200;
      out.push({
        ts: `${hh}:${mm}:${ss}`,
        method: "POST",
        preview: `${ev.type} · ${ev.message ?? ev.actor ?? "—"}`,
        status,
      });
    }
  }
  return out
    .sort((a, b) => (a.ts > b.ts ? -1 : a.ts < b.ts ? 1 : 0))
    .slice(0, 8);
}

const deliveriesByConnection: Record<string, ConnectionDelivery[]> = {
  [SUPPORT_FLOW_CONNECTION_IDS.intercom]: deliveriesFromTraces("intercom"),
  [SUPPORT_FLOW_CONNECTION_IDS.shopify]: deliveriesFromTraces("shopify"),
  [SUPPORT_FLOW_CONNECTION_IDS.stripe]: deliveriesFromTraces("stripe"),
  [SUPPORT_FLOW_CONNECTION_IDS.slack]: deliveriesFromTraces("slack"),
};

/* ── Event-type subscriptions ────────────────────────── */

const eventSubsByConnection: Record<string, ConnectionEventTypeSub[]> = {
  [SUPPORT_FLOW_CONNECTION_IDS.intercom]: [
    { id: "conversation.created", object: "conversation", enabled: true, defaultOn: true },
    { id: "conversation.message", object: "conversation", enabled: true, defaultOn: true },
    { id: "user.profile", object: "user", enabled: true, defaultOn: true },
    { id: "user.tag.added", object: "user", enabled: false, defaultOn: false },
  ],
  [SUPPORT_FLOW_CONNECTION_IDS.shopify]: [
    { id: "orders/create", object: "order", enabled: true, defaultOn: true },
    { id: "orders/updated", object: "order", enabled: true, defaultOn: true },
    { id: "orders/fulfilled", object: "order", enabled: true, defaultOn: true },
    { id: "orders/cancelled", object: "order", enabled: false, defaultOn: false },
    { id: "customers/create", object: "customer", enabled: false, defaultOn: false },
  ],
  [SUPPORT_FLOW_CONNECTION_IDS.stripe]: [
    { id: "charge.succeeded", object: "charge", enabled: true, defaultOn: true },
    { id: "charge.refunded", object: "charge", enabled: true, defaultOn: true },
    { id: "customer.subscription.updated", object: "subscription", enabled: true, defaultOn: true },
    { id: "customer.subscription.deleted", object: "subscription", enabled: true, defaultOn: true },
    { id: "invoice.payment_failed", object: "invoice", enabled: false, defaultOn: false },
  ],
  [SUPPORT_FLOW_CONNECTION_IDS.slack]: [
    { id: "message.posted", enabled: true, defaultOn: true },
    { id: "message.reply", enabled: false, defaultOn: false },
  ],
};

/* ── Seed factory ────────────────────────────────────── */

export const supportFlowConnectionsSeed: ConnectionsSeed = {
  id: "support-flow",
  label: "Support flow",
  description:
    "4 connections (Intercom · Shopify · Stripe · Slack) wired to the `support-agent` tools, with realistic deliveries.",
  build(): ConnectionsSeedData {
    const cloned = structuredClone(connections) as Connection[];
    const clonedBackfills = structuredClone(backfillsByConnection) as Record<
      string,
      ConnectionBackfillRecord[]
    >;
    const clonedDeliveries = structuredClone(deliveriesByConnection) as Record<
      string,
      ConnectionDelivery[]
    >;
    const clonedSubs = structuredClone(eventSubsByConnection) as Record<
      string,
      ConnectionEventTypeSub[]
    >;
    validateInDev(
      ConnectionListSchema,
      cloned,
      "connections:support-flow connections",
    );
    validateInDev(
      BackfillsByConnectionSchema,
      clonedBackfills,
      "connections:support-flow backfillsByConnection",
    );
    validateInDev(
      DeliveriesByConnectionSchema,
      clonedDeliveries,
      "connections:support-flow deliveriesByConnection",
    );
    validateInDev(
      EventSubsByConnectionSchema,
      clonedSubs,
      "connections:support-flow eventSubsByConnection",
    );
    return {
      connections: cloned,
      backfillsByConnection: clonedBackfills,
      deliveriesByConnection: clonedDeliveries,
      eventSubsByConnection: clonedSubs,
    };
  },
};
