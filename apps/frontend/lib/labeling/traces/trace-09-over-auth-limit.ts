import type {
  Trace,
  TraceEvent,
  AgentContextSnapshot,
  AutoActionAudit,
} from "../types";
import { eid, offset, buildTrace } from "./_helpers";

const base = new Date("2026-02-19T11:05:00Z");

const agentContext: AgentContextSnapshot = {
  fields: {
    order_id: "ORD-8305",
    customer_id: "cust_088",
    customer_name: "Kevin Wright",
    customer_email: "kevin.wright@example.com",
    charge_id: "ch_P9q0",
    refund_amount: 35000,
    eligibility_result: { eligible: true, approved_amount: 35000 },
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
  eligibilityResult: eid(),
  refundCreate: eid(),
  refundResult: eid(),
  agentConfirmation: eid(),
  customerThanks: eid(),
};

const events: TraceEvent[] = [
  {
    event_id: e.customerMessage,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 0),
    actor: {
      actor_type: "customer",
      actor_id: "cust_088",
      name: "Kevin Wright",
    },
    message:
      "Hi, I need a refund for order #ORD-8305. The standing desk I received has a defective motor — it won't adjust height at all. The order was $350.",
  },
  {
    event_id: e.agentGreeting,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 1),
    actor: {
      actor_type: "agent",
      actor_id: "agent_refund",
      name: "Refund Processing Agent",
    },
    message:
      "Hi Kevin, I'm sorry to hear about the defective desk. Let me verify your identity and look into this for you.",
  },
  {
    event_id: e.identityCheck,
    source: "intercom",
    event_type: "action.identity_verification",
    occurred_at: offset(base, 1.5),
    actor: {
      actor_type: "agent",
      actor_id: "agent_refund",
      name: "Refund Processing Agent",
    },
    payload: { method: "email_match", customer_id: "cust_088" },
  },
  {
    event_id: e.identityResult,
    source: "intercom",
    event_type: "identity.verified",
    occurred_at: offset(base, 2),
    actor: { actor_type: "system", actor_id: "intercom" },
    payload: { customer_id: "cust_088", verified: true },
  },
  {
    event_id: e.chargeRetrieve,
    source: "stripe",
    event_type: "charge.retrieve",
    occurred_at: offset(base, 2.5),
    actor: {
      actor_type: "agent",
      actor_id: "agent_refund",
      name: "Refund Processing Agent",
    },
    payload: { charge_id: "ch_P9q0", customer_id: "cust_088" },
  },
  {
    event_id: e.chargeResult,
    source: "stripe",
    event_type: "charge.retrieved",
    occurred_at: offset(base, 3),
    actor: { actor_type: "system", actor_id: "stripe" },
    payload: {
      charge_id: "ch_P9q0",
      amount: 35000,
      currency: "usd",
      description: "Standing Desk — Motorized Height Adjustable",
      created: "2026-02-10T16:30:00Z",
      order_id: "ORD-8305",
    },
  },
  {
    event_id: e.eligibilityCheck,
    source: "stripe",
    event_type: "action.eligibility_check",
    occurred_at: offset(base, 3.5),
    actor: {
      actor_type: "agent",
      actor_id: "agent_refund",
      name: "Refund Processing Agent",
    },
    payload: {
      charge_id: "ch_P9q0",
      reason: "defective_product",
      customer_id: "cust_088",
    },
  },
  {
    event_id: e.eligibilityResult,
    source: "stripe",
    event_type: "eligibility.result",
    occurred_at: offset(base, 4),
    actor: { actor_type: "system", actor_id: "policy_engine" },
    payload: {
      eligible: true,
      approved_amount: 35000,
      reason: "Full refund approved — defective product within return window.",
      policy_version: "v2.3",
    },
  },
  {
    event_id: e.refundCreate,
    source: "stripe",
    event_type: "refund.create",
    occurred_at: offset(base, 5),
    actor: {
      actor_type: "agent",
      actor_id: "agent_refund",
      name: "Refund Processing Agent",
    },
    payload: {
      charge_id: "ch_P9q0",
      amount: 35000,
      currency: "usd",
      reason: "defective_product",
    },
  },
  {
    event_id: e.refundResult,
    source: "stripe",
    event_type: "refund.created",
    occurred_at: offset(base, 5.5),
    actor: { actor_type: "system", actor_id: "stripe" },
    payload: { refund_id: "re_Xt8mKq4wJ", amount: 35000, status: "succeeded" },
  },
  {
    event_id: e.agentConfirmation,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 6),
    actor: {
      actor_type: "agent",
      actor_id: "agent_refund",
      name: "Refund Processing Agent",
    },
    message:
      "Good news, Kevin — your refund of $350.00 for the defective standing desk has been processed. You should see it back on your card within 5-10 business days. Is there anything else I can help with?",
  },
  {
    event_id: e.customerThanks,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 7),
    actor: {
      actor_type: "customer",
      actor_id: "cust_088",
      name: "Kevin Wright",
    },
    message: "Perfect, thank you for the quick resolution!",
  },
];

