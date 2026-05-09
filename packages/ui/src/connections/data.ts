/*
 * Connections — runtime + management surface for the dashboard.
 *
 * Wire shapes now live in `chronicle/types/connections` (auto-derived
 * from the matching Rust crate). This file re-exports them for
 * ergonomic imports inside the design system and keeps the
 * Storybook fixtures + filter helpers below.
 *
 * Stays separate from `../onboarding/data.ts` (catalog) and
 * `../connectors/data.ts` (per-vendor scope/event reference) — those
 * are static design-time data; this file describes the per-tenant
 * runtime the dashboard panels render.
 */

import type {
  Connection,
  ConnectionBackfillRecord,
  ConnectionDelivery,
  ConnectionEventTypeSub,
  ConnectionHealth,
} from "chronicle/types/connections";

export type {
  Connection,
  ConnectionBackfillRecord,
  ConnectionBackfillStatus,
  ConnectionDelivery,
  ConnectionEventTypeSub,
  ConnectionHealth,
  ConnectionTestStatus,
  ConnectorErrorKind,
} from "chronicle/types/connections";

/* ── Seed data ─────────────────────────────────────────────── */

const sparkSeed = (peak: number, jitter = 0.35): number[] => {
  const buckets = 24;
  const out: number[] = [];
  for (let i = 0; i < buckets; i += 1) {
    const phase = i / (buckets - 1);
    const base = peak * (0.55 + 0.45 * Math.sin(phase * Math.PI));
    const noise = base * jitter * (Math.sin(i * 1.7) + Math.cos(i * 0.9)) * 0.5;
    out.push(Math.max(0, Math.round(base + noise)));
  }
  return out;
};

/**
 * Default seed used by stories + the dashboard placeholder. Mixes
 * `live`, `expired`, `error`, and `paused` rows so the badge palette
 * gets exercised.
 */
export const connectionsSeed: readonly Connection[] = [
  {
    id: "conn_intercom_01",
    source: "intercom",
    name: "Intercom · production",
    health: "live",
    connectedAt: "2026-01-12T18:04:00Z",
    lastEventAt: "2026-05-01T13:02:14Z",
    eventsLast24h: 5_412,
    prevEventsLast24h: 4_820,
    scopes: ["read_conversations", "read_users", "write_tags"],
    ownerEmail: "ops@chronicle.io",
    spark: sparkSeed(240),
    lastTestedAt: "2026-04-30T19:14:00Z",
    lastTestStatus: "ok",
  },
  {
    id: "conn_shopify_01",
    source: "shopify",
    name: "Shopify · checkout",
    health: "live",
    connectedAt: "2026-01-12T18:09:00Z",
    lastEventAt: "2026-05-01T13:02:01Z",
    eventsLast24h: 3_104,
    prevEventsLast24h: 3_540,
    scopes: ["read_orders", "read_customers", "read_products"],
    ownerEmail: "ops@chronicle.io",
    spark: sparkSeed(160),
    lastTestedAt: "2026-04-29T12:00:00Z",
    lastTestStatus: "ok",
  },
  {
    id: "conn_stripe_01",
    source: "stripe",
    name: "Stripe · live mode",
    health: "live",
    connectedAt: "2026-01-12T18:21:00Z",
    lastEventAt: "2026-05-01T13:01:48Z",
    eventsLast24h: 1_982,
    prevEventsLast24h: 1_812,
    scopes: ["charge.read", "customer.read", "subscription.read"],
    ownerEmail: "billing@chronicle.io",
    spark: sparkSeed(110),
    lastTestedAt: "2026-04-15T09:21:00Z",
    lastTestStatus: "ok",
  },
  {
    id: "conn_slack_01",
    source: "slack",
    name: "Slack · #cx-alerts",
    health: "paused",
    connectedAt: "2026-02-04T11:00:00Z",
    lastEventAt: "2026-04-29T08:14:00Z",
    eventsLast24h: 0,
    scopes: ["channels:read", "channels:history", "users:read"],
    spark: sparkSeed(40, 0.15),
  },
  {
    id: "conn_hubspot_01",
    source: "hubspot",
    name: "HubSpot · main",
    health: "expired",
    connectedAt: "2026-01-30T08:00:00Z",
    lastEventAt: "2026-04-30T22:12:00Z",
    eventsLast24h: 142,
    scopes: ["crm.objects.contacts.read", "crm.objects.deals.read"],
    expiresAt: "2026-04-30T22:12:00Z",
    spark: sparkSeed(60),
  },
  {
    id: "conn_zendesk_01",
    source: "zendesk",
    name: "Zendesk · support",
    health: "error",
    connectedAt: "2026-02-14T12:00:00Z",
    lastEventAt: "2026-05-01T11:48:02Z",
    eventsLast24h: 84,
    scopes: ["read"],
    errorKind: "signature",
    errorPayload: `{
  "error": "invalid_signature",
  "received": "v1=8c7e…",
  "expected": "v1=ba2f…",
  "ts": 1714250000
}`,
    spark: sparkSeed(70, 0.45),
  },
  {
    id: "conn_segment_01",
    source: "segment",
    name: "Segment · web",
    health: "live",
    connectedAt: "2026-03-02T09:30:00Z",
    lastEventAt: "2026-05-01T13:02:18Z",
    eventsLast24h: 11_402,
    scopes: ["track:read", "identify:read"],
    spark: sparkSeed(540),
  },
  {
    id: "conn_postgres_01",
    source: "postgres",
    name: "Postgres · primary",
    health: "live",
    connectedAt: "2026-03-18T14:00:00Z",
    lastEventAt: "2026-05-01T13:02:20Z",
    eventsLast24h: 4_220,
    scopes: ["replication"],
    spark: sparkSeed(220),
  },
];

