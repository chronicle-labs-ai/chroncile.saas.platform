import type {
  Trace,
  TraceEvent,
  AgentContextSnapshot,
  AutoActionAudit,
  HumanActionAudit,
} from "../types";
import { eid, offset, buildTrace } from "./_helpers";

const base = new Date("2026-02-20T15:30:00Z");

const agentContext: AgentContextSnapshot = {
  fields: {
    customer_id: "cust_565",
    charge_ids: ["ch_V5w6", "ch_X7y8"],
    subscription_id: "sub_Z9a0",
    billing_period: "2026-02",
  },
  missing_fields: [],
  stale_fields: [],
};

const e = {
  customerReport: eid(),
  agentGreeting: eid(),
  chargeListRetrieve: eid(),
  chargeListResult: eid(),
  agentIdentifiesDuplicate: eid(),
  refundDuplicate: eid(),
  refundResult: eid(),
  slackEscalation: eid(),
  agentConfirmation: eid(),
  customerSatisfied: eid(),
};

const events: TraceEvent[] = [
  {
    event_id: e.customerReport,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 0),
    actor: {
      actor_type: "customer",
      actor_id: "cust_565",
      name: "Nicole Adams",
    },
    message:
      "Hi, I just noticed I was charged twice for my subscription this month — two charges of $29.99 on Feb 15. Can you look into this?",
  },
  {
    event_id: e.agentGreeting,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 1),
    actor: {
      actor_type: "agent",
      actor_id: "agent_billing",
      name: "Billing Agent",
    },
    message:
      "Hi Nicole, I'm sorry about that — duplicate charges are definitely not supposed to happen. Let me pull up your billing history right now to sort this out.",
  },
  {
    event_id: e.chargeListRetrieve,
    source: "stripe",
    event_type: "charge.list",
    occurred_at: offset(base, 1.5),
    actor: {
      actor_type: "agent",
      actor_id: "agent_billing",
      name: "Billing Agent",
    },
    payload: {
      customer_id: "cust_565",
      subscription_id: "sub_Z9a0",
      period: "2026-02",
    },
  },
  {
    event_id: e.chargeListResult,
    source: "stripe",
    event_type: "charge.list.result",
    occurred_at: offset(base, 2),
    actor: { actor_type: "system", actor_id: "stripe" },
    payload: {
      charges: [
        {
          charge_id: "ch_V5w6",
          amount: 2999,
          created: "2026-02-15T00:00:12Z",
          description: "Pro Plan — Feb 2026",
        },
        {
          charge_id: "ch_X7y8",
          amount: 2999,
          created: "2026-02-15T00:01:44Z",
          description: "Pro Plan — Feb 2026",
        },
      ],
    },
  },
  {
    event_id: e.agentIdentifiesDuplicate,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 3),
    actor: {
      actor_type: "agent",
      actor_id: "agent_billing",
      name: "Billing Agent",
    },
    message:
      "I can confirm there are two identical charges of $29.99 for your Pro Plan on Feb 15. The second charge (ch_X7y8) is a duplicate. I'll refund that one right now.",
  },
  {
    event_id: e.refundDuplicate,
    source: "stripe",
    event_type: "refund.create",
    occurred_at: offset(base, 3.5),
    actor: {
      actor_type: "agent",
      actor_id: "agent_billing",
      name: "Billing Agent",
    },
    payload: { charge_id: "ch_X7y8", amount: 2999, reason: "duplicate_charge" },
  },
  {
    event_id: e.refundResult,
    source: "stripe",
    event_type: "refund.created",
    occurred_at: offset(base, 4),
    actor: { actor_type: "system", actor_id: "stripe" },
    payload: {
      refund_id: "re_4kLnYw7p",
      charge_id: "ch_X7y8",
      amount: 2999,
      status: "succeeded",
    },
  },
  {
    event_id: e.slackEscalation,
    source: "slack",
    event_type: "message.sent",
    occurred_at: offset(base, 4.5),
    actor: {
      actor_type: "agent",
      actor_id: "agent_billing",
      name: "Billing Agent",
    },
    message:
      "Duplicate charge detected for cust_565 / sub_Z9a0 in billing period 2026-02. Charges ch_V5w6 and ch_X7y8 fired within 92s of each other. Refunded ch_X7y8. Possible race condition in subscription renewal job.",
    payload: { channel: "#billing-eng-alerts", thread_ts: "1708444230.001200" },
  },
  {
    event_id: e.agentConfirmation,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 5),
    actor: {
      actor_type: "agent",
      actor_id: "agent_billing",
      name: "Billing Agent",
    },
    message:
      "All done, Nicole! I've refunded the duplicate charge of $29.99. You should see it back within 5-10 business days. I've also flagged this to our engineering team so they can investigate the root cause. Is there anything else I can help with?",
  },
  {
    event_id: e.customerSatisfied,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 7),
    actor: {
      actor_type: "customer",
      actor_id: "cust_565",
      name: "Nicole Adams",
    },
    message: "That's great, thanks for taking care of it so quickly!",
  },
];

