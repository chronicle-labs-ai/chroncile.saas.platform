import type {
  Sandbox,
  SandboxNode,
  SandboxEdge,
  SandboxEvent,
  AgentAction,
} from "./types";
import { PROVIDER_CATALOG, PROVIDER_IDS } from "./constants";

/* ------------------------------------------------------------------ */
/*  Helper to produce dates relative to now                            */
/* ------------------------------------------------------------------ */

function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86_400_000).toISOString();
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

/* ------------------------------------------------------------------ */
/*  Shared random helpers                                              */
/* ------------------------------------------------------------------ */

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const REAL_ACTOR_TYPES = ["customer", "agent", "system"];
const REAL_NAMES: Record<string, string[]> = {
  customer: ["Alice Chen", "Bob Martinez", "Carlos Reyes", "Diana Park", "Eli Nnadi"],
  agent: ["Agent-1", "Agent-2", "Support-Bot-v3"],
  system: ["System", "Webhook Relay", "Auto-Router"],
};

/* ------------------------------------------------------------------ */
/*  Realistic payload generators per provider                          */
/* ------------------------------------------------------------------ */

function makePayload(source: string, eventType: string): Record<string, unknown> {
  switch (source) {
    case "intercom":
      return {
        conversation_id: `conv_${Math.floor(Math.random() * 5000)}`,
        message_type: eventType.includes("message") ? "comment" : "note",
        admin_assignee_id: Math.random() > 0.5 ? `admin_${Math.floor(Math.random() * 20)}` : null,
        tags: randomChoice([["vip"], ["billing"], ["urgent", "billing"], []]),
      };
    case "stripe":
      return {
        charge_id: `ch_${Math.random().toString(36).slice(2, 14)}`,
        amount: Math.floor(Math.random() * 50000) + 100,
        currency: "usd",
        customer: `cus_${Math.random().toString(36).slice(2, 14)}`,
        status: eventType.includes("failed") ? "failed" : "succeeded",
        invoice_id: eventType.includes("invoice") ? `in_${Math.random().toString(36).slice(2, 14)}` : null,
      };
    case "slack":
      return {
        channel: `#${randomChoice(["support", "general", "engineering", "sales"])}`,
        user: `U${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        ts: `${Date.now() / 1000}`,
        thread_ts: Math.random() > 0.6 ? `${(Date.now() - 3600000) / 1000}` : null,
      };
    case "hubspot":
      return {
        object_id: Math.floor(Math.random() * 100000),
        portal_id: 12345678,
        property_name: eventType.includes("stage") ? "dealstage" : "lifecyclestage",
        property_value: randomChoice(["lead", "opportunity", "customer", "subscriber"]),
      };
    case "zendesk":
      return {
        ticket_id: Math.floor(Math.random() * 90000) + 10000,
        priority: randomChoice(["low", "normal", "high", "urgent"]),
        status: randomChoice(["new", "open", "pending", "solved"]),
        group_id: Math.floor(Math.random() * 10),
      };
    case "github":
      return {
        repository: `org/${randomChoice(["api", "frontend", "infra", "docs"])}`,
        ref: eventType === "push" ? "refs/heads/main" : undefined,
        action: eventType.includes(".") ? eventType.split(".")[1] : eventType,
        number: eventType.includes("pull_request") || eventType.includes("issue") ? Math.floor(Math.random() * 500) : undefined,
      };
    case "notion":
      return {
        page_id: `${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 6)}`,
        workspace_id: `ws_${Math.random().toString(36).slice(2, 10)}`,
        last_edited_by: randomChoice(["Alice", "Bob", "System"]),
      };
    default:
      return { raw: true, eventType };
  }
}

/* ------------------------------------------------------------------ */
/*  Demo sandbox 1 — Customer Support Replay                           */
/* ------------------------------------------------------------------ */

const csReplayNodes: SandboxNode[] = [
  {
    id: "src-1",
    type: "event-source",
    position: { x: 80, y: 200 },
    data: {
      label: "Intercom Events",
      nodeType: "event-source",
      config: {
        dateRange: { start: daysAgo(7), end: daysAgo(0) },
        sourceFilter: ["intercom"],
        eventTypeFilter: ["conversation.started", "message.received", "message.sent", "conversation.closed"],
      },
    },
  },
  {
    id: "flt-1",
    type: "filter",
    position: { x: 400, y: 180 },
    data: {
      label: "Exclude Bot Messages",
      nodeType: "filter",
      config: {
        rules: [
          {
            id: "r1",
            field: "actor_type",
            operator: "not_equals",
            value: "bot",
          },
        ],
      },
    },
  },
  {
    id: "out-1",
    type: "output",
    position: { x: 720, y: 200 },
    data: {
      label: "Replay Stream",
      nodeType: "output",
      config: {
        outputType: "sse",
        webhookUrl: "",
        fileFormat: "jsonl",
        transformTemplate: "{{ payload }}",
        includedFields: ["event_id", "source", "event_type", "occurred_at", "actor", "subject", "payload"],
      },
    },
  },
];

const csReplayEdges: SandboxEdge[] = [
  { id: "e-src1-flt1", source: "src-1", target: "flt-1", type: "animated" },
  { id: "e-flt1-out1", source: "flt-1", target: "out-1", type: "animated" },
];

/* ------------------------------------------------------------------ */
/*  Demo sandbox 2 — Stripe Event Filter                               */
/* ------------------------------------------------------------------ */

const stripeNodes: SandboxNode[] = [
  {
    id: "src-2",
    type: "event-source",
    position: { x: 80, y: 200 },
    data: {
      label: "All Events",
      nodeType: "event-source",
      config: {
        dateRange: { start: daysAgo(14), end: daysAgo(0) },
        sourceFilter: ["intercom", "stripe", "slack"],
        eventTypeFilter: [],
      },
    },
  },
  {
    id: "flt-2",
    type: "filter",
    position: { x: 400, y: 120 },
    data: {
      label: "Stripe Only",
      nodeType: "filter",
      config: {
        rules: [
          { id: "r2", field: "source", operator: "equals", value: "stripe" },
        ],
      },
    },
  },
  {
    id: "flt-3",
    type: "filter",
    position: { x: 400, y: 300 },
    data: {
      label: "Non-Stripe",
      nodeType: "filter",
      config: {
        rules: [
          {
            id: "r3",
            field: "source",
            operator: "not_equals",
            value: "stripe",
          },
        ],
      },
    },
  },
  {
    id: "out-2",
    type: "output",
    position: { x: 720, y: 120 },
    data: {
      label: "Stripe Stream",
      nodeType: "output",
      config: {
        outputType: "sse",
        webhookUrl: "",
        fileFormat: "jsonl",
        transformTemplate: "{{ payload }}",
        includedFields: ["event_id", "source", "event_type", "occurred_at", "actor", "payload"],
      },
    },
  },
  {
    id: "out-3",
    type: "output",
    position: { x: 720, y: 300 },
    data: {
      label: "Other Events Export",
      nodeType: "output",
      config: {
        outputType: "file",
        webhookUrl: "",
        fileFormat: "jsonl",
        transformTemplate: "{{ payload }}",
        includedFields: ["event_id", "source", "event_type", "occurred_at", "actor", "subject", "payload"],
      },
    },
  },
];

const stripeEdges: SandboxEdge[] = [
  { id: "e-src2-flt2", source: "src-2", target: "flt-2", type: "animated" },
  { id: "e-src2-flt3", source: "src-2", target: "flt-3", type: "animated" },
  { id: "e-flt2-out2", source: "flt-2", target: "out-2", type: "animated" },
  { id: "e-flt3-out3", source: "flt-3", target: "out-3", type: "animated" },
];

/* ------------------------------------------------------------------ */
/*  Demo sandbox 3 — Synthetic Load Test                               */
/* ------------------------------------------------------------------ */

const loadTestNodes: SandboxNode[] = [
  {
    id: "gen-1",
    type: "generator",
    position: { x: 80, y: 200 },
    data: {
      label: "Fake Ticket Generator",
      nodeType: "generator",
      config: {
        sourceTypes: ["intercom", "zendesk"],
        eventTypes: ["conversation.started", "ticket.created", "ticket.updated", "message.received"],
        count: 100,
        intervalMs: 500,
        variationLevel: 0.6,
      },
    },
  },
  {
    id: "flt-4",
    type: "filter",
    position: { x: 400, y: 120 },
    data: {
      label: "Customer Only",
      nodeType: "filter",
      config: {
        rules: [
          { id: "r4", field: "actor_type", operator: "equals", value: "customer" },
        ],
      },
    },
  },
  {
    id: "out-4",
    type: "output",
    position: { x: 700, y: 200 },
    data: {
      label: "Agent Intake",
      nodeType: "output",
      config: {
        outputType: "sse",
        webhookUrl: "",
        fileFormat: "jsonl",
        transformTemplate: "{{ payload }}",
        includedFields: ["event_id", "source", "event_type", "occurred_at", "actor", "subject", "payload"],
      },
    },
  },
];

const loadTestEdges: SandboxEdge[] = [
  { id: "e-gen1-flt4", source: "gen-1", target: "flt-4", type: "animated" },
  { id: "e-flt4-out4", source: "flt-4", target: "out-4", type: "animated" },
];

/* ------------------------------------------------------------------ */
/*  Sandboxes                                                          */
/* ------------------------------------------------------------------ */

const DEMO_TENANT = "demo-tenant";

export const DEMO_SANDBOXES: Sandbox[] = [
  {
    id: "sbx_demo_1",
    tenantId: DEMO_TENANT,
    name: "Customer Support Replay",
    description:
      "Replay Intercom conversation events with bot messages filtered out. Useful for testing agent response handling.",
    status: "active",
    nodes: csReplayNodes,
    edges: csReplayEdges,
    createdAt: daysAgo(5),
    updatedAt: hoursAgo(2),
  },
  {
    id: "sbx_demo_2",
    tenantId: DEMO_TENANT,
    name: "Stripe Event Filter",
    description:
      "Split all events into Stripe and non-Stripe streams with separate outputs.",
    status: "active",
    nodes: stripeNodes,
    edges: stripeEdges,
    createdAt: daysAgo(3),
    updatedAt: hoursAgo(8),
  },
  {
    id: "sbx_demo_3",
    tenantId: DEMO_TENANT,
    name: "Synthetic Load Test",
    description:
      "Generate fake support tickets from Intercom and Zendesk at 2/sec and stream to the agent intake endpoint.",
    status: "draft",
    nodes: loadTestNodes,
    edges: loadTestEdges,
    createdAt: daysAgo(1),
    updatedAt: hoursAgo(1),
  },
];

/* ------------------------------------------------------------------ */
/*  Sample events spanning last 7 days — using real catalog            */
/* ------------------------------------------------------------------ */

function generateEvents(
  sandboxId: string,
  count: number
): SandboxEvent[] {
  const events: SandboxEvent[] = [];
  for (let i = 0; i < count; i++) {
    const providerId = randomChoice(PROVIDER_IDS);
    const provider = PROVIDER_CATALOG[providerId];
    const eventType = randomChoice(provider.eventTypes);
    const hoursOffset = Math.random() * 168; // up to 7 days
    const actorType = randomChoice(REAL_ACTOR_TYPES);

    events.push({
      event_id: `evt_${sandboxId}_${i}`,
      sandbox_id: sandboxId,
      source: providerId,
      source_event_id: `${providerId}_${Math.random().toString(36).slice(2, 10)}`,
      event_type: eventType,
      occurred_at: hoursAgo(hoursOffset),
      ingested_at: hoursAgo(hoursOffset - 0.01),
      subject: {
        conversation_id: `conv_${Math.floor(Math.random() * 1000)}`,
        customer_id: `cust_${Math.floor(Math.random() * 500)}`,
      },
      actor: {
        actor_type: actorType,
        actor_id: `actor_${Math.floor(Math.random() * 100)}`,
        name: randomChoice(REAL_NAMES[actorType] ?? ["Unknown"]),
      },
      payload: makePayload(providerId, eventType),
    });
  }
  return events.sort(
    (a, b) =>
      new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );
}

/* ------------------------------------------------------------------ */
/*  Sample agent actions                                               */
/* ------------------------------------------------------------------ */

function generateActions(
  sandboxId: string,
  events: SandboxEvent[]
): AgentAction[] {
  const actions: AgentAction[] = [];
  const actionTypes = [
    "reply",
    "escalate",
    "close",
    "tag",
    "assign",
    "refund",
  ];

  for (let i = 0; i < Math.min(10, events.length); i++) {
    const evt = events[Math.floor(Math.random() * events.length)];
    actions.push({
      id: `act_${sandboxId}_${i}`,
      sandbox_id: sandboxId,
      agent_id: `agent_${Math.floor(Math.random() * 3)}`,
      action_type: randomChoice(actionTypes),
      event_id: evt.event_id,
      timestamp: evt.occurred_at,
      payload: { auto: true, confidence: Math.round(Math.random() * 100) / 100 },
    });
  }
  return actions;
}

/* ------------------------------------------------------------------ */
/*  Seed function                                                      */
/* ------------------------------------------------------------------ */

export function seedStore(
  store: {
    seed: (
      sandboxes: Sandbox[],
      events: Record<string, SandboxEvent[]>,
      actions: Record<string, AgentAction[]>
    ) => void;
  }
) {
  const eventsMap: Record<string, SandboxEvent[]> = {};
  const actionsMap: Record<string, AgentAction[]> = {};

  for (const sbx of DEMO_SANDBOXES) {
    const evts = generateEvents(sbx.id, 50);
    eventsMap[sbx.id] = evts;
    actionsMap[sbx.id] = generateActions(sbx.id, evts);
  }

  store.seed(DEMO_SANDBOXES, eventsMap, actionsMap);
}
