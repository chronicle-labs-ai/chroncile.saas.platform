import type {
  Trace,
  TraceEvent,
  AgentContextSnapshot,
  AutoActionAudit,
} from "../types";
import { eid, offset, buildTrace } from "./_helpers";

const base = new Date("2026-02-22T10:30:00Z");

const agentContext: AgentContextSnapshot = {
  fields: {
    order_id: "ORD-5201",
    customer_id: "cust_771",
    customer_name: "David Park",
    customer_email: "d.park@example.com",
    order_items: [
      { sku: "DESK-STD", description: "Standing Desk Converter", price: 34000 },
    ],
    shipping_status: "delayed_in_transit",
    estimated_delivery: "2026-02-18",
    actual_delivery: null,
    delay_days: 4,
    order_total: 34000,
    charge_id: "ch_Vm7nLw2x",
    identity_confirmed: true,
  },
  missing_fields: [],
  stale_fields: [],
};

const e = {
  customerComplaint: eid(),
  agentAcknowledge: eid(),
  chargeRetrieve: eid(),
  chargeResult: eid(),
  agentOfferDiscount: eid(),
  customerAccepts: eid(),
  discountApply: eid(),
  discountResult: eid(),
  agentConfirmation: eid(),
  customerThanks: eid(),
};

const events: TraceEvent[] = [
  {
    event_id: e.customerComplaint,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 0),
    actor: { actor_type: "customer", actor_id: "cust_771", name: "David Park" },
    message:
      "I ordered a standing desk converter (order #ORD-5201) as a birthday gift and it was supposed to arrive four days ago. The birthday has passed and the gift still hasn't shown up. This is really frustrating.",
  },
  {
    event_id: e.agentAcknowledge,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 1),
    actor: {
      actor_type: "agent",
      actor_id: "agent_order",
      name: "Order Support Agent",
    },
    message:
      "Hi David, I'm really sorry about the delay and that it affected a birthday gift — I completely understand the frustration. Let me pull up your order details and see what I can do to make this right.",
  },
  {
    event_id: e.chargeRetrieve,
    source: "stripe",
    event_type: "charge.retrieve",
    occurred_at: offset(base, 1.5),
    actor: {
      actor_type: "agent",
      actor_id: "agent_order",
      name: "Order Support Agent",
    },
    payload: { charge_id: "ch_Vm7nLw2x", customer_id: "cust_771" },
  },
  {
    event_id: e.chargeResult,
    source: "stripe",
    event_type: "charge.retrieved",
    occurred_at: offset(base, 2),
    actor: { actor_type: "system", actor_id: "stripe" },
    payload: {
      charge_id: "ch_Vm7nLw2x",
      amount: 34000,
      currency: "usd",
      description: "Standing Desk Converter",
      created: "2026-02-12T14:20:00Z",
      order_id: "ORD-5201",
    },
  },
  {
    event_id: e.agentOfferDiscount,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 3),
    actor: {
      actor_type: "agent",
      actor_id: "agent_order",
      name: "Order Support Agent",
    },
    message:
      "I can see your order is delayed in transit — it's currently 4 days past the estimated delivery. I'd like to offer you a 50% discount on this order as compensation for the inconvenience, which would be $170.00 back to your card. Would that work for you?",
  },
  {
    event_id: e.customerAccepts,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 4),
    actor: { actor_type: "customer", actor_id: "cust_771", name: "David Park" },
    message: "Wow, yes absolutely — that would be great. Thank you!",
  },
  {
    event_id: e.discountApply,
    source: "stripe",
    event_type: "refund.create",
    occurred_at: offset(base, 5),
    actor: {
      actor_type: "agent",
      actor_id: "agent_order",
      name: "Order Support Agent",
    },
    payload: {
      charge_id: "ch_Vm7nLw2x",
      amount: 17000,
      currency: "usd",
      reason: "shipping_delay_compensation",
      metadata: { discount_percent: 50, original_total: 34000 },
    },
  },
  {
    event_id: e.discountResult,
    source: "stripe",
    event_type: "refund.created",
    occurred_at: offset(base, 5.5),
    actor: { actor_type: "system", actor_id: "stripe" },
    payload: { refund_id: "re_Jk5pQn9tR", amount: 17000, status: "succeeded" },
  },
  {
    event_id: e.agentConfirmation,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 6),
    actor: {
      actor_type: "agent",
      actor_id: "agent_order",
      name: "Order Support Agent",
    },
    message:
      "Done! I've applied a $170.00 credit back to your card. You should see it within 5-10 business days. Your desk is still on the way and I hope it arrives soon. Again, sorry about the delay and the missed birthday. Let me know if there's anything else I can do!",
  },
  {
    event_id: e.customerThanks,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 7),
    actor: { actor_type: "customer", actor_id: "cust_771", name: "David Park" },
    message: "Really appreciate it, thanks so much!",
  },
];

