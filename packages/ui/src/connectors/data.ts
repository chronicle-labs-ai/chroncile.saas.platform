/*
 * Connector catalogs — per-archetype reference data consumed by the
 * archetype modals (ConnectStripe, ConnectSlack, ConnectHubSpot,
 * ConnectWizard). Apps can subset / extend these by spreading into
 * their own arrays; the modals accept optional override props.
 *
 * Stays separate from `../onboarding/data.ts` (which defines
 * `Source` / `SourceId` / catalog) — these are vendor-side enum
 * values, not the connector list itself.
 */

/* ── Stripe ────────────────────────────────────────────────── */

/**
 * Stripe webhook event-type strings. Subset of the stripe.com event
 * catalog — kept to the rows the connect modal exposes by default.
 * Stripe ships 200+ event types; the full set lives behind the
 * "Show all" toggle in the design (out of scope for the seed list).
 */
export interface StripeEventType {
  /** Dotted event-type id, e.g. `charge.succeeded`. */
  id: string;
  /** The Stripe object the event fires on (`charge`, `customer`...). */
  object: string;
  /** Pre-checked when the modal first mounts. */
  defaultOn: boolean;
}

export const STRIPE_EVENT_TYPES: readonly StripeEventType[] = [
  { id: "charge.succeeded", object: "charge", defaultOn: true },
  { id: "charge.failed", object: "charge", defaultOn: true },
  { id: "charge.refunded", object: "charge", defaultOn: true },
  { id: "customer.created", object: "customer", defaultOn: true },
  { id: "customer.updated", object: "customer", defaultOn: false },
  { id: "customer.subscription.created", object: "subscription", defaultOn: true },
  { id: "customer.subscription.updated", object: "subscription", defaultOn: true },
  { id: "customer.subscription.deleted", object: "subscription", defaultOn: true },
  { id: "invoice.paid", object: "invoice", defaultOn: true },
  { id: "invoice.payment_failed", object: "invoice", defaultOn: true },
  { id: "invoice.finalized", object: "invoice", defaultOn: false },
  { id: "payment_intent.succeeded", object: "payment_intent", defaultOn: true },
  { id: "payment_intent.payment_failed", object: "payment_intent", defaultOn: true },
  { id: "checkout.session.completed", object: "checkout.session", defaultOn: true },
  { id: "payout.paid", object: "payout", defaultOn: false },
  { id: "payout.failed", object: "payout", defaultOn: true },
];

export type StripeEnvMode = "test" | "live";

/* ── Slack ─────────────────────────────────────────────────── */

export interface SlackScope {
  id: string;
  /** Short rationale shown next to the scope row. */
  reason: string;
  /** Whether the scope is required for the canonical "listen + post" flow. */
  required: boolean;
}

export const SLACK_SCOPES: readonly SlackScope[] = [
  { id: "channels:read", reason: "List public channels for the picker", required: true },
  { id: "channels:history", reason: "Read messages from chosen channels", required: true },
  { id: "groups:read", reason: "List private channels (when invited)", required: false },
  { id: "groups:history", reason: "Read messages from invited private channels", required: false },
  { id: "chat:write", reason: "Post messages and replies", required: false },
  { id: "users:read", reason: "Resolve user ids in event payloads", required: true },
  { id: "reactions:read", reason: "Capture reaction-added events", required: false },
];

export type SlackDirection = "listen" | "post" | "both";

export interface SlackChannelStub {
  id: string;
  name: string;
  isPrivate: boolean;
  members?: number;
}

/** Sample channel list used by the connect modal preview. */
export const SLACK_CHANNEL_SAMPLES: readonly SlackChannelStub[] = [
  { id: "C0001", name: "support", isPrivate: false, members: 24 },
  { id: "C0002", name: "vip-escalations", isPrivate: false, members: 9 },
  { id: "C0003", name: "billing-alerts", isPrivate: false, members: 12 },
  { id: "C0004", name: "deploys", isPrivate: false, members: 38 },
  { id: "C0005", name: "exec-ops", isPrivate: true, members: 6 },
  { id: "C0006", name: "general", isPrivate: false, members: 142 },
];

/* ── HubSpot ───────────────────────────────────────────────── */

export interface HubSpotScope {
  id: string;
  label: string;
  reason: string;
  defaultOn: boolean;
}

export const HUBSPOT_SCOPES: readonly HubSpotScope[] = [
  {
    id: "crm.objects.contacts.read",
    label: "Contacts",
    reason: "Read contact records and properties",
    defaultOn: true,
  },
  {
    id: "crm.objects.companies.read",
    label: "Companies",
    reason: "Read company records",
    defaultOn: true,
  },
  {
    id: "crm.objects.deals.read",
    label: "Deals",
    reason: "Read pipeline deals + stage history",
    defaultOn: true,
  },
  {
    id: "crm.objects.tickets.read",
    label: "Tickets",
    reason: "Read support tickets",
    defaultOn: false,
  },
  {
    id: "automation",
    label: "Workflows",
    reason: "Trigger HubSpot workflows from Chronicle",
    defaultOn: false,
  },
];

export interface HubSpotObject {
  id: string;
  label: string;
  /** Estimated rows per day. Powers the "~N events/day" estimator. */
  est: number;
}

export const HUBSPOT_OBJECTS: readonly HubSpotObject[] = [
  { id: "contacts", label: "Contacts", est: 320 },
  { id: "companies", label: "Companies", est: 80 },
  { id: "deals", label: "Deals", est: 140 },
  { id: "tickets", label: "Tickets", est: 60 },
];

export interface HubSpotMappingRow {
  /** HubSpot property name (lhs). */
  source: string;
  /** Chronicle field name (rhs). */
  target: string;
  /** "auto" / "manual" / "skip". */
  mode: "auto" | "manual" | "skip";
}

export const HUBSPOT_DEFAULT_MAPPING: readonly HubSpotMappingRow[] = [
  { source: "email", target: "subject.email", mode: "auto" },
  { source: "firstname + lastname", target: "subject.name", mode: "auto" },
  { source: "lifecyclestage", target: "subject.stage", mode: "auto" },
  { source: "hs_lead_status", target: "subject.status", mode: "manual" },
  { source: "owner_id", target: "owner.id", mode: "auto" },
];

/* ── Salesforce (wizard) ───────────────────────────────────── */

export interface SalesforceRegion {
  id: string;
  label: string;
  /** Used for the "select your region" picker in step 1 of the wizard. */
  loginHost: string;
}

export const SALESFORCE_REGIONS: readonly SalesforceRegion[] = [
  { id: "prod", label: "Production / Developer", loginHost: "login.salesforce.com" },
  { id: "sandbox", label: "Sandbox", loginHost: "test.salesforce.com" },
  { id: "eu", label: "EU pod", loginHost: "eu.login.salesforce.com" },
  { id: "ap", label: "APAC pod", loginHost: "ap.login.salesforce.com" },
];

/* ── Reverse-webhook ───────────────────────────────────────── */

/**
 * Default reverse-webhook ingest URL template. The `{tenant}` token is
 * swapped at render time with the workspace id; apps that proxy
 * through a custom domain can pass `endpointBase` to override.
 */
export const REVERSE_WEBHOOK_URL_TEMPLATE =
  "https://ingest.chronicle.io/v1/hook/{tenant}";
