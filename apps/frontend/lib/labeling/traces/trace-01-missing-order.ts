import type {
  Trace,
  TraceEvent,
  AgentContextSnapshot,
  AutoActionAudit,
} from "../types";
import { eid, offset, buildTrace } from "./_helpers";

const base = new Date("2026-02-18T14:22:00Z");

const agentContext: AgentContextSnapshot = {
  fields: {
    customer_id: "cus_8Qm2vNxLpR",
    customer_name: "Sarah Chen",
    customer_email: "sarah.chen@example.com",
    refund_amount: 8999,
    identity_confirmed: true,
    policy_version: "v2.3",
  },
  missing_fields: ["order_id", "charge_id", "eligibility_result"],
  stale_fields: [],
};

const e = {
  customerMessage: eid(),
  agentGreeting: eid(),
  identityCheck: eid(),
  identityResult: eid(),
  agentAcknowledge: eid(),
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
      actor_id: "cus_8Qm2vNxLpR",
      name: "Sarah Chen",
    },
    message:
      "Hi, I received the wrong item for order #ORD-4582. I ordered a wireless keyboard but got a mouse pad instead. I'd like a refund please.",
  },
  {
    event_id: e.agentGreeting,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 1),
    actor: {
      actor_type: "agent",
      actor_id: "agent_refund",
      name: "Refund Agent",
    },
    message:
      "Hello Sarah! I'm sorry to hear you received the wrong item. Let me verify your identity and get this sorted out for you right away.",
  },
  {
    event_id: e.identityCheck,
    source: "intercom",
    event_type: "action.identity_verification",
    occurred_at: offset(base, 1.5),
    actor: {
      actor_type: "agent",
      actor_id: "agent_refund",
      name: "Refund Agent",
    },
    payload: { method: "email_match", customer_id: "cus_8Qm2vNxLpR" },
  },
  {
    event_id: e.identityResult,
    source: "intercom",
    event_type: "identity.verified",
    occurred_at: offset(base, 2),
    actor: { actor_type: "system", actor_id: "intercom" },
    payload: { customer_id: "cus_8Qm2vNxLpR", verified: true },
  },
  {
    event_id: e.agentAcknowledge,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 2.5),
    actor: {
      actor_type: "agent",
      actor_id: "agent_refund",
      name: "Refund Agent",
    },
    message:
      "Your identity has been verified. I can see the charge on your account for $89.99. Let me process that refund for you now.",
  },
  {
    event_id: e.refundCreate,
    source: "stripe",
    event_type: "refund.create",
    occurred_at: offset(base, 3),
    actor: {
      actor_type: "agent",
      actor_id: "agent_refund",
      name: "Refund Agent",
    },
    payload: {
      amount: 8999,
      currency: "usd",
      customer_id: "cus_8Qm2vNxLpR",
      reason: "wrong_item_received",
    },
  },
  {
    event_id: e.refundResult,
    source: "stripe",
    event_type: "refund.created",
    occurred_at: offset(base, 3.5),
    actor: { actor_type: "system", actor_id: "stripe" },
    payload: { refund_id: "re_3nPqKx9mV", amount: 8999, status: "succeeded" },
  },
  {
    event_id: e.agentConfirmation,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 4),
    actor: {
      actor_type: "agent",
      actor_id: "agent_refund",
      name: "Refund Agent",
    },
    message:
      "Great news — your refund of $89.99 has been processed successfully. You should see it in your account within 5-10 business days. Is there anything else I can help with?",
  },
  {
    event_id: e.customerThanks,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 5),
    actor: {
      actor_type: "customer",
      actor_id: "cus_8Qm2vNxLpR",
      name: "Sarah Chen",
    },
    message: "That was fast, thank you!",
  },
];

