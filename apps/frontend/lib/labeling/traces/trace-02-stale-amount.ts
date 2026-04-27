import type {
  Trace,
  TraceEvent,
  AgentContextSnapshot,
  AutoActionAudit,
} from "../types";
import { eid, offset, buildTrace } from "./_helpers";

const base = new Date("2026-02-20T09:15:00Z");

const agentContext: AgentContextSnapshot = {
  fields: {
    customer_id: "cus_LmW4rTzH8p",
    customer_name: "James Mitchell",
    customer_email: "j.mitchell@example.com",
    order_id: "ORD-7821",
    charge_id: "ch_Nk9pQxT4Rv",
    refund_amount: 5998,
    eligibility_result: { eligible: true, approved_amount: 5998 },
    identity_confirmed: true,
    policy_version: "v2.3",
  },
  missing_fields: [],
  stale_fields: [
    {
      field: "refund_amount",
      value_in_context: 5998,
      correct_value: 2999,
      source: "policy_engine",
    },
  ],
};

const e = {
  customerMessage: eid(),
  agentGreeting: eid(),
  chargeRetrieve: eid(),
  chargeResult: eid(),
  eligibilityCheck: eid(),
  eligibilityResult: eid(),
  agentAmountConfirm: eid(),
  refundCreate: eid(),
  refundResult: eid(),
  agentConfirmation: eid(),
};

const events: TraceEvent[] = [
  {
    event_id: e.customerMessage,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 0),
    actor: {
      actor_type: "customer",
      actor_id: "cus_LmW4rTzH8p",
      name: "James Mitchell",
    },
    message:
      "Hi, I've been charged $59.98 for my monthly subscription but my plan is only $29.99/month. Looks like I was double-charged. Can I get a refund for the overcharge?",
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
      "Hello James! I'm sorry about the billing issue. Let me pull up your recent charges and look into this right away.",
  },
  {
    event_id: e.chargeRetrieve,
    source: "stripe",
    event_type: "charge.retrieve",
    occurred_at: offset(base, 1.5),
    actor: {
      actor_type: "agent",
      actor_id: "agent_refund",
      name: "Refund Agent",
    },
    payload: { charge_id: "ch_Nk9pQxT4Rv", customer_id: "cus_LmW4rTzH8p" },
  },
  {
    event_id: e.chargeResult,
    source: "stripe",
    event_type: "charge.retrieved",
    occurred_at: offset(base, 2),
    actor: { actor_type: "system", actor_id: "stripe" },
    payload: {
      charge_id: "ch_Nk9pQxT4Rv",
      amount: 5998,
      currency: "usd",
      description: "Monthly subscription — Pro Plan",
      created: "2026-02-15T00:00:00Z",
    },
  },
  {
    event_id: e.eligibilityCheck,
    source: "stripe",
    event_type: "action.eligibility_check",
    occurred_at: offset(base, 2.5),
    actor: {
      actor_type: "agent",
      actor_id: "agent_refund",
      name: "Refund Agent",
    },
    payload: {
      charge_id: "ch_Nk9pQxT4Rv",
      reason: "overcharge",
      customer_id: "cus_LmW4rTzH8p",
    },
  },
  {
    event_id: e.eligibilityResult,
    source: "stripe",
    event_type: "eligibility.result",
    occurred_at: offset(base, 3),
    actor: { actor_type: "system", actor_id: "policy_engine" },
    payload: {
      eligible: true,
      approved_amount: 2999,
      reason:
        "Partial refund — difference between charged amount and correct plan price.",
      policy_version: "v2.3",
    },
  },
  {
    event_id: e.agentAmountConfirm,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 3.5),
    actor: {
      actor_type: "agent",
      actor_id: "agent_refund",
      name: "Refund Agent",
    },
    message:
      "I've confirmed the overcharge on your account. I'm processing a refund of $59.98 back to your payment method now.",
  },
  {
    event_id: e.refundCreate,
    source: "stripe",
    event_type: "refund.create",
    occurred_at: offset(base, 4),
    actor: {
      actor_type: "agent",
      actor_id: "agent_refund",
      name: "Refund Agent",
    },
    payload: {
      charge_id: "ch_Nk9pQxT4Rv",
      amount: 5998,
      currency: "usd",
      reason: "subscription_overcharge",
    },
  },
  {
    event_id: e.refundResult,
    source: "stripe",
    event_type: "refund.created",
    occurred_at: offset(base, 4.5),
    actor: { actor_type: "system", actor_id: "stripe" },
    payload: { refund_id: "re_Vp7kRm3xQ", amount: 5998, status: "succeeded" },
  },
  {
    event_id: e.agentConfirmation,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 5),
    actor: {
      actor_type: "agent",
      actor_id: "agent_refund",
      name: "Refund Agent",
    },
    message:
      "All done! Your refund of $59.98 has been processed. It should appear on your statement within 5-10 business days. Let me know if there's anything else I can help with!",
  },
];

