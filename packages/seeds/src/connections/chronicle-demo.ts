/*
 * Chronicle-demo connections seed.
 *
 * Four connections — Intercom, Stripe, Salesforce, Postgres (the
 * product database) — exactly the set the `billing-agent`'s tools
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
  CHRONICLE_DEMO_ANCHOR_MS,
  CHRONICLE_DEMO_CONNECTION_IDS,
  CHRONICLE_DEMO_TRACES,
  type ChronicleDemoSource,
} from "../_scenarios/chronicle-demo";
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

const ANCHOR = CHRONICLE_DEMO_ANCHOR_MS;

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
    id: CHRONICLE_DEMO_CONNECTION_IDS.intercom,
    source: "intercom",
    name: "Intercom · production",
    health: "live",
    connectedAt: iso(120, -8),
    lastEventAt: iso(0, -0.3),
    eventsLast24h: 3_240,
    prevEventsLast24h: 3_180,
    scopes: ["read_conversations", "write_conversations", "read_users"],
    ownerEmail: "billing@chronicle.io",
    spark: sparkline(160),
    lastTestedAt: iso(0, -3),
    lastTestStatus: "ok",
  },
  {
    id: CHRONICLE_DEMO_CONNECTION_IDS.stripe,
    source: "stripe",
    name: "Stripe · live mode",
    health: "live",
    connectedAt: iso(120, -7),
    lastEventAt: iso(0, -0.2),
    eventsLast24h: 1_840,
    prevEventsLast24h: 1_790,
    scopes: [
      "charge.read",
      "refund.write",
      "subscription.read",
      "subscription.write",
      "invoice.read",
    ],
    ownerEmail: "billing@chronicle.io",
    spark: sparkline(80),
    lastTestedAt: iso(0, -3),
    lastTestStatus: "ok",
  },
  {
    id: CHRONICLE_DEMO_CONNECTION_IDS.salesforce,
    source: "salesforce",
    name: "Salesforce · production org",
    health: "live",
    connectedAt: iso(120, -6),
    lastEventAt: iso(0, -1),
    eventsLast24h: 412,
    prevEventsLast24h: 398,
    scopes: ["api", "refresh_token", "read_accounts", "read_opportunities"],
    ownerEmail: "rev-ops@chronicle.io",
    spark: sparkline(28),
    lastTestedAt: iso(0, -3),
    lastTestStatus: "ok",
  },
  {
    id: CHRONICLE_DEMO_CONNECTION_IDS.productDb,
    source: "postgres",
    name: "Postgres · product database",
    health: "live",
    connectedAt: iso(120, -5),
    lastEventAt: iso(0, -0.1),
    eventsLast24h: 5_120,
    prevEventsLast24h: 4_980,
    scopes: ["replication.read", "tables.tenants", "tables.audit_log"],
    ownerEmail: "platform@chronicle.io",
    spark: sparkline(220),
    lastTestedAt: iso(0, -3),
    lastTestStatus: "ok",
  },
];

/* ── Backfills (per-connection) ──────────────────────── */

const backfillsByConnection: Record<string, ConnectionBackfillRecord[]> = {
  [CHRONICLE_DEMO_CONNECTION_IDS.intercom]: [
    {
      id: "bf_cd_intercom_initial",
      windowDays: 30,
      entities: ["conversations", "users", "tags"],
      estEvents: 9_800,
      startedAt: iso(120, -7.5),
      finishedAt: iso(120, -6),
      status: "done",
    },
  ],
  [CHRONICLE_DEMO_CONNECTION_IDS.stripe]: [
    {
      id: "bf_cd_stripe_initial",
      windowDays: 90,
      entities: ["charges", "refunds", "subscriptions", "invoices"],
      estEvents: 14_220,
      startedAt: iso(120, -6.5),
      finishedAt: iso(120, -3),
      status: "done",
    },
    {
      id: "bf_cd_stripe_refresh",
      windowDays: 7,
      entities: ["subscriptions", "invoices"],
      estEvents: 1_180,
      startedAt: iso(7, -2),
      finishedAt: iso(7, -1),
      status: "done",
    },
  ],
  [CHRONICLE_DEMO_CONNECTION_IDS.salesforce]: [
    {
      id: "bf_cd_salesforce_initial",
      windowDays: 90,
      entities: ["accounts", "opportunities", "contacts", "cases"],
      estEvents: 4_240,
      startedAt: iso(120, -5.5),
      finishedAt: iso(120, -3.5),
      status: "done",
    },
  ],
  [CHRONICLE_DEMO_CONNECTION_IDS.productDb]: [
    {
      id: "bf_cd_postgres_initial",
      windowDays: 30,
      entities: ["tables"],
      estEvents: 18_400,
      startedAt: iso(120, -4),
      finishedAt: iso(120, -2),
      status: "done",
    },
  ],
};