const autoAudit: AutoActionAudit = {
  action_annotations: [
    {
      event_id: e.agentGreeting,
      verdict: "correct",
      reasoning: "Appropriate greeting and empathy shown.",
    },
    {
      event_id: e.identityCheck,
      verdict: "correct",
      reasoning: "Identity verification initiated before processing refund.",
    },
    {
      event_id: e.agentAcknowledge,
      verdict: "partial",
      reasoning:
        "Agent acknowledged the charge amount but did not retrieve the order first to validate the item claim.",
      should_have_done:
        "Retrieve order #ORD-4582 via stripe charge.retrieve to confirm wrong item before proceeding.",
      context_violations: [
        {
          type: "missing_field",
          field: "order_id",
          description:
            "Agent never retrieved the order record; order_id is absent from context.",
          severity: "critical",
        },
      ],
    },
    {
      event_id: e.refundCreate,
      verdict: "incorrect",
      reasoning:
        "Refund issued without retrieving the charge or checking eligibility. Agent bypassed mandatory order lookup and eligibility verification steps.",
      should_have_done:
        "Call stripe charge.retrieve for the order, then run eligibility check before creating refund.",
      instruction_violations: [
        {
          instruction_id: "R2",
          instruction_text:
            "Always retrieve the order and charge details from Stripe before processing any refund.",
          violation_description:
            "Agent issued refund.create without a prior charge.retrieve call; no order data was loaded into context.",
          context_evidence: "missing_fields includes order_id and charge_id",
        },
        {
          instruction_id: "R3",
          instruction_text:
            "Run the eligibility check and confirm the customer qualifies for a refund before processing.",
          violation_description:
            "No eligibility check was performed; eligibility_result is missing from context.",
          context_evidence: "missing_fields includes eligibility_result",
        },
      ],
      context_violations: [
        {
          type: "missing_field",
          field: "charge_id",
          description:
            "No charge was retrieved from Stripe before refund creation.",
          severity: "critical",
        },
        {
          type: "missing_field",
          field: "eligibility_result",
          description: "Eligibility check was never executed.",
          severity: "critical",
        },
      ],
    },
    {
      event_id: e.agentConfirmation,
      verdict: "partial",
      reasoning:
        "Confirmation message is polite but premature — the refund should not have been issued without order verification.",
    },
  ],
  overall_score: 2,
  critical_errors: [
    "Refund processed without retrieving order or charge details from Stripe.",
    "Eligibility check was skipped entirely.",
  ],
  correction_summary:
    "Agent must retrieve order via charge.retrieve and run the eligibility check before issuing any refund. The refund amount should be confirmed against the eligibility result.",
  summary:
    "The agent correctly verified identity and communicated politely, but skipped the critical order retrieval and eligibility steps before processing the refund. Three required context fields were never populated.",
  confidence: 0.22,
  ood_score: {
    transition_deviation: 0.11,
    tool_frequency_deviation: 0.19,
    temporal_deviation: 0.08,
    embedding_distance: 0.14,
    composite_score: 0.15,
    flagged: false,
  },
  context_integrity: {
    violations: [
      {
        type: "missing_field",
        field: "order_id",
        description:
          "Order ID was never retrieved; the agent skipped the order lookup step entirely.",
        severity: "critical",
      },
      {
        type: "missing_field",
        field: "charge_id",
        description:
          "Charge ID is absent — no Stripe charge.retrieve was called before refund.",
        severity: "critical",
      },
      {
        type: "missing_field",
        field: "eligibility_result",
        description:
          "Eligibility check was never run; result is missing from agent context.",
        severity: "critical",
      },
    ],
    passed: false,
  },
  instruction_violations_summary: [
    {
      instruction_id: "R2",
      instruction_text:
        "Always retrieve the order and charge details from Stripe before processing any refund.",
      violation_description:
        "No charge.retrieve call was made; order_id and charge_id are missing from context.",
    },
    {
      instruction_id: "R3",
      instruction_text:
        "Run the eligibility check and confirm the customer qualifies for a refund before processing.",
      violation_description:
        "Eligibility check was never executed; eligibility_result is missing.",
    },
  ],
};

export const trace: Trace = buildTrace({
  conversationId: "conv_refund_4582",
  agentId: "agent_refund",
  agentContext,
  events,
  status: "auto_labeled",
  autoAudit,
  confidence: 0.22,
});
