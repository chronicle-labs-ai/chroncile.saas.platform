import type { Trace, TraceEvent, AgentContextSnapshot, AutoActionAudit } from "../types";
import { eid, offset, buildTrace } from "./_helpers";

const base = new Date("2026-02-20T10:05:00Z");

const agentContext: AgentContextSnapshot = {
  fields: {
    order_id: "ORD-7201",
    customer_id: "cust_320",
    charge_id: "ch_E5f6",
    refund_amount: 4500,
    eligibility_result: { eligible: true, approved_amount: 4500 },
    policy_version: "v2.3",
  },
  missing_fields: ["identity_confirmed"],
  stale_fields: [],
};

const e = {
  customerRequest: eid(),
  agentGreeting: eid(),
  chargeRetrieve: eid(),
  chargeResult: eid(),
  refundCreate: eid(),
  refundResult: eid(),
  agentConfirmation: eid(),
  customerThanks: eid(),
};

const events: TraceEvent[] = [
  {
    event_id: e.customerRequest,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 0),
    actor: { actor_type: "customer", actor_id: "cust_320", name: "Elena Rossi" },
    message: "Hi, I need to request a refund for order #ORD-7201. The item arrived damaged and I'd like my $45.00 back.",
  },
  {
    event_id: e.agentGreeting,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 0.8),
    actor: { actor_type: "agent", actor_id: "agent_refund", name: "Refund Processing Agent" },
    message: "Hi Elena! I'm sorry about the damaged item. Let me pull up your order and take care of this.",
  },
  {
    event_id: e.chargeRetrieve,
    source: "stripe",
    event_type: "charge.retrieve",
    occurred_at: offset(base, 1.2),
    actor: { actor_type: "agent", actor_id: "agent_refund", name: "Refund Processing Agent" },
    payload: { charge_id: "ch_E5f6", customer_id: "cust_320" },
  },
  {
    event_id: e.chargeResult,
    source: "stripe",
    event_type: "charge.retrieved",
    occurred_at: offset(base, 1.5),
    actor: { actor_type: "system", actor_id: "stripe" },
    payload: {
      charge_id: "ch_E5f6",
      amount: 4500,
      currency: "usd",
      order_id: "ORD-7201",
      status: "succeeded",
    },
  },
  {
    event_id: e.refundCreate,
    source: "stripe",
    event_type: "refund.create",
    occurred_at: offset(base, 2),
    actor: { actor_type: "agent", actor_id: "agent_refund", name: "Refund Processing Agent" },
    payload: {
      charge_id: "ch_E5f6",
      amount: 4500,
      currency: "usd",
      reason: "damaged_item",
    },
  },
  {
    event_id: e.refundResult,
    source: "stripe",
    event_type: "refund.created",
    occurred_at: offset(base, 2.3),
    actor: { actor_type: "system", actor_id: "stripe" },
    payload: { refund_id: "re_9xPqW2a", amount: 4500, status: "succeeded" },
  },
  {
    event_id: e.agentConfirmation,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 3),
    actor: { actor_type: "agent", actor_id: "agent_refund", name: "Refund Processing Agent" },
    message: "Your refund of $45.00 for order #ORD-7201 has been processed. It should appear in your account within 5-10 business days. Is there anything else I can help with?",
  },
  {
    event_id: e.customerThanks,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 4),
    actor: { actor_type: "customer", actor_id: "cust_320", name: "Elena Rossi" },
    message: "That was quick, thanks!",
  },
];

const autoAudit: AutoActionAudit = {
  action_annotations: [
    {
      event_id: e.agentGreeting,
      verdict: "partial",
      reasoning: "Greeting is empathetic but the agent should have initiated identity verification before any order interaction.",
      should_have_done: "Run identity verification via intercom action.identity_verification before retrieving the charge.",
      instruction_violations: [
        {
          instruction_id: "R1",
          instruction_text: "Verify customer identity before processing any refund or accessing account details.",
          violation_description: "Agent proceeded to retrieve charge data without first confirming the customer's identity.",
          context_evidence: "missing_fields includes identity_confirmed",
        },
      ],
    },
    {
      event_id: e.chargeRetrieve,
      verdict: "partial",
      reasoning: "Charge retrieval is a valid step but happened before identity verification, violating the expected transition order.",
      should_have_done: "Complete identity verification first, then retrieve the charge.",
    },
    {
      event_id: e.refundCreate,
      verdict: "incorrect",
      reasoning: "Refund issued without identity verification and without an explicit eligibility check step. The agent skipped two required workflow transitions: verify_identity and check_eligibility.",
      should_have_done: "Verify identity, then check eligibility via the eligibility API, then create the refund only if both pass.",
      instruction_violations: [
        {
          instruction_id: "R1",
          instruction_text: "Verify customer identity before processing any refund or accessing account details.",
          violation_description: "No identity verification event exists in the trace. The agent went directly from charge retrieval to refund creation.",
          context_evidence: "identity_confirmed is absent from agent context fields",
        },
      ],
      context_violations: [
        {
          type: "missing_field",
          field: "identity_confirmed",
          description: "Identity verification was never performed; identity_confirmed is missing from the agent context.",
          severity: "warning",
        },
      ],
    },
    {
      event_id: e.agentConfirmation,
      verdict: "partial",
      reasoning: "The confirmation message is clear and professional but the refund it references should not have been issued yet.",
    },
  ],
  overall_score: 2,
  critical_errors: [
    "Identity verification step was entirely skipped — agent processed refund for an unverified customer.",
    "Eligibility check step was skipped — agent jumped from charge retrieval directly to refund creation.",
  ],
  correction_summary:
    "The expected workflow is receive_request → verify_identity → retrieve_order → check_eligibility → process_refund. This agent performed receive_request → retrieve_order → process_refund, omitting two mandatory steps. Identity must be confirmed before any account access, and eligibility must be checked before any refund.",
  summary:
    "High transition deviation detected: agent skipped identity verification and eligibility check, processing a refund for an unverified customer. The refund amount and communication were correct, but the workflow shortcut poses a security risk.",
  confidence: 0.31,
  ood_score: {
    transition_deviation: 0.82,
    tool_frequency_deviation: 0.15,
    temporal_deviation: 0.12,
    embedding_distance: 0.2,
    composite_score: 0.65,
    flagged: true,
  },
  context_integrity: {
    violations: [
      {
        type: "missing_field",
        field: "identity_confirmed",
        description: "Identity verification was never performed; the field is absent from agent context.",
        severity: "warning",
      },
    ],
    passed: false,
  },
  instruction_violations_summary: [
    {
      instruction_id: "R1",
      instruction_text: "Verify customer identity before processing any refund or accessing account details.",
      violation_description: "No identity verification event exists anywhere in the trace. The agent skipped this mandatory step entirely.",
    },
  ],
};

export const trace: Trace = buildTrace({
  conversationId: "conv_refund_7201",
  agentId: "agent_refund",
  agentContext,
  events,
  status: "auto_labeled",
  autoAudit,
  confidence: 0.31,
});