const autoAudit: AutoActionAudit = {
  action_annotations: [
    {
      event_id: e.agentGreeting,
      verdict: "correct",
      reasoning: "Empathetic greeting with clear intent to investigate.",
    },
    {
      event_id: e.identityCheck,
      verdict: "correct",
      reasoning: "Identity verification initiated before any account action.",
    },
    {
      event_id: e.chargeRetrieve,
      verdict: "correct",
      reasoning:
        "Charge details retrieved from Stripe to confirm order and amount.",
    },
    {
      event_id: e.eligibilityCheck,
      verdict: "correct",
      reasoning: "Eligibility check performed before refund processing.",
    },
    {
      event_id: e.refundCreate,
      verdict: "incorrect",
      reasoning:
        "Refund of $350 exceeds the agent's $200 authorization limit. Agent should have escalated to a manager via Slack before processing. The refund itself is valid, but the agent lacks authority to approve it unilaterally.",
      should_have_done:
        "Send a Slack escalation to the on-duty manager with the refund details and wait for approval before processing.",
      instruction_violations: [
        {
          instruction_id: "R5",
          instruction_text:
            "Refunds exceeding $200 require manager approval. Escalate via Slack to the on-duty manager and wait for explicit approval before processing the refund.",
          violation_description:
            "Agent processed a $350 refund without escalating to a manager. The authorization limit is $200, and no Slack escalation event exists in the trace.",
          context_evidence:
            "refund_amount=35000 ($350) exceeds $200 threshold; no slack event in trace",
        },
      ],
    },
    {
      event_id: e.agentConfirmation,
      verdict: "partial",
      reasoning:
        "Confirmation message is accurate but the underlying refund was unauthorized — agent should not have confirmed a refund it lacked authority to issue.",
    },
  ],
  overall_score: 2,
  critical_errors: [
    "Agent processed a $350 refund without manager escalation, exceeding the $200 authorization limit.",
  ],
  correction_summary:
    "Before processing refunds over $200, the agent must send a Slack escalation to the on-duty manager containing the order ID, refund amount, and reason. The agent should inform the customer that the refund requires manager approval and wait for the manager's explicit go-ahead before calling refund.create.",
  summary:
    "The agent followed every step of the refund workflow correctly — identity verification, charge retrieval, eligibility check — and the refund itself was valid. However, the $350 amount exceeds the agent's $200 authorization limit, which requires a Slack escalation to a manager before processing. No escalation occurred.",
  confidence: 0.33,
  ood_score: {
    transition_deviation: 0.08,
    tool_frequency_deviation: 0.1,
    temporal_deviation: 0.06,
    embedding_distance: 0.15,
    composite_score: 0.12,
    flagged: false,
  },
  context_integrity: {
    violations: [],
    passed: true,
  },
  instruction_violations_summary: [
    {
      instruction_id: "R5",
      instruction_text:
        "Refunds exceeding $200 require manager approval. Escalate via Slack to the on-duty manager and wait for explicit approval before processing the refund.",
      violation_description:
        "Agent processed a $350 refund directly without Slack escalation or manager approval.",
    },
  ],
};

export const trace: Trace = buildTrace({
  conversationId: "conv_refund_8305",
  agentId: "agent_refund",
  agentContext,
  events,
  status: "auto_labeled",
  autoAudit,
  confidence: 0.33,
});