const autoAudit: AutoActionAudit = {
  action_annotations: [
    {
      event_id: e.agentGreeting,
      verdict: "correct",
      reasoning: "Empathetic acknowledgment and clear intent to investigate.",
    },
    {
      event_id: e.chargeListRetrieve,
      verdict: "correct",
      reasoning:
        "Retrieved full charge list scoped to customer, subscription, and billing period.",
    },
    {
      event_id: e.agentIdentifiesDuplicate,
      verdict: "correct",
      reasoning:
        "Correctly identified the duplicate by comparing timestamps and charge descriptions.",
    },
    {
      event_id: e.refundDuplicate,
      verdict: "correct",
      reasoning:
        "Refunded only the duplicate charge with correct amount and reason code.",
    },
    {
      event_id: e.slackEscalation,
      verdict: "correct",
      reasoning:
        "Proactively flagged root cause to engineering with relevant details for investigation.",
    },
    {
      event_id: e.agentConfirmation,
      verdict: "correct",
      reasoning:
        "Clear summary of resolution, timeline, and engineering follow-up communicated to customer.",
    },
  ],
  overall_score: 5,
  critical_errors: [],
  correction_summary:
    "No corrections needed. Duplicate identified, refunded, and root cause escalated.",
  summary:
    "Agent retrieved charge history, correctly identified the duplicate, processed a targeted refund, escalated the root cause to engineering via Slack, and confirmed resolution with the customer.",
  confidence: 0.88,
  ood_score: {
    transition_deviation: 0.04,
    tool_frequency_deviation: 0.06,
    temporal_deviation: 0.03,
    embedding_distance: 0.07,
    composite_score: 0.08,
    flagged: false,
  },
  context_integrity: {
    violations: [],
    passed: true,
  },
  instruction_violations_summary: [],
};

const humanAudit: HumanActionAudit = {
  action_annotations: [
    { event_id: e.agentGreeting, verdict: "correct" },
    { event_id: e.chargeListRetrieve, verdict: "correct" },
    { event_id: e.agentIdentifiesDuplicate, verdict: "correct" },
    { event_id: e.refundDuplicate, verdict: "correct" },
    { event_id: e.slackEscalation, verdict: "correct" },
    { event_id: e.agentConfirmation, verdict: "correct" },
  ],
  overall_score: 5,
  critical_errors: [],
  correction_summary:
    "Efficient duplicate charge resolution with proper root-cause escalation to engineering.",
  notes: "Agent followed all billing SOP steps. Good engineering escalation.",
};

export const trace: Trace = buildTrace({
  conversationId: "conv_billing_565",
  agentId: "agent_billing",
  agentContext,
  events,
  status: "labeled",
  autoAudit,
  confidence: 0.88,
  humanAudit,
});
