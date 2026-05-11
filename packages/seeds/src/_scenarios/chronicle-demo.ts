/*
 * Chronicle demo — the SaaS-billing scenario from the 3-minute
 * product walkthrough.
 *
 * The story:
 *
 *   A single `billing-agent` (Vercel AI SDK, version 1.0.0) handles
 *   inbound customer billing requests for a subscription software
 *   company. It owns five tools backed by four connections:
 *
 *     - lookupCustomer       → Intercom
 *     - lookupAccount        → Salesforce
 *     - checkBilling         → Stripe
 *     - issueRefund          → Stripe
 *     - updateSubscription   → Stripe
 *     - checkProductAccess   → Postgres (product DB)
 *     - updateProductAccess  → Postgres (product DB)
 *
 *   Seven traces — four "happy path" outcomes the team remembered to
 *   test (cancel-at-period-end, double-charge refund, plan change,
 *   in-policy refund) and three high-risk traces Chronicle flags as
 *   exactly the scenarios production creates that nobody wrote on a
 *   whiteboard:
 *
 *     1. unauthorized-cancel — a contractor (not the billing admin)
 *        cancels the company account; agent didn't verify ownership.
 *     2. over-refund — agent issues a $1,200 cash refund when policy
 *        allows a $42 account credit.
 *     3. state-mismatch — Stripe says active, Salesforce says renewal
 *        pending, product DB says expired; agent replies "all fixed".
 *
 *   Failed traces resolve to `status: "warn"` so the agent's run
 *   still reads `success` — the agent didn't crash, it did the
 *   wrong thing successfully. That is the whole point of the demo:
 *   the answer sounded right, the world was still broken.
 *
 * This module exports the raw materials. Per-domain seed files
 * (`connections/chronicle-demo.ts`, `agents/chronicle-demo.ts`,
 * `datasets/chronicle-demo.ts`) import these and adapt to their
 * own wire shapes.
 */

import type { StreamTimelineEvent } from "chronicle/types/datasets";

/* ── Anchors + identity constants ──────────────────────── */

/** Fixed wall-clock anchor so every fixture timestamp is
 *  deterministic. Picked far enough in the past that "last 7 days"
 *  semantics still feel current when rebased to `Date.now()` by
 *  the seed util. */
export const CHRONICLE_DEMO_ANCHOR_MS = Date.UTC(2026, 4, 6, 16, 0, 0);

export const CHRONICLE_DEMO_AGENT_NAME = "billing-agent";
export const CHRONICLE_DEMO_AGENT_CURRENT = "1.0.0";
export const CHRONICLE_DEMO_AGENT_VERSIONS = ["1.0.0"] as const;
export type ChronicleDemoAgentVersion =
  (typeof CHRONICLE_DEMO_AGENT_VERSIONS)[number];

/** Stable connection ids. Used by every domain seed so a delivery
 *  row in connections/ ties to the same conversation a trace row
 *  in datasets/ shows. */
export const CHRONICLE_DEMO_CONNECTION_IDS = {
  intercom: "conn_chronicle_demo_intercom",
  stripe: "conn_chronicle_demo_stripe",
  salesforce: "conn_chronicle_demo_salesforce",
  productDb: "conn_chronicle_demo_postgres",
} as const;

/* ── Trace blueprints ──────────────────────────────────── */

/** Sources that show up in trace events. `postgres` doubles as the
 *  product database in the demo narrative. */
export type ChronicleDemoSource =
  | "intercom"
  | "stripe"
  | "salesforce"
  | "postgres"
  | "agent";

/**
 * Compact event template — the `delayMs` is the offset from the
 * trace's `startMs`, and `parent` is an index into the same event
 * array. The materializer fills in concrete IDs + ISO timestamps.
 */
export interface ChronicleDemoEventTpl {
  source: ChronicleDemoSource;
  type: string;
  delayMs: number;
  actor?: string;
  message?: string;
  payload?: Record<string, unknown>;
  /** Index in the same trace's events array. Omit for the root. */
  parent?: number;
}