/* ── Deliveries (Activity tab) ───────────────────────── */

/* Pull recent events from the trace blueprints. The Activity tab
   renders short wall-clock strings, not full ISOs — extract HH:MM:SS
   from the materialised timestamp. */
function deliveriesFromTraces(
  source: Exclude<ChronicleDemoSource, "agent">,
): ConnectionDelivery[] {
  const out: ConnectionDelivery[] = [];
  for (const trace of CHRONICLE_DEMO_TRACES) {
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
  [CHRONICLE_DEMO_CONNECTION_IDS.intercom]: deliveriesFromTraces("intercom"),
  [CHRONICLE_DEMO_CONNECTION_IDS.stripe]: deliveriesFromTraces("stripe"),
  [CHRONICLE_DEMO_CONNECTION_IDS.salesforce]:
    deliveriesFromTraces("salesforce"),
  [CHRONICLE_DEMO_CONNECTION_IDS.productDb]: deliveriesFromTraces("postgres"),
};

/* ── Event-type subscriptions ────────────────────────── */

const eventSubsByConnection: Record<string, ConnectionEventTypeSub[]> = {
  [CHRONICLE_DEMO_CONNECTION_IDS.intercom]: [
    {
      id: "conversation.created",
      object: "conversation",
      enabled: true,
      defaultOn: true,
    },
    {
      id: "conversation.message",
      object: "conversation",
      enabled: true,
      defaultOn: true,
    },
    {
      id: "user.profile",
      object: "user",
      enabled: true,
      defaultOn: true,
    },
    {
      id: "user.tag.added",
      object: "user",
      enabled: false,
      defaultOn: false,
    },
  ],
  [CHRONICLE_DEMO_CONNECTION_IDS.stripe]: [
    {
      id: "customer.subscription.created",
      object: "subscription",
      enabled: true,
      defaultOn: true,
    },
    {
      id: "customer.subscription.updated",
      object: "subscription",
      enabled: true,
      defaultOn: true,
    },
    {
      id: "customer.subscription.deleted",
      object: "subscription",
      enabled: true,
      defaultOn: true,
    },
    {
      id: "invoice.paid",
      object: "invoice",
      enabled: true,
      defaultOn: true,
    },
    {
      id: "invoice.payment_failed",
      object: "invoice",
      enabled: true,
      defaultOn: true,
    },
    {
      id: "charge.refunded",
      object: "charge",
      enabled: true,
      defaultOn: true,
    },
  ],
  [CHRONICLE_DEMO_CONNECTION_IDS.salesforce]: [
    {
      id: "account.updated",
      object: "account",
      enabled: true,
      defaultOn: true,
    },
    {
      id: "opportunity.updated",
      object: "opportunity",
      enabled: true,
      defaultOn: true,
    },
    {
      id: "case.updated",
      object: "case",
      enabled: true,
      defaultOn: true,
    },
    {
      id: "contact.updated",
      object: "contact",
      enabled: false,
      defaultOn: false,
    },
  ],
  [CHRONICLE_DEMO_CONNECTION_IDS.productDb]: [
    {
      id: "row.inserted",
      object: "tenants",
      enabled: true,
      defaultOn: true,
    },
    {
      id: "row.updated",
      object: "tenants",
      enabled: true,
      defaultOn: true,
    },
    {
      id: "row.fetched",
      object: "tenants",
      enabled: true,
      defaultOn: false,
    },
  ],
};

/* ── Seed factory ────────────────────────────────────── */

export const chronicleDemoConnectionsSeed: ConnectionsSeed = {
  id: "chronicle-demo",
  label: "Chronicle demo (billing)",
  description:
    "4 connections (Intercom · Stripe · Salesforce · Postgres) wired to the `billing-agent` tools, with realistic deliveries.",
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
      "connections:chronicle-demo connections",
    );
    validateInDev(
      BackfillsByConnectionSchema,
      clonedBackfills,
      "connections:chronicle-demo backfillsByConnection",
    );
    validateInDev(
      DeliveriesByConnectionSchema,
      clonedDeliveries,
      "connections:chronicle-demo deliveriesByConnection",
    );
    validateInDev(
      EventSubsByConnectionSchema,
      clonedSubs,
      "connections:chronicle-demo eventSubsByConnection",
    );
    return {
      connections: cloned,
      backfillsByConnection: clonedBackfills,
      deliveriesByConnection: clonedDeliveries,
      eventSubsByConnection: clonedSubs,
    };
  },
};
