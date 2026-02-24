import type { Trace, TraceEvent, AgentContextSnapshot, AutoActionAudit, HumanActionAudit } from "../types";
import { eid, offset, buildTrace } from "./_helpers";

const base = new Date("2026-02-21T09:15:00Z");

const agentContext: AgentContextSnapshot = {
  fields: {
    customer_id: "cust_830",
    request_type: "faq",
  },
  missing_fields: [],
  stale_fields: [],
};

const e = {
  customerQuestion: eid(),
  agentResponse: eid(),
  agentFollowUp: eid(),
  customerReply: eid(),
  agentClose: eid(),
  conversationClosed: eid(),
};

const events: TraceEvent[] = [
  {
    event_id: e.customerQuestion,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 0),
    actor: { actor_type: "customer", actor_id: "cust_830", name: "Lena Virtanen" },
    message: "Hi, can you tell me about your return policy? I want to know how long I have to return something.",
  },
  {
    event_id: e.agentResponse,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 1),
    actor: { actor_type: "agent", actor_id: "agent_general", name: "General Support Agent" },
    message: "Hi Lena! Happy to help with that. Our standard return policy allows returns within 30 days of purchase for a full refund, as long as the item is in its original condition. For electronics and seasonal items, we offer an extended 60-day return window. Refunds are processed back to the original payment method within 5-10 business days after we receive the return.",
  },
  {
    event_id: e.agentFollowUp,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 1.5),
    actor: { actor_type: "agent", actor_id: "agent_general", name: "General Support Agent" },
    message: "Is there a specific item you're considering returning? I can check whether it qualifies for the standard or extended window.",
  },
  {
    event_id: e.customerReply,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 3),
    actor: { actor_type: "customer", actor_id: "cust_830", name: "Lena Virtanen" },
    message: "No, I was just curious for future reference. That covers everything I needed. Thanks!",
  },
  {
    event_id: e.agentClose,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 3.5),
    actor: { actor_type: "agent", actor_id: "agent_general", name: "General Support Agent" },
    message: "You're welcome, Lena! Feel free to reach out anytime if you have more questions. Have a great day!",
  },
  {
    event_id: e.conversationClosed,
    source: "intercom",
    event_type: "conversation.closed",
    occurred_at: offset(base, 4),
    actor: { actor_type: "system", actor_id: "intercom" },
    payload: { reason: "resolved", resolution_time_minutes: 4 },
  },
];

const autoAudit: AutoActionAudit = {
  action_annotations: [
    {
      event_id: e.agentResponse,
      verdict: "correct",
      reasoning: "Comprehensive policy answer covering standard 30-day and extended 60-day windows with refund timeline.",
    },
    {
      event_id: e.agentFollowUp,
      verdict: "correct",
      reasoning: "Proactively offered to check eligibility for a specific item.",
    },
    {
      event_id: e.agentClose,
      verdict: "correct",
      reasoning: "Polite closing with open invitation for future questions.",
    },
  ],
  overall_score: 5,
  critical_errors: [],
  correction_summary: "No corrections needed. FAQ answered accurately with proactive follow-up.",
  summary: "Agent provided a thorough and accurate return policy explanation covering both standard and extended windows, proactively offered item-specific assistance, and closed the conversation professionally.",
  confidence: 0.95,
  ood_score: {
    transition_deviation: 0.01,
    tool_frequency_deviation: 0.02,
    temporal_deviation: 0.01,
    embedding_distance: 0.03,
    composite_score: 0.03,
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
    { event_id: e.agentResponse, verdict: "correct" },
    { event_id: e.agentFollowUp, verdict: "correct" },
    { event_id: e.agentClose, verdict: "correct" },
  ],
  overall_score: 5,
  critical_errors: [],
  correction_summary: "Perfect FAQ handling with thorough policy explanation.",
  notes: "Textbook FAQ response. Proactively asked about specific items.",
};

export const trace: Trace = buildTrace({
  conversationId: "conv_faq_830",
  agentId: "agent_general",
  agentContext,
  events,
  status: "labeled",
  autoAudit,
  confidence: 0.95,
  humanAudit,
});