export type ChronicleDemoFlagKind =
  | "unauthorized-cancel"
  | "over-refund"
  | "state-mismatch";

export interface ChronicleDemoFlag {
  /** Tag the dataset detail page can group by. */
  kind: ChronicleDemoFlagKind;
  /** Human-readable verdict copy — surfaces verbatim as the trace
   *  membership note in the dataset row. */
  note: string;
}

export type ChronicleDemoScenario =
  | "cancel-billing-admin"
  | "double-charge-refund"
  | "plan-change"
  | "in-policy-refund"
  | "unauthorized-cancel"
  | "over-refund"
  | "state-mismatch";

export interface ChronicleDemoTrace {
  traceId: string;
  label: string;
  scenario: ChronicleDemoScenario;
  status: "ok" | "warn" | "error";
  /** Minutes before the anchor when the trace started. Higher =
   *  older. Spread across the last 7 days so stories show "last
   *  Sunday" etc. */
  startMinutesBack: number;
  /** End-to-end duration in ms. Sum of `delayMs` plus a tail. */
  durationMs: number;
  /** Customer / actor that started this conversation. */
  customer: string;
  events: readonly ChronicleDemoEventTpl[];
  /** Present iff the trace is flagged by Chronicle. */
  flag?: ChronicleDemoFlag;
}

/* ── The seven traces ──────────────────────────────────── */

