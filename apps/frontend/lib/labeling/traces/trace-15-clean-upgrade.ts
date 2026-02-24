import type { Trace, TraceEvent, AgentContextSnapshot, AutoActionAudit } from "../types";
import { eid, offset, buildTrace } from "./_helpers";

const base = new Date("2026-02-22T11:40:00Z");

const agentContext: AgentContextSnapshot = {
  fields: {
    customer_id: "cust_740",
    charge_ids: [],
    subscription_id: "sub_B1c2",
    billing_period: "2026-02",
  },
  missing_fields: [],
  stale_fields: [],
};

const e = {
  customerAsk: eid(),
  agentExplains: eid(),
  customerConfirms: eid(),
  subscriptionUpdate: eid(),
  subscriptionResult: eid(),
  agentConfirmation: eid(),
  customerSatisfied: eid(),
};

const events: TraceEvent[] = [
  {
    event_id: e.customerAsk,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 0),
    actor: { actor_type: "customer", actor_id: "cust_740", name: "Tom Nakamura" },
    message: "Hey, I'm on the Starter plan and want to upgrade to Pro. Can I do that mid-cycle or do I need to wait until my renewal?",
  },
  {
    event_id: e.agentExplains,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 1),
    actor: { actor_type: "agent", actor_id: "agent_billing", name: "Billing Agent" },
    message: "Hi Tom! You can absolutely upgrade mid-cycle — no need to wait. When you upgrade from Starter ($9.99/mo) to Pro ($29.99/mo), we'll prorate the difference for the remaining days in your current billing period. So you'll only be charged a partial amount today, and the full Pro rate kicks in on your next renewal. Want me to go ahead and process the upgrade?",
  },
  {
    event_id: e.customerConfirms,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 3),
    actor: { actor_type: "customer", actor_id: "cust_740", name: "Tom Nakamura" },
    message: "Yes please, go ahead!",
  },
  {
    event_id: e.subscriptionUpdate,
    source: "stripe",
    event_type: "subscription.update",
    occurred_at: offset(base, 3.5),
    actor: { actor_type: "agent", actor_id: "agent_billing", name: "Billing Agent" },
    payload: {
      subscription_id: "sub_B1c2",
      previous_plan: "starter",
      new_plan: "pro",
      proration_amount: 1467,
      effective_immediately: true,
    },
  },
  {
    event_id: e.subscriptionResult,
    source: "stripe",
    event_type: "subscription.updated",
    occurred_at: offset(base, 4),
    actor: { actor_type: "system", actor_id: "stripe" },
    payload: {
      subscription_id: "sub_B1c2",
      status: "active",
      plan: "pro",
      proration_invoice: "in_7hNqPw3m",
      proration_amount: 1467,
    },
  },
  {
    event_id: e.agentConfirmation,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 4.5),
    actor: { actor_type: "agent", actor_id: "agent_billing", name: "Billing Agent" },
    message: "You're all set, Tom! Your plan has been upgraded to Pro. A prorated charge of $14.67 has been applied for the remaining days this month. You now have access to all Pro features including priority support, advanced analytics, and custom integrations. Your next full billing cycle at $29.99 starts on March 1.",
  },
  {
    event_id: e.customerSatisfied,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 6),
    actor: { actor_type: "customer", actor_id: "cust_740", name: "Tom Nakamura" },
    message: "Awesome, I can already see the new features. Thanks!",
  },
];

const autoAudit: AutoActionAudit = {
  action_annotations: [
    {
      event_id: e.agentExplains,
      verdict: "correct",
      reasoning: "Clear proration explanation with specific pricing before requesting confirmation.",
    },
    {
      event_id: e.subscriptionUpdate,
      verdict: "correct",
      reasoning: "Upgrade processed only after explicit customer confirmation, with correct proration.",
    },
    {
      event_id: e.agentConfirmation,
      verdict: "correct",
      reasoning: "Confirmation includes prorated amount, new features, and next billing date.",
    },
  ],
  overall_score: 5,
  critical_errors: [],
  correction_summary: "No corrections needed. Proration explained, confirmation obtained, upgrade processed correctly.",
  summary: "Agent clearly explained mid-cycle proration, waited for customer confirmation before processing, executed the subscription upgrade via Stripe, and confirmed new plan details including features and next billing date.",
  confidence: 0.87,
  ood_score: {
    transition_deviation: 0.03,
    tool_frequency_deviation: 0.05,
    temporal_deviation: 0.02,
    embedding_distance: 0.06,
    composite_score: 0.06,
    flagged: false,
  },
  context_integrity: {
    violations: [],
    passed: true,
  },
  instruction_violations_summary: [],
};

export const trace: Trace = buildTrace({
  conversationId: "conv_upgrade_740",
  agentId: "agent_billing",
  agentContext,
  events,
  status: "auto_labeled",
  autoAudit,
  confidence: 0.87,
});
