/* ------------------------------------------------------------------ */
/*  AI Agent profiles                                                  */
/*  Each profile defines an AI assistant's workflow, numbered SOP      */
/*  instructions, required context fields, and available tools.        */
/* ------------------------------------------------------------------ */

import type { AgentProfile } from "./types";

export const AGENT_PROFILES: Record<string, AgentProfile> = {
  /* ---------------------------------------------------------------- */
  /*  Refund Processing Agent                                          */
  /* ---------------------------------------------------------------- */
  agent_refund: {
    id: "agent_refund",
    name: "Refund Processing Agent",
    workflow_type: "refund_request",
    description:
      "Handles refund requests end-to-end: verifies identity, checks eligibility, validates amounts, enforces authorization limits, and confirms with the customer.",
    instructions: [
      {
        id: "R1",
        text: "Verify customer identity before processing any refund",
        category: "verification",
      },
      {
        id: "R2",
        text: "Retrieve the original order and charge from Stripe using the order ID",
        category: "data_retrieval",
      },
      {
        id: "R3",
        text: "Check refund eligibility: order must be within the 30-day return window and item unused",
        category: "policy",
      },
      {
        id: "R4",
        text: "Verify the refund amount matches the eligibility check result exactly",
        category: "validation",
      },
      {
        id: "R5",
        text: "Refunds over $200 require manager approval via Slack escalation before processing",
        category: "authorization",
      },
      {
        id: "R6",
        text: "Process refund through Stripe only after all validations pass",
        category: "execution",
      },
      {
        id: "R7",
        text: "Confirm refund details (amount, timeline) with the customer before closing",
        category: "communication",
      },
      {
        id: "R8",
        text: "Log refund reason and resolution in the conversation notes",
        category: "documentation",
      },
    ],
    required_context_fields: [
      {
        field: "order_id",
        description: "The order being refunded",
        source: "customer_request",
      },
      {
        field: "customer_id",
        description: "Verified customer identity",
        source: "intercom",
      },
      {
        field: "charge_id",
        description: "Stripe charge ID for the order",
        source: "stripe",
      },
      {
        field: "refund_amount",
        description: "Dollar amount to refund",
        source: "stripe",
      },
      {
        field: "eligibility_result",
        description: "Whether the order qualifies for refund",
        source: "policy_engine",
      },
      {
        field: "policy_version",
        description: "Active refund policy version",
        source: "policy_engine",
      },
      {
        field: "identity_confirmed",
        description: "Whether identity verification passed",
        source: "verification_service",
      },
    ],
    tools_available: [
      "stripe.charge.retrieve",
      "stripe.refund.create",
      "slack.message.send",
      "intercom.message.send",
      "policy.check_eligibility",
    ],
  },

  /* ---------------------------------------------------------------- */
  /*  Order Support Agent                                              */
  /* ---------------------------------------------------------------- */
  agent_order: {
    id: "agent_order",
    name: "Order Support Agent",
    workflow_type: "order_issue",
    description:
      "Resolves order problems including wrong items, damaged goods, and shipping delays. Retrieves order data, verifies claims, and initiates appropriate resolution.",
    instructions: [
      {
        id: "R1",
        text: "Retrieve full order details from Stripe before responding to the customer",
        category: "data_retrieval",
      },
      {
        id: "R2",
        text: "Verify the customer's claim against the actual order records (items, quantities, shipping address)",
        category: "verification",
      },
      {
        id: "R3",
        text: "For wrong-item shipments confirmed as company error, offer expedited reship immediately without requiring escalation",
        category: "resolution",
      },
      {
        id: "R4",
        text: "Initiate resolution within 10 minutes of first customer message",
        category: "sla",
      },
      {
        id: "R5",
        text: "If replacement shipment is needed, use 2-day or overnight shipping for company errors",
        category: "resolution",
      },
      {
        id: "R6",
        text: "Send return label to customer email when a return is required",
        category: "execution",
      },
      {
        id: "R7",
        text: "Confirm resolution details and expected timeline with the customer",
        category: "communication",
      },
    ],
    required_context_fields: [
      {
        field: "order_id",
        description: "Order number from the customer",
        source: "customer_request",
      },
      {
        field: "customer_id",
        description: "Customer account identifier",
        source: "intercom",
      },
      {
        field: "order_items",
        description: "Ordered items with SKUs and descriptions",
        source: "stripe",
      },
      {
        field: "shipping_status",
        description: "Current shipping/tracking status",
        source: "shipping_provider",
      },
      {
        field: "order_total",
        description: "Total order amount",
        source: "stripe",
      },
    ],
    tools_available: [
      "stripe.charge.retrieve",
      "shipping.status.get",
      "shipping.label.create",
      "slack.message.send",
      "intercom.message.send",
    ],
  },

  /* ---------------------------------------------------------------- */
  /*  Billing Agent                                                    */
  /* ---------------------------------------------------------------- */
  agent_billing: {
    id: "agent_billing",
    name: "Billing Agent",
    workflow_type: "billing_inquiry",
    description:
      "Handles billing inquiries: duplicate charges, subscription changes, invoice disputes. Retrieves charge history, verifies discrepancies, and processes corrections.",
    instructions: [
      {
        id: "R1",
        text: "Retrieve the full charge history for the customer's billing period before responding",
        category: "data_retrieval",
      },
      {
        id: "R2",
        text: "Verify duplicate charges by comparing charge IDs, amounts, and timestamps",
        category: "verification",
      },
      {
        id: "R3",
        text: "When a duplicate charge is confirmed, refund the duplicate immediately",
        category: "execution",
      },
      {
        id: "R4",
        text: "Flag the root cause of any billing anomaly to the engineering team via Slack",
        category: "escalation",
      },
      {
        id: "R5",
        text: "For subscription changes, explain prorated billing before processing",
        category: "communication",
      },
      {
        id: "R6",
        text: "Confirm the correction and provide expected timeline for statement credit",
        category: "communication",
      },
    ],
    required_context_fields: [
      {
        field: "customer_id",
        description: "Customer account identifier",
        source: "intercom",
      },
      {
        field: "charge_ids",
        description: "Relevant Stripe charge IDs",
        source: "stripe",
      },
      {
        field: "subscription_id",
        description: "Active subscription ID if applicable",
        source: "stripe",
      },
      {
        field: "billing_period",
        description: "Billing period in question",
        source: "stripe",
      },
    ],
    tools_available: [
      "stripe.charge.list",
      "stripe.charge.retrieve",
      "stripe.refund.create",
      "stripe.subscription.retrieve",
      "slack.message.send",
      "intercom.message.send",
    ],
  },

  /* ---------------------------------------------------------------- */
  /*  Escalation Agent                                                 */
  /* ---------------------------------------------------------------- */
  agent_escalation: {
    id: "agent_escalation",
    name: "Escalation Agent",
    workflow_type: "escalation",
    description:
      "Manages high-priority and VIP customer issues. Assesses severity, checks customer tier, engages senior leadership, and provides concrete action plans.",
    instructions: [
      {
        id: "R1",
        text: "Assess severity level based on customer tier, revenue impact, and issue recurrence",
        category: "triage",
      },
      {
        id: "R2",
        text: "Retrieve customer tier and ARR from the account system before responding",
        category: "data_retrieval",
      },
      {
        id: "R3",
        text: "For enterprise customers (ARR > $10K), engage a senior leader immediately — do not attempt first response with generic empathy",
        category: "policy",
      },
      {
        id: "R4",
        text: "Acknowledge specific business impact described by the customer, including revenue losses or deadlines",
        category: "communication",
      },
      {
        id: "R5",
        text: "Provide a concrete action plan with timeline, not just acknowledgment",
        category: "resolution",
      },
      {
        id: "R6",
        text: "Apply SLA credits automatically when SLA terms are violated",
        category: "execution",
      },
      {
        id: "R7",
        text: "Schedule a follow-up call with engineering for infrastructure-related issues",
        category: "resolution",
      },
    ],
    required_context_fields: [
      {
        field: "customer_id",
        description: "Customer account identifier",
        source: "intercom",
      },
      {
        field: "customer_tier",
        description: "Customer plan tier (starter/pro/enterprise)",
        source: "account_system",
      },
      {
        field: "arr_value",
        description: "Annual recurring revenue for this customer",
        source: "account_system",
      },
      {
        field: "incident_history",
        description: "Prior incidents for this customer in the last 90 days",
        source: "incident_tracker",
      },
      {
        field: "sla_terms",
        description: "Applicable SLA uptime and response time guarantees",
        source: "contract_system",
      },
    ],
    tools_available: [
      "account.retrieve",
      "incident.history.get",
      "sla.credit.apply",
      "slack.message.send",
      "intercom.message.send",
      "calendar.schedule",
    ],
  },

  /* ---------------------------------------------------------------- */
  /*  General Support Agent                                            */
  /* ---------------------------------------------------------------- */
  agent_general: {
    id: "agent_general",
    name: "General Support Agent",
    workflow_type: "general_inquiry",
    description:
      "Handles FAQs, feature requests, onboarding help, and account issues. Identifies request type, provides accurate information, and logs feedback.",
    instructions: [
      {
        id: "R1",
        text: "Identify the request type (FAQ, feature request, onboarding, account issue) before responding",
        category: "triage",
      },
      {
        id: "R2",
        text: "Provide accurate policy information from the current knowledge base",
        category: "communication",
      },
      {
        id: "R3",
        text: "For feature requests, log the vote and provide roadmap timeline if available",
        category: "documentation",
      },
      {
        id: "R4",
        text: "Offer interim workarounds when a requested feature is not yet available",
        category: "resolution",
      },
      {
        id: "R5",
        text: "For technical issues, gather reproduction steps before escalating to engineering",
        category: "triage",
      },
      {
        id: "R6",
        text: "Close conversations only after confirming the customer's question is fully resolved",
        category: "communication",
      },
    ],
    required_context_fields: [
      {
        field: "customer_id",
        description: "Customer account identifier",
        source: "intercom",
      },
      {
        field: "request_type",
        description: "Classified type of the incoming request",
        source: "classifier",
      },
    ],
    tools_available: [
      "knowledge_base.search",
      "feature_tracker.log_vote",
      "slack.message.send",
      "intercom.message.send",
    ],
  },
};

export function getAgentProfile(id: string): AgentProfile | undefined {
  return AGENT_PROFILES[id];
}

export function getAllAgentProfiles(): AgentProfile[] {
  return Object.values(AGENT_PROFILES);
}