export const CHRONICLE_DEMO_TRACES: readonly ChronicleDemoTrace[] = [
  /* ── Happy path · cancel at period end ──────────────── */
  {
    traceId: "trc_demo_001",
    label: "Cancel subscription · Hartwell, billing admin",
    scenario: "cancel-billing-admin",
    status: "ok",
    startMinutesBack: 18,
    durationMs: 2_100,
    customer: "harriet@hartwellindustries.example",
    events: [
      {
        source: "intercom",
        type: "conversation.created",
        delayMs: 0,
        actor: "harriet@hartwellindustries.example",
        message: "Please cancel my subscription at the end of this period.",
      },
      {
        source: "agent",
        type: "run.started",
        delayMs: 180,
        actor: "billing-agent@1.0.0",
        parent: 0,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 380,
        actor: "billing-agent@1.0.0",
        message: "lookupCustomer({ email })",
        parent: 1,
      },
      {
        source: "intercom",
        type: "user.profile",
        delayMs: 580,
        message: "harriet@hartwellindustries.example · billing admin",
        payload: { role: "billing_admin", company: "Hartwell Industries" },
        parent: 2,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 860,
        actor: "billing-agent@1.0.0",
        message: "lookupAccount({ company: 'Hartwell Industries' })",
        parent: 3,
      },
      {
        source: "salesforce",
        type: "account.fetched",
        delayMs: 1_120,
        message: "Hartwell Industries · Pro plan · billing owner verified",
        payload: { billingOwner: "harriet@hartwellindustries.example" },
        parent: 4,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 1_400,
        actor: "billing-agent@1.0.0",
        message:
          "updateSubscription({ subscriptionId: 'sub_HW01', cancelAtPeriodEnd: true })",
        parent: 5,
      },
      {
        source: "stripe",
        type: "customer.subscription.updated",
        delayMs: 1_700,
        message: "sub_HW01 · cancel_at_period_end=true",
        payload: { cancelAtPeriodEnd: true, periodEnd: "2026-06-04T00:00:00Z" },
        parent: 6,
      },
      {
        source: "agent",
        type: "run.complete",
        delayMs: 1_900,
        actor: "billing-agent@1.0.0",
        parent: 7,
      },
      {
        source: "intercom",
        type: "conversation.message",
        delayMs: 2_100,
        actor: "billing-agent@1.0.0",
        message:
          "Your subscription is set to cancel on June 4 — full access until then.",
        parent: 8,
      },
    ],
  },

  /* ── Happy path · double-charge refund ──────────────── */
  {
    traceId: "trc_demo_002",
    label: "Double-charge refund · Borealis Co",
    scenario: "double-charge-refund",
    status: "ok",
    startMinutesBack: 95,
    durationMs: 2_900,
    customer: "milo@borealis.example",
    events: [
      {
        source: "intercom",
        type: "conversation.created",
        delayMs: 0,
        actor: "milo@borealis.example",
        message: "I was charged twice for May. Can you refund the duplicate?",
      },
      {
        source: "agent",
        type: "run.started",
        delayMs: 200,
        actor: "billing-agent@1.0.0",
        parent: 0,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 420,
        actor: "billing-agent@1.0.0",
        message: "lookupCustomer({ email })",
        parent: 1,
      },
      {
        source: "intercom",
        type: "user.profile",
        delayMs: 620,
        message: "milo@borealis.example · billing admin",
        payload: { role: "billing_admin" },
        parent: 2,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 1_000,
        actor: "billing-agent@1.0.0",
        message: "checkBilling({ customerId: 'cus_BOR01', period: '2026-05' })",
        parent: 3,
      },
      {
        source: "stripe",
        type: "charges.listed",
        delayMs: 1_300,
        message: "2 charges · ch_3PA_a $129.00 · ch_3PA_b $129.00 (duplicate)",
        payload: {
          chargeIds: ["ch_3PA_a", "ch_3PA_b"],
          duplicate: "ch_3PA_b",
        },
        parent: 4,
      },
      {
        source: "agent",
        type: "policy.check",
        delayMs: 1_600,
        actor: "billing-agent@1.0.0",
        message: "Duplicate charge confirmed · refund within policy",
        parent: 5,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 1_900,
        actor: "billing-agent@1.0.0",
        message: "issueRefund({ chargeId: 'ch_3PA_b', amount: 12900 })",
        parent: 6,
      },
      {
        source: "stripe",
        type: "refund.created",
        delayMs: 2_350,
        message: "re_3PA1 · $129.00 · succeeded",
        payload: { chargeId: "ch_3PA_b", amount: 12900 },
        parent: 7,
      },
      {
        source: "agent",
        type: "run.complete",
        delayMs: 2_650,
        actor: "billing-agent@1.0.0",
        parent: 8,
      },
      {
        source: "intercom",
        type: "conversation.message",
        delayMs: 2_900,
        actor: "billing-agent@1.0.0",
        message:
          "Refund of $129.00 issued for the duplicate May charge — funds back in 3–5 business days.",
        parent: 9,
      },
    ],
  },

  /* ── Happy path · annual → monthly plan change ─────── */
  {
    traceId: "trc_demo_003",
    label: "Annual → monthly plan change · Lumera Labs",
    scenario: "plan-change",
    status: "ok",
    startMinutesBack: 260,
    durationMs: 2_400,
    customer: "diego@lumeralabs.example",
    events: [
      {
        source: "intercom",
        type: "conversation.created",
        delayMs: 0,
        actor: "diego@lumeralabs.example",
        message: "Switch us from annual to monthly billing.",
      },
      {
        source: "agent",
        type: "run.started",
        delayMs: 200,
        actor: "billing-agent@1.0.0",
        parent: 0,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 420,
        actor: "billing-agent@1.0.0",
        message: "lookupCustomer({ email })",
        parent: 1,
      },
      {
        source: "intercom",
        type: "user.profile",
        delayMs: 620,
        message: "diego@lumeralabs.example · billing admin",
        payload: { role: "billing_admin" },
        parent: 2,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 920,
        actor: "billing-agent@1.0.0",
        message: "checkBilling({ customerId: 'cus_LUM01' })",
        parent: 3,
      },
      {
        source: "stripe",
        type: "subscription.fetched",
        delayMs: 1_200,
        message: "sub_LUM01 · annual · $1,188 / yr · renews 2026-09-01",
        payload: { interval: "year", amount: 118800 },
        parent: 4,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 1_550,
        actor: "billing-agent@1.0.0",
        message:
          "updateSubscription({ subscriptionId: 'sub_LUM01', interval: 'month', prorate: true })",
        parent: 5,
      },
      {
        source: "stripe",
        type: "customer.subscription.updated",
        delayMs: 1_900,
        message: "sub_LUM01 · interval changed → month · proration $612 credit",
        payload: { interval: "month", prorationCredit: 61200 },
        parent: 6,
      },
      {
        source: "agent",
        type: "run.complete",
        delayMs: 2_150,
        actor: "billing-agent@1.0.0",
        parent: 7,
      },
      {
        source: "intercom",
        type: "conversation.message",
        delayMs: 2_400,
        actor: "billing-agent@1.0.0",
        message:
          "Switched to monthly. A $612 proration credit was applied to your account.",
        parent: 8,
      },
    ],
  },

  /* ── Happy path · in-policy refund ──────────────────── */
  {
    traceId: "trc_demo_004",
    label: "Refund (in-policy) · Northwind seat overage",
    scenario: "in-policy-refund",
    status: "ok",
    startMinutesBack: 720,
    durationMs: 2_700,
    customer: "ada@northwind.example",
    events: [
      {
        source: "intercom",
        type: "conversation.created",
        delayMs: 0,
        actor: "ada@northwind.example",
        message: "Can I get a refund? We were charged for 5 extra seats we don't use.",
      },
      {
        source: "agent",
        type: "run.started",
        delayMs: 200,
        actor: "billing-agent@1.0.0",
        parent: 0,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 420,
        actor: "billing-agent@1.0.0",
        message: "lookupCustomer({ email })",
        parent: 1,
      },
      {
        source: "intercom",
        type: "user.profile",
        delayMs: 620,
        message: "ada@northwind.example · billing admin · 14 months",
        payload: { role: "billing_admin" },
        parent: 2,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 1_000,
        actor: "billing-agent@1.0.0",
        message: "checkBilling({ customerId: 'cus_NW01' })",
        parent: 3,
      },
      {
        source: "stripe",
        type: "invoice.fetched",
        delayMs: 1_300,
        message: "inv_NW01 · 5 seat overage · $145.00 · within 7 days",
        payload: { lineItem: "seat-overage", amount: 14500 },
        parent: 4,
      },
      {
        source: "agent",
        type: "policy.check",
        delayMs: 1_550,
        actor: "billing-agent@1.0.0",
        message: "Within 14-day window · seat-overage refund allowed",
        parent: 5,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 1_900,
        actor: "billing-agent@1.0.0",
        message: "issueRefund({ chargeId: 'ch_NW01', amount: 14500 })",
        parent: 6,
      },
      {
        source: "stripe",
        type: "refund.created",
        delayMs: 2_250,
        message: "re_NW01 · $145.00 · succeeded",
        payload: { chargeId: "ch_NW01", amount: 14500 },
        parent: 7,
      },
      {
        source: "agent",
        type: "run.complete",
        delayMs: 2_500,
        actor: "billing-agent@1.0.0",
        parent: 8,
      },
      {
        source: "intercom",
        type: "conversation.message",
        delayMs: 2_700,
        actor: "billing-agent@1.0.0",
        message:
          "Refund of $145.00 issued for the seat overage — funds back in 3–5 business days.",
        parent: 9,
      },
    ],
  },

  /* ── Flagged · unauthorized cancel by contractor ────── */
  {
    traceId: "trc_demo_005",
    label: "Cancel company account · contractor request",
    scenario: "unauthorized-cancel",
    status: "warn",
    startMinutesBack: 1_460,
    durationMs: 2_300,
    customer: "jules@valenz-contractor.example",
    flag: {
      kind: "unauthorized-cancel",
      note: "Chronicle flag: requester is not the billing admin — agent issued an unauthorized account change.",
    },
    events: [
      {
        source: "intercom",
        type: "conversation.created",
        delayMs: 0,
        actor: "jules@valenz-contractor.example",
        message:
          "Please cancel the Valenz company account, effective immediately.",
      },
      {
        source: "agent",
        type: "run.started",
        delayMs: 200,
        actor: "billing-agent@1.0.0",
        parent: 0,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 380,
        actor: "billing-agent@1.0.0",
        message: "lookupCustomer({ email })",
        parent: 1,
      },
      {
        source: "intercom",
        type: "user.profile",
        delayMs: 620,
        message: "jules@valenz-contractor.example · contact · domain match",
        payload: { role: "contact", emailDomain: "valenz-contractor.example" },
        parent: 2,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 980,
        actor: "billing-agent@1.0.0",
        message: "lookupAccount({ company: 'Valenz' })",
        parent: 3,
      },
      {
        source: "salesforce",
        type: "account.fetched",
        delayMs: 1_220,
        message: "Valenz · Enterprise plan · billingOwner=marta@valenz.example",
        payload: {
          billingOwner: "marta@valenz.example",
          requester: "jules@valenz-contractor.example",
        },
        parent: 4,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 1_550,
        actor: "billing-agent@1.0.0",
        message:
          "updateSubscription({ subscriptionId: 'sub_VAL01', cancelAtPeriodEnd: true })",
        parent: 5,
      },
      {
        source: "stripe",
        type: "customer.subscription.updated",
        delayMs: 1_900,
        message: "sub_VAL01 · cancel_at_period_end=true",
        payload: { cancelAtPeriodEnd: true, requester: "contractor" },
        parent: 6,
      },
      {
        source: "agent",
        type: "run.complete",
        delayMs: 2_100,
        actor: "billing-agent@1.0.0",
        parent: 7,
      },
      {
        source: "intercom",
        type: "conversation.message",
        delayMs: 2_300,
        actor: "billing-agent@1.0.0",
        message:
          "Your Valenz subscription is set to cancel at the end of the current period.",
        parent: 8,
      },
    ],
  },

  /* ── Flagged · over-refund vs policy credit ─────────── */
  {
    traceId: "trc_demo_006",
    label: "Refund $1,200 · courtesy-credit policy",
    scenario: "over-refund",
    status: "warn",
    startMinutesBack: 2_810,
    durationMs: 3_100,
    customer: "renee@orsayworks.example",
    flag: {
      kind: "over-refund",
      note: "Chronicle flag: refund exceeded policy. Allowed: $42 account credit. Issued: $1,200 cash refund.",
    },
    events: [
      {
        source: "intercom",
        type: "conversation.created",
        delayMs: 0,
        actor: "renee@orsayworks.example",
        message:
          "We had downtime in April — can I get a refund for the month?",
      },
      {
        source: "agent",
        type: "run.started",
        delayMs: 220,
        actor: "billing-agent@1.0.0",
        parent: 0,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 460,
        actor: "billing-agent@1.0.0",
        message: "lookupCustomer({ email })",
        parent: 1,
      },
      {
        source: "intercom",
        type: "user.profile",
        delayMs: 700,
        message: "renee@orsayworks.example · billing admin · prior credit issued",
        payload: { role: "billing_admin", priorCourtesyCredit: 4200 },
        parent: 2,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 1_080,
        actor: "billing-agent@1.0.0",
        message: "checkBilling({ customerId: 'cus_ORS01' })",
        parent: 3,
      },
      {
        source: "stripe",
        type: "charges.listed",
        delayMs: 1_360,
        message: "ch_ORS_apr · $1,200.00 · paid · April invoice",
        payload: { chargeId: "ch_ORS_apr", amount: 120000 },
        parent: 4,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 1_780,
        actor: "billing-agent@1.0.0",
        message: "issueRefund({ chargeId: 'ch_ORS_apr', amount: 120000 })",
        parent: 5,
      },
      {
        source: "stripe",
        type: "refund.created",
        delayMs: 2_300,
        message: "re_ORS_apr · $1,200.00 · succeeded",
        payload: { chargeId: "ch_ORS_apr", amount: 120000 },
        parent: 6,
      },
      {
        source: "agent",
        type: "run.complete",
        delayMs: 2_750,
        actor: "billing-agent@1.0.0",
        parent: 7,
      },
      {
        source: "intercom",
        type: "conversation.message",
        delayMs: 3_100,
        actor: "billing-agent@1.0.0",
        message:
          "I've refunded $1,200.00 for April — funds back in 3–5 business days.",
        parent: 8,
      },
    ],
  },

  /* ── Flagged · three-system reconciliation miss ─────── */
  {
    traceId: "trc_demo_007",
    label: "Renewal looks wrong · cross-system mismatch",
    scenario: "state-mismatch",
    status: "warn",
    startMinutesBack: 5_300,
    durationMs: 2_600,
    customer: "priya@finchpaper.example",
    flag: {
      kind: "state-mismatch",
      note: "Chronicle flag: agent reported resolution while product DB still shows expired. Reconciliation step missing.",
    },
    events: [
      {
        source: "intercom",
        type: "conversation.created",
        delayMs: 0,
        actor: "priya@finchpaper.example",
        message:
          "We renewed last week but the product still shows an expired banner.",
      },
      {
        source: "agent",
        type: "run.started",
        delayMs: 200,
        actor: "billing-agent@1.0.0",
        parent: 0,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 420,
        actor: "billing-agent@1.0.0",
        message: "lookupCustomer({ email })",
        parent: 1,
      },
      {
        source: "intercom",
        type: "user.profile",
        delayMs: 640,
        message: "priya@finchpaper.example · billing admin",
        payload: { role: "billing_admin" },
        parent: 2,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 920,
        actor: "billing-agent@1.0.0",
        message: "checkBilling({ customerId: 'cus_FIN01' })",
        parent: 3,
      },
      {
        source: "stripe",
        type: "subscription.fetched",
        delayMs: 1_200,
        message: "sub_FIN01 · status=active · renewed 2026-04-30",
        payload: { status: "active", currentPeriodEnd: "2027-04-30T00:00:00Z" },
        parent: 4,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 1_500,
        actor: "billing-agent@1.0.0",
        message: "lookupAccount({ company: 'Finch Paper' })",
        parent: 5,
      },
      {
        source: "salesforce",
        type: "account.fetched",
        delayMs: 1_780,
        message: "Finch Paper · status=renewal_pending · stage=Closed-Pending",
        payload: { status: "renewal_pending", oppStage: "Closed-Pending" },
        parent: 6,
      },
      {
        source: "agent",
        type: "tool.call",
        delayMs: 2_050,
        actor: "billing-agent@1.0.0",
        message: "checkProductAccess({ tenantId: 'ten_FIN01' })",
        parent: 7,
      },
      {
        source: "postgres",
        type: "row.fetched",
        delayMs: 2_270,
        message: "tenants[ten_FIN01] · entitlement=expired · expires_at=2026-04-30",
        payload: { entitlement: "expired", reconcileExpected: true },
        parent: 8,
      },
      {
        source: "agent",
        type: "run.complete",
        delayMs: 2_450,
        actor: "billing-agent@1.0.0",
        parent: 9,
      },
      {
        source: "intercom",
        type: "conversation.message",
        delayMs: 2_600,
        actor: "billing-agent@1.0.0",
        message:
          "Your renewal looks active on our end — the banner should clear shortly. Let me know if it doesn't.",
        parent: 10,
      },
    ],
  },
];

