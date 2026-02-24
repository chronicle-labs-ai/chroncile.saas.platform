import type { Trace, TraceEvent, AgentContextSnapshot, AutoActionAudit } from "../types";
import { eid, offset, buildTrace } from "./_helpers";

const base = new Date("2026-02-22T09:30:00Z");

const agentContext: AgentContextSnapshot = {
  fields: {
    customer_id: "cust_192",
    charge_ids: ["ch_G7h8", "ch_I9j0", "ch_K1l2"],
    subscription_id: "sub_M3n4",
    billing_period: "2026-02",
  },
  missing_fields: [],
  stale_fields: [],
};

const e = {
  customerQuestion: eid(),
  agentAck: eid(),
  chargeList: eid(),
  chargeListResult: eid(),
  chargeRetrieve1: eid(),
  chargeRetrieve1Result: eid(),
  chargeRetrieve2: eid(),
  chargeRetrieve2Result: eid(),
  chargeRetrieve3: eid(),
  chargeRetrieve3Result: eid(),
  subRetrieve: eid(),
  subRetrieveResult: eid(),
  invoiceList: eid(),
  invoiceListResult: eid(),
  agentResponse: eid(),
};

const events: TraceEvent[] = [
  {
    event_id: e.customerQuestion,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 0),
    actor: { actor_type: "customer", actor_id: "cust_192", name: "Frank Müller" },
    message: "Hey, when does my subscription renew? I want to make sure my card is charged on the right date.",
  },
  {
    event_id: e.agentAck,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 0.5),
    actor: { actor_type: "agent", actor_id: "agent_billing", name: "Billing Agent" },
    message: "Hi Frank! Let me look into your subscription details for you.",
  },
  {
    event_id: e.chargeList,
    source: "stripe",
    event_type: "charge.list",
    occurred_at: offset(base, 1),
    actor: { actor_type: "agent", actor_id: "agent_billing", name: "Billing Agent" },
    payload: { customer_id: "cust_192", limit: 10 },
  },
  {
    event_id: e.chargeListResult,
    source: "stripe",
    event_type: "charge.list.result",
    occurred_at: offset(base, 1.2),
    actor: { actor_type: "system", actor_id: "stripe" },
    payload: {
      charges: [
        { id: "ch_G7h8", amount: 2999, created: "2026-02-01T00:00:00Z" },
        { id: "ch_I9j0", amount: 2999, created: "2026-01-01T00:00:00Z" },
        { id: "ch_K1l2", amount: 2999, created: "2025-12-01T00:00:00Z" },
      ],
    },
  },
  {
    event_id: e.chargeRetrieve1,
    source: "stripe",
    event_type: "charge.retrieve",
    occurred_at: offset(base, 1.8),
    actor: { actor_type: "agent", actor_id: "agent_billing", name: "Billing Agent" },
    payload: { charge_id: "ch_G7h8" },
  },
  {
    event_id: e.chargeRetrieve1Result,
    source: "stripe",
    event_type: "charge.retrieved",
    occurred_at: offset(base, 2),
    actor: { actor_type: "system", actor_id: "stripe" },
    payload: { id: "ch_G7h8", amount: 2999, status: "succeeded", invoice: "inv_P5q6" },
  },
  {
    event_id: e.chargeRetrieve2,
    source: "stripe",
    event_type: "charge.retrieve",
    occurred_at: offset(base, 2.5),
    actor: { actor_type: "agent", actor_id: "agent_billing", name: "Billing Agent" },
    payload: { charge_id: "ch_I9j0" },
  },
  {
    event_id: e.chargeRetrieve2Result,
    source: "stripe",
    event_type: "charge.retrieved",
    occurred_at: offset(base, 2.7),
    actor: { actor_type: "system", actor_id: "stripe" },
    payload: { id: "ch_I9j0", amount: 2999, status: "succeeded", invoice: "inv_R7s8" },
  },
  {
    event_id: e.chargeRetrieve3,
    source: "stripe",
    event_type: "charge.retrieve",
    occurred_at: offset(base, 3.2),
    actor: { actor_type: "agent", actor_id: "agent_billing", name: "Billing Agent" },
    payload: { charge_id: "ch_K1l2" },
  },
  {
    event_id: e.chargeRetrieve3Result,
    source: "stripe",
    event_type: "charge.retrieved",
    occurred_at: offset(base, 3.4),
    actor: { actor_type: "system", actor_id: "stripe" },
    payload: { id: "ch_K1l2", amount: 2999, status: "succeeded", invoice: "inv_T9u0" },
  },
  {
    event_id: e.subRetrieve,
    source: "stripe",
    event_type: "subscription.retrieve",
    occurred_at: offset(base, 4),
    actor: { actor_type: "agent", actor_id: "agent_billing", name: "Billing Agent" },
    payload: { subscription_id: "sub_M3n4" },
  },
  {
    event_id: e.subRetrieveResult,
    source: "stripe",
    event_type: "subscription.retrieved",
    occurred_at: offset(base, 4.2),
    actor: { actor_type: "system", actor_id: "stripe" },
    payload: {
      id: "sub_M3n4",
      status: "active",
      current_period_end: "2026-03-01T00:00:00Z",
      plan: { amount: 2999, interval: "month" },
    },
  },
  {
    event_id: e.invoiceList,
    source: "stripe",
    event_type: "invoice.list",
    occurred_at: offset(base, 4.8),
    actor: { actor_type: "agent", actor_id: "agent_billing", name: "Billing Agent" },
    payload: { customer_id: "cust_192", subscription: "sub_M3n4", limit: 5 },
  },
  {
    event_id: e.invoiceListResult,
    source: "stripe",
    event_type: "invoice.list.result",
    occurred_at: offset(base, 5),
    actor: { actor_type: "system", actor_id: "stripe" },
    payload: {
      invoices: [
        { id: "inv_P5q6", amount_due: 2999, status: "paid", period_end: "2026-03-01T00:00:00Z" },
        { id: "inv_R7s8", amount_due: 2999, status: "paid", period_end: "2026-02-01T00:00:00Z" },
      ],
    },
  },
  {
    event_id: e.agentResponse,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 5.5),
    actor: { actor_type: "agent", actor_id: "agent_billing", name: "Billing Agent" },
    message: "Your subscription renews on March 1, 2026. You're on the $29.99/month plan and your card will be charged on that date. Everything looks good with your billing history — all recent charges have been successful!",
  },
];

