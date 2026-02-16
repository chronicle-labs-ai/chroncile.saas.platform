import type { SandboxNodeType } from "./types";

/* ------------------------------------------------------------------ */
/*  Semantic color mapping per node type                               */
/* ------------------------------------------------------------------ */

export const NODE_COLORS: Record<
  SandboxNodeType,
  { accent: string; bg: string; dim: string; label: string }
> = {
  "event-source": {
    accent: "#00d4ff", // data
    bg: "#001419",
    dim: "#005566",
    label: "Event Source",
  },
  filter: {
    accent: "#00ff88", // nominal
    bg: "#001a0d",
    dim: "#006633",
    label: "Filter",
  },
  output: {
    accent: "#ff3b3b", // critical
    bg: "#1a0a0a",
    dim: "#661717",
    label: "Output",
  },
  generator: {
    accent: "#ffb800", // caution
    bg: "#1a1400",
    dim: "#664a00",
    label: "Generator",
  },
};

/* ------------------------------------------------------------------ */
/*  React Flow canvas theming                                          */
/* ------------------------------------------------------------------ */

export const CANVAS_THEME = {
  background: "#050607", // void
  dotColor: "#1a1d21", // hover
  nodeBg: "#0f1215", // surface
  nodeSelectedBorder: "#00d4ff",
  edgeColor: "#353c45", // border-bright
  edgeSelectedColor: "#00d4ff",
  minimapBg: "#0a0c0f",
  minimapMask: "rgba(0, 212, 255, 0.08)",
};

/* ------------------------------------------------------------------ */
/*  Provider / Event catalog — mirrors real webhook handlers           */
/* ------------------------------------------------------------------ */

export interface ProviderInfo {
  label: string;
  color: string;
  category: string;
  eventTypes: string[];
}

