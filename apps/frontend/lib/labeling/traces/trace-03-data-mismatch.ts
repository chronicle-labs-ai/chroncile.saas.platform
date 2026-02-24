import type { Trace, TraceEvent, AgentContextSnapshot, AutoActionAudit } from "../types";
import { eid, offset, buildTrace } from "./_helpers";

const base = new Date("2026-02-22T16:45:00Z");

const agentContext: AgentContextSnapshot = {
  fields: {
    customer_id: "cus_Jf6nYrKd2w",
    customer_name: "Aisha Kone",
    customer_email: "aisha.kone@example.com",
    order_id: "ORD-4582",
    order_items: [{ sku: "VASE-RED", description: "Red Ceramic Vase", quantity: 1, unit_price: 8999 }],
    shipping_status: "delivered",
    order_total: 8999,
    delivery_date: "2026-02-19",
  },
  missing_fields: [],
  stale_fields: [
    {
      field: "order_items",
      value_in_context: [{ sku: "VASE-RED", description: "Red Ceramic Vase" }],
      correct_value: [{ sku: "VASE-BLU", description: "Blue Ceramic Vase" }],
      source: "stripe",
    },
  ],
};

const e = {
  customerMessage: eid(),
  agentGreeting: eid(),
  orderRetrieve: eid(),
  orderResult: eid(),
  agentDenial: eid(),
  customerPushback: eid(),
  agentSecondLook: eid(),
  customerFrustration: eid(),
  slackEscalation: eid(),
  agentHandoff: eid(),
};

const events: TraceEvent[] = [
  {
    event_id: e.customerMessage,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 0),
    actor: { actor_type: "customer", actor_id: "cus_Jf6nYrKd2w", name: "Aisha Kone" },
    message: "Hello, I ordered a blue ceramic vase but I received a red one instead. My order number is ORD-4582. Can you help me sort this out?",
  },
  {
    event_id: e.agentGreeting,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 1),
    actor: { actor_type: "agent", actor_id: "agent_order", name: "Order Support Agent" },
    message: "Hi Aisha! I'm sorry to hear there's an issue with your order. Let me pull up the details for ORD-4582 right now.",
  },
  {
    event_id: e.orderRetrieve,
    source: "stripe",
    event_type: "order.retrieve",
    occurred_at: offset(base, 1.5),
    actor: { actor_type: "agent", actor_id: "agent_order", name: "Order Support Agent" },
    payload: { order_id: "ORD-4582", customer_id: "cus_Jf6nYrKd2w" },
  },
  {
    event_id: e.orderResult,
    source: "stripe",
    event_type: "order.retrieved",
    occurred_at: offset(base, 2),
    actor: { actor_type: "system", actor_id: "stripe" },
    payload: {
      order_id: "ORD-4582",
      items: [{ sku: "VASE-BLU", description: "Blue Ceramic Vase", quantity: 1, unit_price: 8999 }],
      shipping_status: "delivered",
      total: 8999,
      created: "2026-02-14T10:30:00Z",
    },
  },
  {
    event_id: e.agentDenial,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 3),
    actor: { actor_type: "agent", actor_id: "agent_order", name: "Order Support Agent" },
    message: "I've checked your order and according to our records, order ORD-4582 contains a Red Ceramic Vase (SKU: VASE-RED), which matches what was delivered. It looks like the correct item was shipped to you.",
  },
  {
    event_id: e.customerPushback,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 5),
    actor: { actor_type: "customer", actor_id: "cus_Jf6nYrKd2w", name: "Aisha Kone" },
    message: "That's not right. I specifically ordered a BLUE vase. I still have the confirmation email showing \"Blue Ceramic Vase\". Can you check again?",
  },
  {
    event_id: e.agentSecondLook,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 6),
    actor: { actor_type: "agent", actor_id: "agent_order", name: "Order Support Agent" },
    message: "I understand your frustration. I've double-checked and our system shows the Red Ceramic Vase for this order. However, I want to make sure we get this resolved properly for you. Let me escalate this to our fulfillment team so they can investigate further.",
  },
  {
    event_id: e.customerFrustration,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 7),
    actor: { actor_type: "customer", actor_id: "cus_Jf6nYrKd2w", name: "Aisha Kone" },
    message: "Yes, please do. This is clearly a mistake on your end.",
  },
  {
    event_id: e.slackEscalation,
    source: "slack",
    event_type: "message.sent",
    occurred_at: offset(base, 8),
    actor: { actor_type: "agent", actor_id: "agent_order", name: "Order Support Agent" },
    payload: {
      channel: "#fulfillment-escalations",
      text: "Escalation for ORD-4582: Customer Aisha Kone reports receiving Red Ceramic Vase but claims she ordered Blue. System shows Red Ceramic Vase (VASE-RED) for this order. Customer has confirmation email for Blue. Please investigate warehouse records.",
    },
  },
  {
    event_id: e.agentHandoff,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 9),
    actor: { actor_type: "agent", actor_id: "agent_order", name: "Order Support Agent" },
    message: "I've escalated this to our fulfillment team in a priority queue. They'll investigate the warehouse records and get back to you within 24 hours. I apologize for the inconvenience, Aisha.",
  },
];