/* ── Backfill history seed (per-connection) ────────────────── */

export const connectionBackfillsSeed: Readonly<
  Record<string, ConnectionBackfillRecord[]>
> = {
  conn_intercom_01: [
    {
      id: "bf_01",
      windowDays: 30,
      entities: ["conversations", "contacts"],
      estEvents: 5_400,
      startedAt: "2026-01-12T18:05:00Z",
      finishedAt: "2026-01-12T19:02:00Z",
      status: "done",
    },
    {
      id: "bf_02",
      windowDays: 7,
      entities: ["conversations"],
      estEvents: 1_240,
      startedAt: "2026-04-21T07:00:00Z",
      finishedAt: "2026-04-21T07:14:00Z",
      status: "done",
    },
  ],
  conn_stripe_01: [
    {
      id: "bf_03",
      windowDays: 90,
      entities: ["charges", "customers", "invoices"],
      estEvents: 35_120,
      startedAt: "2026-01-12T18:22:00Z",
      finishedAt: "2026-01-12T20:08:00Z",
      status: "done",
    },
  ],
  conn_zendesk_01: [
    {
      id: "bf_04",
      windowDays: 14,
      entities: ["tickets"],
      estEvents: 1_960,
      startedAt: "2026-04-28T03:00:00Z",
      status: "running",
    },
  ],
};

/* ── Recent deliveries seed (Activity tab) ─────────────────── */

export const connectionDeliveriesSeed: Readonly<
  Record<string, ConnectionDelivery[]>
> = {
  conn_intercom_01: [
    {
      ts: "13:02:14",
      method: "POST",
      preview: "conversation.message · c_48c1",
      status: 200,
    },
    {
      ts: "13:02:09",
      method: "POST",
      preview: "conversation.created · c_48c1",
      status: 200,
    },
    {
      ts: "13:01:55",
      method: "POST",
      preview: "user.tag.added · u_2391",
      status: 200,
    },
  ],
  conn_zendesk_01: [
    {
      ts: "11:48:02",
      method: "POST",
      preview: "ticket.updated · #28492",
      status: 401,
    },
    {
      ts: "11:47:58",
      method: "POST",
      preview: "ticket.updated · #28491",
      status: 401,
    },
    {
      ts: "11:47:55",
      method: "POST",
      preview: "ticket.created · #28490",
      status: 200,
    },
  ],
};

/* ── Event-type subscriptions seed ─────────────────────────── */

export const connectionEventSubsSeed: Readonly<
  Record<string, ConnectionEventTypeSub[]>
> = {
  conn_stripe_01: [
    { id: "charge.succeeded", object: "charge", enabled: true, defaultOn: true },
    { id: "charge.failed", object: "charge", enabled: true, defaultOn: true },
    { id: "charge.refunded", object: "charge", enabled: true, defaultOn: true },
    {
      id: "customer.subscription.created",
      object: "subscription",
      enabled: true,
      defaultOn: true,
    },
    {
      id: "customer.subscription.deleted",
      object: "subscription",
      enabled: false,
      defaultOn: true,
    },
    { id: "invoice.paid", object: "invoice", enabled: true, defaultOn: true },
    {
      id: "invoice.payment_failed",
      object: "invoice",
      enabled: true,
      defaultOn: true,
    },
    {
      id: "payout.paid",
      object: "payout",
      enabled: false,
      defaultOn: false,
    },
  ],
};

/* ── Filter helpers ────────────────────────────────────────── */

/** Subset of `ConnectionHealth` rendered in the toolbar's chip strip. */
export const CONNECTION_HEALTH_FILTERS: readonly ConnectionHealth[] = [
  "live",
  "paused",
  "error",
  "expired",
  "testing",
  "disconnected",
];

/** Lookup helper used by row/card components. */
export function getConnection(
  id: string,
  list: readonly Connection[] = connectionsSeed,
): Connection | undefined {
  return list.find((c) => c.id === id);
}
