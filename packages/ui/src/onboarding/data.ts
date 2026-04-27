/*
 * Onboarding catalog — sources, templates, parse keywords, demo events.
 *
 * Ported from `onb/data.jsx` in the Auth Flow source. All exports are
 * stable values — apps can subset / extend them by spreading into a
 * new array (e.g. only the Stripe + Intercom rows for a billing
 * concierge demo).
 *
 * The Source.color field references CSS variables from `tokens.css`
 * (`--c-event-*`) so it stays theme-correct without being recomputed.
 */

import type { SourceGlyphId } from "../icons/source-glyph";

/* ── Source ─────────────────────────────────────────────────── */

export type SourceCategory =
  | "Support"
  | "Commerce"
  | "Billing"
  | "CRM"
  | "Messaging"
  | "Analytics"
  | "Warehouse"
  | "Database"
  | "Stream"
  | "Custom"
  | "Email"
  | "Product"
  | "Docs";

export type SourceAuthMethod = "oauth" | "apikey" | "webhook";

export interface BackfillEntity {
  id: string;
  label: string;
  /** Estimated event count per day for this entity. */
  est: number;
}

export interface BackfillSpec {
  /** Default lookback window (days). */
  windowDays: number;
  /** Maximum allowed lookback (days). */
  maxDays: number;
  /** Configurable entity slices (e.g. tickets, contacts). */
  entities: BackfillEntity[];
  /** Headline events-per-day estimate for the modal estimator. */
  estRate: number;
}

export type SourceId =
  | "intercom"
  | "zendesk"
  | "shopify"
  | "stripe"
  | "salesforce"
  | "hubspot"
  | "slack"
  | "segment"
  | "snowflake"
  | "postgres"
  | "kafka"
  | "webhooks"
  | "http"
  | "gmail"
  | "linear"
  | "notion";

export interface Source {
  id: SourceId;
  name: string;
  cat: SourceCategory;
  color: string;
  auth: SourceAuthMethod;
  blurb: string;
  glyph: SourceGlyphId;
  /** Sample event names (used in the live preview ticker). */
  sample: string[];
  /** Backfill capability. `null` for pure stream-only sources. */
  backfill: BackfillSpec | null;
}

const bfFull = (
  entities: BackfillEntity[],
  estRate: number,
  maxDays = 365
): BackfillSpec => ({
  windowDays: 30,
  maxDays,
  entities,
  estRate,
});
const bfRecent = (
  entities: BackfillEntity[],
  estRate: number
): BackfillSpec => ({
  windowDays: 7,
  maxDays: 30,
  entities,
  estRate,
});