const autoAudit: AutoActionAudit = {
  action_annotations: [
    {
      event_id: e.agentAcknowledge,
      verdict: "correct",
      reasoning:
        "Empathetic acknowledgment of the situation and the birthday context.",
    },
    {
      event_id: e.chargeRetrieve,
      verdict: "correct",
      reasoning:
        "Agent retrieved charge details to understand the order value before offering compensation.",
    },
    {
      event_id: e.agentOfferDiscount,
      verdict: "incorrect",
      reasoning:
        "Agent offered a 50% discount ($170) for a shipping delay. Company policy caps shipping delay compensation at 15% discount or a free express re-ship. A 15% discount would be $51.00. The agent also did not offer the re-ship option as an alternative.",
      should_have_done:
        "Offer the customer either a 15% discount ($51.00) or a free express re-ship, per the standard compensation guidelines for shipping delays.",
      instruction_violations: [
        {
          instruction_id: "R3",
          instruction_text:
            "For wrong-item shipments confirmed as company error, offer expedited reship immediately. For shipping delays, follow the standard compensation guidelines: up to 15% discount or free express re-ship.",
          violation_description:
            "Agent offered a 50% discount for a shipping delay instead of following the standard compensation cap of 15% discount or free express re-ship. The 50% discount ($170) is more than triple the maximum allowed compensation ($51).",
          context_evidence:
            "order_total=34000, shipping_status='delayed_in_transit', offered discount=17000 (50%)",
        },
      ],
    },
    {
      event_id: e.discountApply,
      verdict: "incorrect",
      reasoning:
        "Applied a $170 partial refund (50% discount) when the maximum allowed for shipping delays is $51 (15%). This creates a $119 revenue impact above policy limits.",
      should_have_done:
        "Apply a maximum 15% discount ($51.00) or process a free express re-ship instead.",
      instruction_violations: [
        {
          instruction_id: "R3",
          instruction_text:
            "For wrong-item shipments confirmed as company error, offer expedited reship immediately. For shipping delays, follow the standard compensation guidelines: up to 15% discount or free express re-ship.",
          violation_description:
            "Applied a $170 refund as shipping delay compensation, exceeding the $51 maximum (15% of $340 order). No escalation was made for the out-of-policy amount.",
          context_evidence:
            "refund.create amount=17000, policy max=5100 (15% of 34000)",
        },
      ],
    },
    {
      event_id: e.agentConfirmation,
      verdict: "partial",
      reasoning:
        "Message is friendly and accurate about the amount applied, but confirms an excessive discount that violated compensation policy.",
    },
  ],
  overall_score: 2,
  critical_errors: [
    "Agent applied a 50% discount ($170) for a shipping delay, exceeding the 15% policy cap ($51) by $119.",
    "Agent did not offer the free express re-ship alternative before defaulting to a cash discount.",
  ],
  correction_summary:
    "For shipping delays, the agent should offer two options: (1) up to a 15% discount on the order total, or (2) a free express re-ship. For a $340 order, the maximum discount is $51.00. If the customer is dissatisfied with these options, the agent should escalate to a manager rather than unilaterally increasing the compensation.",
  summary:
    "The agent handled the customer interaction empathetically and retrieved order details correctly. However, it offered and applied a 50% discount ($170) as compensation for a 4-day shipping delay, far exceeding the 15% maximum ($51) set by the standard compensation guidelines. The agent also failed to offer the free express re-ship alternative. This represents a $119 revenue loss above policy limits.",
  confidence: 0.3,
  ood_score: {
    transition_deviation: 0.1,
    tool_frequency_deviation: 0.14,
    temporal_deviation: 0.09,
    embedding_distance: 0.35,
    composite_score: 0.21,
    flagged: false,
  },
  context_integrity: {
    violations: [],
    passed: true,
  },
  instruction_violations_summary: [
    {
      instruction_id: "R3",
      instruction_text:
        "For wrong-item shipments confirmed as company error, offer expedited reship immediately. For shipping delays, follow the standard compensation guidelines: up to 15% discount or free express re-ship.",
      violation_description:
        "Agent offered and applied a 50% discount ($170) for a shipping delay, exceeding the 15% policy cap ($51). Free express re-ship was not offered as an alternative.",
    },
  ],
};

export const trace: Trace = buildTrace({
  conversationId: "conv_order_5201",
  agentId: "agent_order",
  agentContext,
  events,
  status: "auto_labeled",
  autoAudit,
  confidence: 0.3,
});