const autoAudit: AutoActionAudit = {
  action_annotations: [
    {
      event_id: e.agentAck,
      verdict: "correct",
      reasoning: "Appropriate acknowledgment of the customer's question.",
    },
    {
      event_id: e.chargeList,
      verdict: "unnecessary",
      reasoning: "Listing charges is not needed to answer a subscription renewal date question. A single subscription.retrieve call would suffice.",
      should_have_done: "Skip charge listing entirely and call subscription.retrieve directly.",
    },
    {
      event_id: e.chargeRetrieve1,
      verdict: "unnecessary",
      reasoning: "Individual charge retrieval is irrelevant to a renewal date inquiry.",
    },
    {
      event_id: e.chargeRetrieve2,
      verdict: "unnecessary",
      reasoning: "Second redundant charge retrieval with no bearing on the customer's question.",
    },
    {
      event_id: e.chargeRetrieve3,
      verdict: "unnecessary",
      reasoning: "Third redundant charge retrieval. The agent appears to be iterating through all charges for no discernible reason.",
    },
    {
      event_id: e.subRetrieve,
      verdict: "correct",
      reasoning: "This is the only call actually needed to answer the question.",
    },
    {
      event_id: e.invoiceList,
      verdict: "unnecessary",
      reasoning: "Invoice listing is not required for a renewal date question. The subscription object already contains the period end date.",
    },
    {
      event_id: e.agentResponse,
      verdict: "correct",
      reasoning: "The final answer is accurate and clearly communicates the renewal date.",
    },
  ],
  overall_score: 3,
  critical_errors: [
    "Agent made 6 Stripe API calls when 1 (subscription.retrieve) would have been sufficient.",
  ],
  correction_summary:
    "For a subscription renewal inquiry, the agent should call subscription.retrieve once and respond. The charge.list, three charge.retrieve calls, and invoice.list were all unnecessary, adding latency and wasting API quota.",
  summary:
    "The agent eventually provided the correct renewal date, but exhibited a severely anomalous tool usage pattern — 6 API calls instead of the expected 1-2. This suggests a confused retrieval strategy or reasoning loop. The answer was correct but the path to get there was highly inefficient.",
  confidence: 0.35,
  ood_score: {
    transition_deviation: 0.4,
    tool_frequency_deviation: 0.89,
    temporal_deviation: 0.35,
    embedding_distance: 0.18,
    composite_score: 0.72,
    flagged: true,
  },
  context_integrity: {
    violations: [],
    passed: true,
  },
  instruction_violations_summary: [],
};

export const trace: Trace = buildTrace({
  conversationId: "conv_billing_sub_renewal",
  agentId: "agent_billing",
  agentContext,
  events,
  status: "auto_labeled",
  autoAudit,
  confidence: 0.35,
});