export const SOURCES: readonly Source[] = [
  {
    id: "intercom",
    name: "Intercom",
    cat: "Support",
    color: "var(--c-event-teal)",
    auth: "oauth",
    blurb: "Conversations, messages, tickets",
    glyph: "intercom",
    sample: [
      "conversation.created",
      "conversation.message",
      "conversation.closed",
    ],
    backfill: bfFull(
      [
        { id: "conversations", label: "Conversations", est: 180 },
        { id: "contacts", label: "Contacts", est: 40 },
        { id: "tags", label: "Tags", est: 5 },
      ],
      225
    ),
  },
  {
    id: "zendesk",
    name: "Zendesk",
    cat: "Support",
    color: "var(--c-event-teal)",
    auth: "apikey",
    blurb: "Tickets, macros, agent responses",
    glyph: "zendesk",
    sample: ["ticket.created", "ticket.updated", "ticket.solved"],
    backfill: bfFull(
      [
        { id: "tickets", label: "Tickets", est: 140 },
        { id: "users", label: "Users", est: 30 },
      ],
      170
    ),
  },
  {
    id: "shopify",
    name: "Shopify",
    cat: "Commerce",
    color: "var(--c-event-amber)",
    auth: "oauth",
    blurb: "Orders, customers, fulfillments",
    glyph: "shopify",
    sample: ["order.created", "order.fulfilled", "customer.updated"],
    backfill: bfFull(
      [
        { id: "orders", label: "Orders", est: 320 },
        { id: "customers", label: "Customers", est: 80 },
        { id: "products", label: "Products", est: 10 },
      ],
      410
    ),
  },
  {
    id: "stripe",
    name: "Stripe",
    cat: "Billing",
    color: "var(--c-event-green)",
    auth: "apikey",
    blurb: "Charges, refunds, subscription events",
    glyph: "stripe",
    sample: ["charge.succeeded", "refund.created", "invoice.paid"],
    backfill: bfFull(
      [
        { id: "charges", label: "Charges", est: 280 },
        { id: "customers", label: "Customers", est: 40 },
        { id: "invoices", label: "Invoices", est: 60 },
        { id: "refunds", label: "Refunds", est: 12 },
      ],
      390
    ),
  },
  {
    id: "salesforce",
    name: "Salesforce",
    cat: "CRM",
    color: "var(--c-event-pink)",
    auth: "oauth",
    blurb: "Accounts, opportunities, cases",
    glyph: "salesforce",
    sample: ["opportunity.created", "case.updated"],
    backfill: bfFull(
      [
        { id: "accounts", label: "Accounts", est: 20 },
        { id: "opportunities", label: "Opportunities", est: 45 },
        { id: "contacts", label: "Contacts", est: 90 },
        { id: "cases", label: "Cases", est: 30 },
      ],
      185
    ),
  },
  {
    id: "hubspot",
    name: "HubSpot",
    cat: "CRM",
    color: "var(--c-event-pink)",
    auth: "oauth",
    blurb: "Contacts, deals, marketing events",
    glyph: "hubspot",
    sample: ["contact.created", "deal.updated"],
    backfill: bfFull(
      [
        { id: "contacts", label: "Contacts", est: 120 },
        { id: "deals", label: "Deals", est: 40 },
        { id: "companies", label: "Companies", est: 25 },
      ],
      185
    ),
  },
  {
    id: "slack",
    name: "Slack",
    cat: "Messaging",
    color: "var(--c-event-pink)",
    auth: "oauth",
    blurb: "Channels, threads, reactions",
    glyph: "slack",
    sample: ["message.channel", "reaction.added"],
    backfill: bfRecent([{ id: "messages", label: "Messages", est: 800 }], 800),
  },
  {
    id: "segment",
    name: "Segment",
    cat: "Analytics",
    color: "var(--c-event-violet)",
    auth: "apikey",
    blurb: "Identify, track, page events",
    glyph: "segment",
    sample: ["track", "identify", "page"],
    backfill: null,
  },
  {
    id: "snowflake",
    name: "Snowflake",
    cat: "Warehouse",
    color: "var(--c-event-violet)",
    auth: "apikey",
    blurb: "Tables, views, change-data-capture",
    glyph: "snowflake",
    sample: ["table.changed", "query.executed"],
    backfill: bfFull(
      [{ id: "tables", label: "Table snapshots", est: 12 }],
      12,
      90
    ),
  },
  {
    id: "postgres",
    name: "Postgres",
    cat: "Database",
    color: "var(--c-event-violet)",
    auth: "apikey",
    blurb: "Logical replication stream",
    glyph: "postgres",
    sample: ["row.inserted", "row.updated"],
    backfill: bfFull(
      [{ id: "tables", label: "Table snapshots", est: 8 }],
      8,
      30
    ),
  },
  {
    id: "kafka",
    name: "Kafka",
    cat: "Stream",
    color: "var(--c-event-orange)",
    auth: "apikey",
    blurb: "Consume topics as events",
    glyph: "kafka",
    sample: ["topic.message"],
    backfill: null,
  },
  {
    id: "webhooks",
    name: "Webhooks",
    cat: "Custom",
    color: "var(--c-event-white)",
    auth: "webhook",
    blurb: "Generic HTTP callbacks",
    glyph: "webhook",
    sample: ["custom.event"],
    backfill: null,
  },
  {
    id: "http",
    name: "HTTP / REST",
    cat: "Custom",
    color: "var(--c-event-white)",
    auth: "webhook",
    blurb: "Poll any REST endpoint",
    glyph: "http",
    sample: ["http.response"],
    backfill: null,
  },
  {
    id: "gmail",
    name: "Gmail",
    cat: "Email",
    color: "var(--c-event-amber)",
    auth: "oauth",
    blurb: "Threads, labels, sent mail",
    glyph: "gmail",
    sample: ["thread.created", "message.received"],
    backfill: bfRecent([{ id: "threads", label: "Threads", est: 120 }], 120),
  },
  {
    id: "linear",
    name: "Linear",
    cat: "Product",
    color: "var(--c-event-violet)",
    auth: "apikey",
    blurb: "Issues, cycles, project updates",
    glyph: "linear",
    sample: ["issue.created", "issue.updated"],
    backfill: bfFull(
      [
        { id: "issues", label: "Issues", est: 30 },
        { id: "projects", label: "Projects", est: 4 },
      ],
      34
    ),
  },
  {
    id: "notion",
    name: "Notion",
    cat: "Docs",
    color: "var(--c-event-white)",
    auth: "oauth",
    blurb: "Pages, databases, comments",
    glyph: "notion",
    sample: ["page.updated", "comment.created"],
    backfill: bfRecent([{ id: "pages", label: "Pages", est: 45 }], 45),
  },
];