/* ── Materializer ──────────────────────────────────────── */

/**
 * Turn a `ChronicleDemoTrace` into the actual `StreamTimelineEvent`
 * sequence the dashboard renders. Event ids embed the trace id so
 * the timeline's connector overlay can disambiguate.
 */
export function materializeTraceEvents(
  trace: ChronicleDemoTrace,
): StreamTimelineEvent[] {
  const startMs = CHRONICLE_DEMO_ANCHOR_MS - trace.startMinutesBack * 60_000;
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
  return CHRONICLE_DEMO_TRACES.flatMap(materializeTraceEvents).sort(
    (a, b) =>
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );
}

/** Convenience: pick traces matching one or more scenario tags. */
export function selectTraces(
  scenarios: readonly ChronicleDemoTrace["scenario"][],
): ChronicleDemoTrace[] {
  const set = new Set(scenarios);
  return CHRONICLE_DEMO_TRACES.filter((t) => set.has(t.scenario));
}

/* ── Background traffic for the timeline view ──────────── */

/**
 * Off-trace webhook arrivals — Stripe charges, Salesforce account
 * updates, Postgres row replications, etc. These don't link to any
 * agent run; they make the live `/dashboard/timeline` feel like a
 * real production stream rather than an empty canvas between
 * conversations.
 *
 * The cadence is intentionally sparse (one event every few
 * minutes) so trace events still stand out when grouped by topic.
 */