const autoAudit: AutoActionAudit = {
  action_annotations: [
    {
      event_id: e.agentGreeting,
      verdict: "correct",
      reasoning:
        "Appropriate empathetic response and clear next-step communication.",
    },
    {
      event_id: e.chargeRetrieve,
      verdict: "correct",
      reasoning: "Agent correctly retrieved the charge details from Stripe.",
    },
    {
      event_id: e.eligibilityCheck,
      verdict: "correct",
      reasoning:
        "Eligibility check was initiated before processing the refund.",
    },
    {
      event_id: e.agentAmountConfirm,
      verdict: "incorrect",
      reasoning:
        "Agent told the customer $59.98 would be refunded, but the eligibility check only approved $29.99. The agent used the stale cached amount instead of the freshly returned value.",
      should_have_done:
        "Confirm the approved refund amount of $29.99 from the eligibility result, not the full charge amount.",
      context_violations: [
        {
          type: "stale_value",
          field: "refund_amount",
          description:
            "Agent context contains refund_amount=5998, but the eligibility check returned approved_amount=2999.",
          expected: 2999,
          actual: 5998,
          severity: "critical",
        },
      ],
    },
    {
      event_id: e.refundCreate,
      verdict: "incorrect",
      reasoning:
        "Refund was created for $59.98 (the full charge) instead of the approved $29.99. This results in a $29.99 overpayment to the customer.",
      should_have_done:
        "Issue refund for $29.99 as returned by the eligibility check.",
      instruction_violations: [
        {
          instruction_id: "R4",
          instruction_text:
            "Always verify the refund amount matches the approved amount from the eligibility check before processing.",
          violation_description:
            "Agent issued refund for 5998 but eligibility approved only 2999. The stale context value was used instead of the live eligibility result.",
          context_evidence:
            "stale_fields: refund_amount (context: 5998, correct: 2999, source: policy_engine)",
        },
      ],
      context_violations: [
        {
          type: "stale_value",
          field: "refund_amount",
          description:
            "Refund processed at stale amount $59.98 instead of approved $29.99.",
          expected: 2999,
          actual: 5998,
          severity: "critical",
        },
      ],
    },
    {
      event_id: e.agentConfirmation,
      verdict: "incorrect",
      reasoning:
        "Confirmed the incorrect refund amount of $59.98 to the customer.",
      should_have_done: "Should have confirmed $29.99 as the refund amount.",
    },
  ],
  overall_score: 2,
  critical_errors: [
    "Refund issued for $59.98 instead of the approved $29.99 — customer overpaid by $29.99.",
    "Agent relied on stale cached refund_amount instead of the live eligibility result.",
  ],
  correction_summary:
    "The agent must read the approved_amount from the eligibility result and use that value for the refund. The stale refund_amount in the agent context (from an earlier cached lookup) should have been overwritten by the eligibility result before processing.",
  summary:
    "Agent followed the correct workflow steps — charge retrieval, eligibility check, refund — but used a stale refund_amount from its context ($59.98) instead of the approved amount returned by the eligibility check ($29.99). This led to a refund that was double the correct value.",
  confidence: 0.28,
  ood_score: {
    transition_deviation: 0.09,
    tool_frequency_deviation: 0.12,
    temporal_deviation: 0.21,
    embedding_distance: 0.16,
    composite_score: 0.18,
    flagged: false,
  },
  context_integrity: {
    violations: [
      {
        type: "stale_value",
        field: "refund_amount",
        description:
          "Agent context has refund_amount=5998 from an older cached check, but the latest eligibility result approved only 2999.",
        expected: 2999,
        actual: 5998,
        severity: "critical",
      },
    ],
    passed: false,
  },
  instruction_violations_summary: [
    {
      instruction_id: "R4",
      instruction_text:
        "Always verify the refund amount matches the approved amount from the eligibility check before processing.",
      violation_description:
        "Agent processed refund for 5998 instead of the eligibility-approved amount of 2999.",
    },
  ],
};

export const trace: Trace = buildTrace({
  conversationId: "conv_refund_7821",
  agentId: "agent_refund",
  agentContext,
  events,
  status: "auto_labeled",
  autoAudit,
  confidence: 0.28,
});