/* ── Parse keywords ─────────────────────────────────────────── */

export interface ParseKeyword {
  rx: RegExp;
  ids: SourceId[];
}

export const PARSE_KEYWORDS: readonly ParseKeyword[] = [
  { rx: /shopif|order|cart|storefront/i, ids: ["shopify"] },
  { rx: /intercom|support chat|chat widget|conversation/i, ids: ["intercom"] },
  { rx: /zendesk|ticket/i, ids: ["zendesk"] },
  { rx: /refund|stripe|charge|subscription|billing|invoice/i, ids: ["stripe"] },
  { rx: /salesforce|sfdc|opportunit/i, ids: ["salesforce"] },
  { rx: /hubspot|crm|contact|deal/i, ids: ["hubspot"] },
  { rx: /slack|channel|thread/i, ids: ["slack"] },
  { rx: /segment|analytics|track/i, ids: ["segment"] },
  { rx: /snowflake|warehouse|data lake/i, ids: ["snowflake"] },
  { rx: /postgres|postgre|pg|database|db/i, ids: ["postgres"] },
  { rx: /kafka|topic|stream/i, ids: ["kafka"] },
  { rx: /webhook|http|rest|api call/i, ids: ["webhooks", "http"] },
  { rx: /gmail|email/i, ids: ["gmail"] },
  { rx: /linear|issue|bug|backlog/i, ids: ["linear"] },
  { rx: /notion|docs|runbook|knowledge base/i, ids: ["notion"] },
  {
    rx: /support|cx|customer service|customer experience/i,
    ids: ["intercom", "zendesk"],
  },
  { rx: /ecommerce|e-commerce|dtc|merchandise/i, ids: ["shopify", "stripe"] },
  { rx: /sales|outbound|pipeline/i, ids: ["hubspot", "salesforce", "gmail"] },
  { rx: /ops|incident|on-call|oncall|alert/i, ids: ["slack", "linear"] },
];

/** Walk PARSE_KEYWORDS and return the union of matched source ids. */
export function detectSources(prompt: string): SourceId[] {
  if (!prompt?.trim()) return [];
  const hits = new Set<SourceId>();
  for (const { rx, ids } of PARSE_KEYWORDS) {
    if (rx.test(prompt)) ids.forEach((id) => hits.add(id));
  }
  return Array.from(hits);
}

/* ── Templates ──────────────────────────────────────────────── */

export interface Template {
  id: string;
  name: string;
  blurb: string;
  sources: SourceId[];
  prompt: string;
}

export const TEMPLATES: readonly Template[] = [
  {
    id: "support",
    name: "Support concierge",
    blurb:
      "Handles refunds, lookups, and escalations across Intercom + Shopify + Stripe.",
    sources: ["intercom", "shopify", "stripe", "slack"],
    prompt:
      "A Shopify support agent that triages Intercom conversations, looks up orders in Shopify, issues refunds in Stripe, and escalates to Slack when customers are angry.",
  },
  {
    id: "ops",
    name: "Ops co-pilot",
    blurb:
      "Triages alerts from the warehouse and files Linear issues with context.",
    sources: ["snowflake", "postgres", "slack", "linear"],
    prompt:
      "An ops agent that watches our Postgres + Snowflake for data anomalies, pings the on-call via Slack, and files Linear issues with the query context.",
  },
  {
    id: "sales",
    name: "Inbound SDR",
    blurb:
      "Enriches HubSpot contacts, drafts outreach in Gmail, logs to Salesforce.",
    sources: ["hubspot", "salesforce", "gmail", "segment"],
    prompt:
      "An SDR agent that watches Segment for product-qualified leads, enriches the contact in HubSpot, drafts a follow-up in Gmail, and logs the touch in Salesforce.",
  },
];