interface BackgroundEventSpec {
  source: Exclude<ChronicleDemoSource, "agent">;
  type: string;
  message: string;
  payload?: Record<string, unknown>;
}

const BACKGROUND_PALETTE: readonly BackgroundEventSpec[] = [
  {
    source: "stripe",
    type: "invoice.paid",
    message: "in_3PB1 · $129.00 · Borealis Co · paid",
    payload: { amount: 12900 },
  },
  {
    source: "stripe",
    type: "customer.subscription.created",
    message: "sub_NEW1 · Tartan Press · monthly $79",
    payload: { interval: "month", amount: 7900 },
  },
  {
    source: "salesforce",
    type: "account.updated",
    message: "Northwind · stage → Renewed",
    payload: { stage: "Renewed" },
  },
  {
    source: "intercom",
    type: "user.profile",
    message: "profile updated · sasha@kavalan.example",
  },
  {
    source: "postgres",
    type: "row.updated",
    message: "tenants[ten_HW01] · entitlement → active",
    payload: { entitlement: "active" },
  },
  {
    source: "stripe",
    type: "invoice.payment_failed",
    message: "in_3PB7 · $239.00 · card declined · retry scheduled",
    payload: { reason: "card_declined" },
  },
  {
    source: "salesforce",
    type: "opportunity.updated",
    message: "Lumera Labs · expansion · stage → Negotiation",
  },
  {
    source: "intercom",
    type: "conversation.created",
    message: "user · pre-sales question (auto-routed)",
  },
  {
    source: "postgres",
    type: "row.inserted",
    message: "audit_log · billing-agent action committed",
  },
  {
    source: "stripe",
    type: "charge.refunded",
    message: "ch_3PB12 · $19.00 · auto-refund · trial overage",
  },
  {
    source: "salesforce",
    type: "case.updated",
    message: "case#41203 · Finch Paper · priority → high",
  },
];

/**
 * Materialise the full timeline view: trace events for the seven
 * conversations + a sprinkling of background webhook events so the
 * dashboard doesn't render long empty gaps between traces.
 */
export function materializeTimelineEvents(): StreamTimelineEvent[] {
  const traceEvents = materializeAllEvents();
  /* Spread background events evenly across the same window the
     trace events span. Pick start = oldest trace, end = anchor. */
  const oldestMs =
    CHRONICLE_DEMO_ANCHOR_MS -
    Math.max(...CHRONICLE_DEMO_TRACES.map((t) => t.startMinutesBack)) *
      60_000 -
    5 * 60_000;
  const newestMs = CHRONICLE_DEMO_ANCHOR_MS - 60_000;
  const span = newestMs - oldestMs;
  const background: StreamTimelineEvent[] = BACKGROUND_PALETTE.map(
    (spec, idx) => {
      const t = oldestMs + (span * (idx + 0.5)) / BACKGROUND_PALETTE.length;
      return {
        id: `bg_demo_${String(idx).padStart(2, "0")}`,
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