const autoAudit: AutoActionAudit = {
  action_annotations: [
    {
      event_id: e.agentGreeting,
      verdict: "correct",
      reasoning: "Appropriate greeting with empathy and clear intent to investigate.",
    },
    {
      event_id: e.orderRetrieve,
      verdict: "correct",
      reasoning: "Agent correctly initiated an order lookup from Stripe.",
    },
    {
      event_id: e.agentDenial,
      verdict: "incorrect",
      reasoning: "Agent told the customer the order was for a Red Ceramic Vase, but the Stripe order.retrieved response clearly shows VASE-BLU (Blue Ceramic Vase). The agent used stale/incorrect context data instead of the live response.",
      should_have_done: "Read the order.retrieved payload which shows VASE-BLU and acknowledge the customer's claim is correct — the wrong item was shipped.",
      instruction_violations: [
        {
          instruction_id: "R2",
          instruction_text: "Verify the customer's claim against the actual order records returned from the source system.",
          violation_description: "Agent relied on its cached order_items (VASE-RED) instead of the Stripe response payload which contained VASE-BLU. The claim was valid but the agent denied it.",
          context_evidence: "order.retrieved payload shows sku: VASE-BLU; agent context has sku: VASE-RED",
        },
      ],
      context_violations: [
        {
          type: "data_mismatch",
          field: "order_items",
          description: "Agent context has order_items with SKU VASE-RED, but the Stripe order record returned VASE-BLU.",
          expected: [{ sku: "VASE-BLU", description: "Blue Ceramic Vase" }],
          actual: [{ sku: "VASE-RED", description: "Red Ceramic Vase" }],
          severity: "critical",
        },
      ],
    },
    {
      event_id: e.agentSecondLook,
      verdict: "partial",
      reasoning: "Agent escalated which was appropriate given the dispute, but continued to assert the Red Vase was correct. Should have recognized the data mismatch from the Stripe response.",
      should_have_done: "Acknowledge the Stripe order record shows Blue Ceramic Vase, confirm the customer is correct, and initiate a return/replacement flow.",
    },
    {
      event_id: e.slackEscalation,
      verdict: "partial",
      reasoning: "Escalation was appropriate but the message frames the customer's claim as uncertain when the Stripe data supports it. The escalation note should have flagged the context mismatch.",
      should_have_done: "Note in the escalation that the Stripe order record shows VASE-BLU but the agent context had VASE-RED, indicating a data integrity issue.",
    },
    {
      event_id: e.agentHandoff,
      verdict: "partial",
      reasoning: "Handoff message is polite but doesn't resolve the customer's immediate concern. Agent could have offered a replacement or refund alongside the escalation.",
    },
  ],
  overall_score: 1,
  critical_errors: [
    "Agent denied a valid customer claim by using stale context data instead of the live Stripe order record.",
    "The Stripe response showed VASE-BLU but agent context contained VASE-RED — agent trusted its context over the source system.",
  ],
  correction_summary: "The agent must use the order data returned by the source system (Stripe) rather than its cached context. When the order.retrieved payload shows VASE-BLU, the agent should acknowledge the customer ordered a blue vase and that a red one was shipped in error, then initiate the appropriate resolution.",
  summary: "The agent's context contained incorrect order item data (VASE-RED) that didn't match the Stripe order record (VASE-BLU). The agent trusted its stale context over the live data, incorrectly denied the customer's valid claim, and escalated the issue framing the customer as potentially wrong. The customer was right all along.",
  confidence: 0.19,
  ood_score: {
    transition_deviation: 0.07,
    tool_frequency_deviation: 0.10,
    temporal_deviation: 0.14,
    embedding_distance: 0.11,
    composite_score: 0.12,
    flagged: false,
  },
  context_integrity: {
    violations: [
      {
        type: "data_mismatch",
        field: "order_items",
        description: "Agent context has order_items=[{sku: VASE-RED}] but the Stripe order record returned [{sku: VASE-BLU, description: Blue Ceramic Vase}]. The context reflects what was shipped, not what was ordered.",
        expected: [{ sku: "VASE-BLU", description: "Blue Ceramic Vase" }],
        actual: [{ sku: "VASE-RED", description: "Red Ceramic Vase" }],
        severity: "critical",
      },
    ],
    passed: false,
  },
  instruction_violations_summary: [
    {
      instruction_id: "R2",
      instruction_text: "Verify the customer's claim against the actual order records returned from the source system.",
      violation_description: "Agent used cached order_items (VASE-RED) instead of the live Stripe response (VASE-BLU), denying a valid customer claim.",
    },
  ],
};

export const trace: Trace = buildTrace({
  conversationId: "conv_order_4582",
  agentId: "agent_order",
  agentContext,
  events,
  status: "auto_labeled",
  autoAudit,
  confidence: 0.19,
});