/* ── Domain detection (sign-up "we noticed" strip) ──────────── */

export interface DomainHint {
  /** Display name shown in the UI ("Stripe", "Intercom", etc.). */
  name: string;
  /** Glyph id used inside the detected pill. */
  icon: SourceGlyphId;
  /** Plain-prose follow-on shown after the brand name. */
  message: string;
}

interface DomainRule extends DomainHint {
  rx: RegExp;
}

const DOMAIN_HINTS: readonly DomainRule[] = [
  {
    rx: /@stripe\./i,
    name: "Stripe",
    icon: "stripe",
    message: "we'll wire up your Stripe events workspace",
  },
  {
    rx: /@shopify\./i,
    name: "Shopify",
    icon: "shopify",
    message: "we'll prep a Shopify-flavored stream",
  },
  {
    rx: /@linear\./i,
    name: "Linear",
    icon: "linear",
    message: "Linear-style keyboard shortcuts will be on by default",
  },
  {
    rx: /@vercel\./i,
    name: "Vercel",
    icon: "webhook",
    message: "we'll provision an edge-routed webhook",
  },
  {
    rx: /@notion\./i,
    name: "Notion",
    icon: "notion",
    message: "we'll start your knowledge base in Notion",
  },
  {
    rx: /@github\./i,
    name: "GitHub",
    icon: "linear",
    message: "expect inline GitHub commit refs",
  },
  {
    rx: /@(intercom)\./i,
    name: "Intercom",
    icon: "intercom",
    message: "Intercom conversations will stream in by default",
  },
  {
    rx: /@chronicle/i,
    name: "Chronicle",
    icon: "webhook",
    message: "welcome home, teammate",
  },
  {
    rx: /@anthropic\./i,
    name: "Anthropic",
    icon: "webhook",
    message: "Claude is on by default",
  },
];

/** First-match domain detection. Returns `null` if no hint matched. */
export function detectDomain(email: string): DomainHint | null {
  if (!email) return null;
  for (const h of DOMAIN_HINTS) {
    if (h.rx.test(email)) {
      return { name: h.name, icon: h.icon, message: h.message };
    }
  }
  return null;
}

/* ── Demo events (live preview ticker) ──────────────────────── */

export type DemoEventDir = "in" | "out";

export interface DemoEvent {
  /** Source id this event "comes from" — drives the inline glyph color. */
  src: SourceId;
  /** Dotted event name. */
  name: string;
  /** Compact metadata blurb shown to the right. */
  meta: string;
  dir: DemoEventDir;
}

export const DEMO_EVENTS: readonly DemoEvent[] = [
  {
    src: "intercom",
    name: "support.conversation.created",
    meta: "c_48c1 · @max.weber",
    dir: "in",
  },
  {
    src: "shopify",
    name: "shopify.order.lookup",
    meta: "#1024 · jack.reeves@…",
    dir: "in",
  },
  {
    src: "shopify",
    name: "shopify.order.retrieved",
    meta: "#1024 · 2 items · $84.00",
    dir: "out",
  },
  {
    src: "intercom",
    name: "support.conversation.message",
    meta: '"where is my package?"',
    dir: "in",
  },
  {
    src: "stripe",
    name: "stripe.charge.lookup",
    meta: "ch_3PJz4Z2… · $84.00",
    dir: "in",
  },
  {
    src: "stripe",
    name: "stripe.refund.created",
    meta: "re_7Hgk2a… · $84.00",
    dir: "out",
  },
  {
    src: "slack",
    name: "slack.channel.post",
    meta: "#cx-alerts · refund issued",
    dir: "out",
  },
  {
    src: "intercom",
    name: "support.conversation.resolved",
    meta: "c_48c1 · agent:sage",
    dir: "out",
  },
  {
    src: "shopify",
    name: "shopify.order.fulfilled",
    meta: "#1031 · ups 1z999…",
    dir: "in",
  },
  {
    src: "intercom",
    name: "support.conversation.created",
    meta: "c_49d2 · @lee.park",
    dir: "in",
  },
  {
    src: "stripe",
    name: "stripe.charge.succeeded",
    meta: "ch_3PJz9q… · $149.00",
    dir: "in",
  },
];

/** Lookup helper used across components. */
export function getSource(id: SourceId): Source | undefined {
  return SOURCES.find((s) => s.id === id);
}