export const PROVIDER_CATALOG: Record<string, ProviderInfo> = {
  intercom: {
    label: "Intercom",
    color: "#40B4A6",
    category: "communication",
    eventTypes: [
      "conversation.started",
      "message.received",
      "message.sent",
      "conversation.closed",
      "conversation.reopened",
      "conversation.assigned",
      "note.added",
      "ticket.created",
      "ticket.updated",
      "user.created",
      "user.tagged",
    ],
  },
  stripe: {
    label: "Stripe",
    color: "#635BFF",
    category: "payments",
    eventTypes: [
      "charge.succeeded",
      "charge.failed",
      "charge.refunded",
      "invoice.created",
      "invoice.paid",
      "invoice.payment_failed",
      "subscription.created",
      "subscription.updated",
      "subscription.canceled",
      "customer.created",
      "customer.updated",
      "payment_intent.succeeded",
      "payment_intent.failed",
    ],
  },
  slack: {
    label: "Slack",
    color: "#4A154B",
    category: "communication",
    eventTypes: [
      "message.posted",
      "message.updated",
      "message.deleted",
      "channel.created",
      "channel.archived",
      "reaction.added",
      "reaction.removed",
      "member.joined",
      "member.left",
    ],
  },
  hubspot: {
    label: "HubSpot",
    color: "#FF7A59",
    category: "crm",
    eventTypes: [
      "contact.created",
      "contact.updated",
      "contact.merged",
      "deal.created",
      "deal.updated",
      "deal.stage_changed",
      "ticket.created",
      "ticket.updated",
      "ticket.closed",
      "email.sent",
      "email.opened",
      "email.clicked",
    ],
  },
  zendesk: {
    label: "Zendesk",
    color: "#03363D",
    category: "communication",
    eventTypes: [
      "ticket.created",
      "ticket.updated",
      "ticket.solved",
      "ticket.closed",
      "comment.added",
      "satisfaction.rated",
      "user.created",
      "user.updated",
    ],
  },
  github: {
    label: "GitHub",
    color: "#6E5494",
    category: "developer-tools",
    eventTypes: [
      "push",
      "pull_request.opened",
      "pull_request.merged",
      "pull_request.closed",
      "issue.opened",
      "issue.closed",
      "issue.commented",
      "release.published",
      "workflow_run.completed",
    ],
  },
  notion: {
    label: "Notion",
    color: "#000000",
    category: "productivity",
    eventTypes: [
      "page.created",
      "page.updated",
      "page.archived",
      "database.updated",
      "comment.added",
    ],
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDER_CATALOG);

/* ------------------------------------------------------------------ */
/*  Actor types — matches real webhook actor mappings                   */
/* ------------------------------------------------------------------ */

export const ACTOR_TYPES = [
  { value: "customer", label: "Customer" },
  { value: "agent", label: "Agent" },
  { value: "system", label: "System" },
  { value: "bot", label: "Bot" },
] as const;

/* ------------------------------------------------------------------ */
/*  Date range presets                                                 */
/* ------------------------------------------------------------------ */

export const DATE_RANGE_PRESETS = [
  { label: "Last hour", ms: 3_600_000 },
  { label: "Last 24h", ms: 86_400_000 },
  { label: "Last 7 days", ms: 7 * 86_400_000 },
  { label: "Last 30 days", ms: 30 * 86_400_000 },
  { label: "Custom", ms: 0 },
] as const;

/* ------------------------------------------------------------------ */
/*  Canonical stream base URL                                          */
/* ------------------------------------------------------------------ */

export const CANONICAL_BASE_URL = "canonical.stream";

/** Build the canonical SSE stream URL for an output node */
export function buildStreamUrl(
  tenantId: string,
  sandboxId: string,
  nodeId: string
): string {
  return `${CANONICAL_BASE_URL}/${tenantId}/${sandboxId}/${nodeId}/sse`;
}

/** Build the canonical file export URL */
export function buildFileUrl(
  tenantId: string,
  sandboxId: string,
  nodeId: string,
  format: string
): string {
  return `${CANONICAL_BASE_URL}/${tenantId}/${sandboxId}/${nodeId}/export.${format}`;
}

/** Build the canonical console/log URL */
export function buildConsoleUrl(
  tenantId: string,
  sandboxId: string,
  nodeId: string
): string {
  return `${CANONICAL_BASE_URL}/${tenantId}/${sandboxId}/${nodeId}/log`;
}

/* ------------------------------------------------------------------ */
/*  Output types catalog                                               */
/* ------------------------------------------------------------------ */

export const OUTPUT_TYPES = [
  {
    value: "sse" as const,
    label: "SSE Stream",
    description: "Server-Sent Events endpoint for real-time consumers",
    icon: "stream",
  },
  {
    value: "webhook" as const,
    label: "Webhook Relay",
    description: "Forward events to an external webhook URL",
    icon: "webhook",
  },
  {
    value: "file" as const,
    label: "File Export",
    description: "Write events to JSONL or CSV for batch processing",
    icon: "file",
  },
  {
    value: "console" as const,
    label: "Console Log",
    description: "Log events to the sandbox inspector",
    icon: "console",
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Output transform presets                                           */
/* ------------------------------------------------------------------ */

export const OUTPUT_TEMPLATE_PRESETS = [
  {
    label: "Full Payload",
    value: "full",
    template: "{{ payload }}",
  },
  {
    label: "Minimal",
    value: "minimal",
    template:
      '{ "event_id": "{{ event_id }}", "source": "{{ source }}", "event_type": "{{ event_type }}", "occurred_at": "{{ occurred_at }}" }',
  },
  {
    label: "Custom",
    value: "custom",
    template: "",
  },
] as const;

export const OUTPUT_FIELDS = [
  { key: "event_id", label: "Event ID" },
  { key: "source", label: "Source" },
  { key: "event_type", label: "Event Type" },
  { key: "occurred_at", label: "Timestamp" },
  { key: "actor", label: "Actor" },
  { key: "subject", label: "Subject" },
  { key: "payload", label: "Payload" },
] as const;

/* ------------------------------------------------------------------ */
/*  Generator rate presets                                             */
/* ------------------------------------------------------------------ */

export const RATE_PRESETS = [
  { label: "1/sec", ms: 1000 },
  { label: "2/sec", ms: 500 },
  { label: "5/sec", ms: 200 },
  { label: "10/sec", ms: 100 },
  { label: "50/sec", ms: 20 },
] as const;

/* ------------------------------------------------------------------ */
/*  Default configs for new nodes                                      */
/* ------------------------------------------------------------------ */

export const DEFAULT_EVENT_SOURCE_CONFIG = {
  dateRange: { start: "", end: "" },
  sourceFilter: [] as string[],
  eventTypeFilter: [] as string[],
};

export const DEFAULT_FILTER_CONFIG = {
  rules: [],
};

export const DEFAULT_OUTPUT_CONFIG = {
  outputType: "sse" as const,
  webhookUrl: "",
  fileFormat: "jsonl" as const,
  transformTemplate: "{{ payload }}",
  includedFields: ["event_id", "source", "event_type", "occurred_at", "actor", "subject", "payload"] as string[],
};

export const DEFAULT_GENERATOR_CONFIG = {
  sourceTypes: [] as string[],
  eventTypes: [] as string[],
  count: 10,
  intervalMs: 1000,
  variationLevel: 0.3,
};
