import type { Trace, TraceEvent, AgentContextSnapshot, AutoActionAudit, HumanActionAudit } from "../types";
import { eid, offset, buildTrace } from "./_helpers";

const base = new Date("2026-02-19T10:05:00Z");

const agentContext: AgentContextSnapshot = {
  fields: {
    order_id: "ORD-9001",
    customer_id: "cust_901",
    charge_id: "ch_T3u4",
    refund_amount: 7500,
    eligibility_result: { eligible: true, approved_amount: 7500 },
    policy_version: "v2.3",
    identity_confirmed: true,
  },
  missing_fields: [],
  stale_fields: [],
};

const e = {
  customerMessage: eid(),
  agentGreeting: eid(),
  identityCheck: eid(),
  identityResult: eid(),
  chargeRetrieve: eid(),
  chargeResult: eid(),
  eligibilityCheck: eid(),
  refundCreate: eid(),
  agentConfirmation: eid(),
  customerThanks: eid(),
};

const events: TraceEvent[] = [
  {
    event_id: e.customerMessage,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 0),
    actor: { actor_type: "customer", actor_id: "cust_901", name: "Amy Torres" },
    message: "Hi, I'd like to request a refund for order #ORD-9001. I purchased a bluetooth speaker for $75 about two weeks ago and it stopped working.",
  },
  {
    event_id: e.agentGreeting,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 1),
    actor: { actor_type: "agent", actor_id: "agent_refund", name: "Refund Processing Agent" },
    message: "Hi Amy! I'm sorry to hear about the issue with your bluetooth speaker. Let me verify your identity and look into this for you right away.",
  },
  {
    event_id: e.identityCheck,
    source: "intercom",
    event_type: "action.identity_verification",
    occurred_at: offset(base, 1.5),
    actor: { actor_type: "agent", actor_id: "agent_refund", name: "Refund Processing Agent" },
    payload: { method: "email_match", customer_id: "cust_901" },
  },
  {
    event_id: e.identityResult,
    source: "intercom",
    event_type: "identity.verified",
    occurred_at: offset(base, 2),
    actor: { actor_type: "system", actor_id: "intercom" },
    payload: { customer_id: "cust_901", verified: true },
  },
  {
    event_id: e.chargeRetrieve,
    source: "stripe",
    event_type: "charge.retrieve",
    occurred_at: offset(base, 2.5),
    actor: { actor_type: "agent", actor_id: "agent_refund", name: "Refund Processing Agent" },
    payload: { charge_id: "ch_T3u4", order_id: "ORD-9001" },
  },
  {
    event_id: e.chargeResult,
    source: "stripe",
    event_type: "charge.retrieved",
    occurred_at: offset(base, 3),
    actor: { actor_type: "system", actor_id: "stripe" },
    payload: { charge_id: "ch_T3u4", amount: 7500, currency: "usd", created: "2026-02-05T09:12:00Z", description: "Bluetooth Speaker BT-200" },
  },
  {
    event_id: e.eligibilityCheck,
    source: "intercom",
    event_type: "action.eligibility_check",
    occurred_at: offset(base, 3.5),
    actor: { actor_type: "system", actor_id: "refund_engine" },
    payload: { order_id: "ORD-9001", eligible: true, approved_amount: 7500, reason: "within_30_day_window", days_since_purchase: 14 },
  },
  {
    event_id: e.refundCreate,
    source: "stripe",
    event_type: "refund.created",
    occurred_at: offset(base, 4),
    actor: { actor_type: "agent", actor_id: "agent_refund", name: "Refund Processing Agent" },
    payload: { refund_id: "re_8mPqXw2n", charge_id: "ch_T3u4", amount: 7500, status: "succeeded" },
  },
  {
    event_id: e.agentConfirmation,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 4.5),
    actor: { actor_type: "agent", actor_id: "agent_refund", name: "Refund Processing Agent" },
    message: "Great news, Amy! Your refund of $75.00 for order #ORD-9001 has been processed successfully. You should see it back in your account within 5-10 business days. Is there anything else I can help with?",
  },
  {
    event_id: e.customerThanks,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 6),
    actor: { actor_type: "customer", actor_id: "cust_901", name: "Amy Torres" },
    message: "No that's everything, thanks for the quick help!",
  },
];

const autoAudit: AutoActionAudit = {
  action_annotations: [
    {
      event_id: e.agentGreeting,
      verdict: "correct",
      reasoning: "Appropriate greeting with empathy and clear next steps communicated.",
    },
    {
      event_id: e.identityCheck,
      verdict: "correct",
      reasoning: "Identity verification initiated before any account access.",
    },
    {
      event_id: e.chargeRetrieve,
      verdict: "correct",
      reasoning: "Charge details retrieved from Stripe to validate order and amount.",
    },
    {
      event_id: e.eligibilityCheck,
      verdict: "correct",
      reasoning: "Eligibility check confirms order is within 30-day refund window.",
    },
    {
      event_id: e.refundCreate,
      verdict: "correct",
      reasoning: "Refund amount matches approved amount, under $200 limit — no escalation required.",
    },
    {
      event_id: e.agentConfirmation,
      verdict: "correct",
      reasoning: "Confirmation message includes amount, order reference, and timeline.",
    },
  ],
  overall_score: 5,
  critical_errors: [],
  correction_summary: "No corrections needed. All workflow steps executed in correct order.",
  summary: "Agent followed the complete refund workflow: verified identity, retrieved charge, confirmed eligibility, processed refund within policy limits, and provided clear confirmation to customer.",
  confidence: 0.92,
  ood_score: {
    transition_deviation: 0.02,
    tool_frequency_deviation: 0.04,
    temporal_deviation: 0.03,
    embedding_distance: 0.06,
    composite_score: 0.05,
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
    { event_id: e.identityCheck, verdict: "correct" },
    { event_id: e.chargeRetrieve, verdict: "correct" },
    { event_id: e.eligibilityCheck, verdict: "correct" },
    { event_id: e.refundCreate, verdict: "correct" },
    { event_id: e.agentConfirmation, verdict: "correct" },
  ],
  overall_score: 5,
  critical_errors: [],
  correction_summary: "Textbook refund execution — identity verified, eligibility checked, amount correct, customer confirmed.",
  notes: "No issues. Perfect execution of the refund workflow.",
};

export const trace: Trace = buildTrace({
  conversationId: "conv_refund_9001",
  agentId: "agent_refund",
  agentContext,
  events,
  status: "labeled",
  autoAudit,
  confidence: 0.92,
  humanAudit,
});
