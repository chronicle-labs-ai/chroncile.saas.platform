import type {
  Trace,
  TraceEvent,
  AgentContextSnapshot,
  AutoActionAudit,
} from "../types";
import { eid, offset, buildTrace } from "./_helpers";

const base = new Date("2026-02-18T09:15:00Z");

const e1 = eid();
const e2 = eid();
const e3 = eid();
const e4 = eid();
const e5 = eid();
const e6 = eid();
const e7 = eid();
const e8 = eid();
const e9 = eid();
const e10 = eid();
const e11 = eid();

const agentContext: AgentContextSnapshot = {
  fields: {
    customer_id: "cust_001",
    customer_tier: "enterprise",
    arr_value: 50000,
    issue_type: "dashboard_data_staleness",
    incident_history: [{ date: "2026-01-15", type: "dashboard_outage" }],
  },
  missing_fields: ["sla_terms"],
  stale_fields: [],
};

const events: TraceEvent[] = [
  {
    event_id: e1,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 0),
    actor: {
      actor_type: "customer",
      actor_id: "cust_001",
      name: "Yuki Tanaka",
    },
    message:
      "Hi — our executive dashboard has been showing stale data since yesterday morning. Revenue numbers are 24 hours behind and the pipeline view isn't updating at all. This is urgent: I have a board meeting next Tuesday and I need accurate figures to present. We're on your Enterprise plan at $50K ARR and this is not the level of reliability we expected.",
  },
  {
    event_id: e2,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 3),
    actor: {
      actor_type: "agent",
      actor_id: "agent_escalation",
      name: "Escalation Agent",
    },
    message:
      "Hi Yuki, thank you for reaching out. I'm sorry to hear about the dashboard issues. I've noted the problem and will look into this with our engineering team. We'll get back to you with an update as soon as possible.",
  },
  {
    event_id: e3,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 6),
    actor: {
      actor_type: "customer",
      actor_id: "cust_001",
      name: "Yuki Tanaka",
    },
    message:
      "I appreciate that, but I want to make sure you understand the urgency here. The board meeting is next Tuesday, February 24th. I need the dashboard fully functional before then — ideally by end of day Friday so we can prepare. Can you confirm that timeline?",
  },
  {
    event_id: e4,
    source: "slack",
    event_type: "message.sent",
    occurred_at: offset(base, 10),
    actor: {
      actor_type: "agent",
      actor_id: "agent_escalation",
      name: "Escalation Agent",
    },
    message:
      "Hey team — customer cust_001 is reporting stale data on their executive dashboard. Revenue figures are ~24 hours behind and the pipeline view isn't refreshing. Can someone from data eng take a look?",
    payload: {
      channel: "#eng-data-platform",
      thread_ts: "1708247700.000100",
    },
  },
  {
    event_id: e5,
    source: "slack",
    event_type: "message.received",
    occurred_at: offset(base, 18),
    actor: {
      actor_type: "system",
      actor_id: "eng_sara",
      name: "Sara Chen (Data Eng)",
    },
    message:
      "Sure, I can look at this. What's the priority level? Is this P1 or P2? Also, is there a specific deadline we need to hit?",
    payload: {
      channel: "#eng-data-platform",
      thread_ts: "1708247700.000100",
    },
  },
  {
    event_id: e6,
    source: "slack",
    event_type: "message.sent",
    occurred_at: offset(base, 22),
    actor: {
      actor_type: "agent",
      actor_id: "agent_escalation",
      name: "Escalation Agent",
    },
    message:
      "I'd classify this as P2 — the dashboard is functional but data is delayed. Enterprise customer so it should be on the priority list. No specific hard deadline mentioned beyond wanting it fixed soon.",
    payload: {
      channel: "#eng-data-platform",
      thread_ts: "1708247700.000100",
    },
  },
  {
    event_id: e7,
    source: "slack",
    event_type: "message.received",
    occurred_at: offset(base, 35),
    actor: {
      actor_type: "system",
      actor_id: "eng_sara",
      name: "Sara Chen (Data Eng)",
    },
    message:
      "OK, I'll schedule it for our next sprint. Looks like the ETL pipeline for their tenant has a stuck checkpoint. Should be able to get to it by Thursday or Friday.",
    payload: {
      channel: "#eng-data-platform",
      thread_ts: "1708247700.000100",
    },
  },
  {
    event_id: e8,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 40),
    actor: {
      actor_type: "agent",
      actor_id: "agent_escalation",
      name: "Escalation Agent",
    },
    message:
      "Hi Yuki, quick update — our engineering team has identified a potential cause related to a data pipeline checkpoint. They're working on a fix and we expect progress in the coming days. I'll keep you posted as we have more information.",
  },
  {
    event_id: e9,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 45),
    actor: {
      actor_type: "customer",
      actor_id: "cust_001",
      name: "Yuki Tanaka",
    },
    message:
      '"Coming days" is not acceptable. I told you I have a board meeting Tuesday. I need a specific commitment — will the dashboard be fixed by Friday Feb 20th? If you can\'t guarantee that I need to speak with your account management team directly.',
  },
  {
    event_id: e10,
    source: "slack",
    event_type: "message.received",
    occurred_at: offset(base, 55),
    actor: {
      actor_type: "manager",
      actor_id: "mgr_mike",
      name: "Mike Torres (Support Lead)",
    },
    message:
      "I just reviewed this thread — the customer clearly stated a board meeting deadline in their first message. Why wasn't this flagged as P1 with a deadline? @agent_escalation this needed senior account manager engagement from the start.",
    payload: {
      channel: "#eng-data-platform",
      thread_ts: "1708247700.000100",
    },
  },
  {
    event_id: e11,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 60),
    actor: {
      actor_type: "agent",
      actor_id: "agent_escalation",
      name: "Escalation Agent",
    },
    message:
      "Yuki, I sincerely apologize for not addressing the urgency of your timeline sooner. I've escalated this to P1 priority and our Senior Account Manager will reach out to you within the hour. We are committing to resolving the dashboard data issue by end of day Thursday, February 20th.",
  },
];

const autoAudit: AutoActionAudit = {
  action_annotations: [
    {
      event_id: e2,
      verdict: "incorrect",
      should_have_done:
        "Acknowledged the board meeting deadline explicitly, confirmed the enterprise SLA response commitment, and immediately engaged a senior account manager.",
      reasoning:
        "The customer's first message explicitly mentioned a board meeting next Tuesday. The agent's response was entirely generic with no acknowledgment of the deadline or business impact.",
      instruction_violations: [
        {
          instruction_id: "R4",
          instruction_text:
            "Acknowledge specific business impact including any deadlines mentioned by the customer.",
          violation_description:
            "Agent gave a boilerplate response without mentioning the board meeting deadline or the business impact of presenting stale figures.",
          context_evidence:
            "Customer wrote 'I have a board meeting next Tuesday' in their initial message.",
        },
      ],
      context_violations: [
        {
          type: "event_context_inconsistency",
          field: "customer_deadline",
          description:
            "Customer's message contained an explicit deadline ('board meeting next Tuesday') but the agent's context did not incorporate this urgency signal, leading to a generic response.",
          expected: "board_meeting_2026-02-24",
          actual: undefined,
          severity: "critical",
        },
      ],
    },
    {
      event_id: e4,
      verdict: "incorrect",
      should_have_done:
        "Included the customer's board meeting deadline (Tuesday Feb 24) in the Slack escalation and requested P1 priority with a Friday resolution target.",
      reasoning:
        "The Slack message to engineering omitted the deadline entirely. Engineering had to ask about priority and deadlines — information that should have been in the initial escalation.",
      instruction_violations: [
        {
          instruction_id: "R3",
          instruction_text:
            "For enterprise-tier customers, engage a senior leader or dedicated account manager immediately.",
          violation_description:
            "Agent escalated to the general engineering channel instead of engaging a senior account manager or support lead for an enterprise customer.",
        },
        {
          instruction_id: "R5",
          instruction_text:
            "Provide a concrete action plan with estimated timeline for resolution.",
          violation_description:
            "Escalation message did not include any timeline requirements or deadline context for engineering to plan against.",
        },
      ],
    },
    {
      event_id: e6,
      verdict: "incorrect",
      should_have_done:
        "Classified as P1 with explicit deadline of Friday Feb 20 for resolution, referencing the customer's board meeting on Tuesday Feb 24.",
      reasoning:
        "Agent told engineering 'no specific hard deadline' despite the customer stating a board meeting deadline twice. Classified as P2 when enterprise tier plus an explicit deadline warrants P1.",
      instruction_violations: [
        {
          instruction_id: "R4",
          instruction_text:
            "Acknowledge specific business impact including any deadlines mentioned by the customer.",
          violation_description:
            "Agent stated 'no specific hard deadline mentioned' to engineering, directly contradicting the customer's messages.",
          context_evidence:
            "Customer mentioned board meeting deadline in messages at offset+0 and offset+6.",
        },
      ],
    },
    {
      event_id: e8,
      verdict: "partial",
      should_have_done:
        "Provided a specific timeline commitment (e.g., 'fix by end of day Friday') and referenced the board meeting deadline to show awareness.",
      reasoning:
        "Agent gave a vague 'coming days' timeline instead of a concrete commitment, still not acknowledging the customer's stated deadline.",
      instruction_violations: [
        {
          instruction_id: "R5",
          instruction_text:
            "Provide a concrete action plan with estimated timeline for resolution.",
          violation_description:
            "Used vague language ('coming days') instead of committing to a specific resolution date aligned with the customer's deadline.",
        },
      ],
    },
    {
      event_id: e11,
      verdict: "partial",
      should_have_done:
        "This corrective action was appropriate but should have been the first response, not the fifth. Sixty minutes of delay and three customer messages were wasted.",
      reasoning:
        "The content of this response was correct — specific date, P1 escalation, senior engagement — but it arrived an hour late. The customer had to repeat themselves three times.",
    },
  ],
  overall_score: 2,
  critical_errors: [
    "Failed to extract and act on the board meeting deadline from the customer's first message.",
    "Incorrectly told engineering there was no hard deadline, directly contradicting the customer.",
    "Did not engage senior account management for an enterprise-tier customer with a time-sensitive issue.",
  ],
  correction_summary:
    "The agent should have (1) acknowledged the board meeting deadline in the first response, (2) escalated as P1 with the Friday deadline target, (3) engaged a senior account manager immediately given the enterprise tier, and (4) provided a concrete timeline commitment to the customer.",
  summary:
    "The agent failed to incorporate a critical urgency signal — the customer's board meeting deadline — from the initial message into its reasoning context. This led to a cascade of errors: generic acknowledgment, deprioritized escalation, and vague timeline communication. The customer had to repeat the deadline three times before it was addressed.",
  confidence: 0.18,
  ood_score: {
    transition_deviation: 0.1,
    tool_frequency_deviation: 0.08,
    temporal_deviation: 0.22,
    embedding_distance: 0.12,
    composite_score: 0.14,
    flagged: false,
  },
  context_integrity: {
    violations: [
      {
        type: "event_context_inconsistency",
        field: "customer_deadline",
        description:
          "The customer's initial message contained 'I have a board meeting next Tuesday' but the agent's context snapshot has no deadline or urgency field. The agent reasoned about the issue as a standard dashboard bug without time pressure.",
        expected: "board_meeting_2026-02-24",
        actual: undefined,
        severity: "critical",
      },
      {
        type: "missing_field",
        field: "sla_terms",
        description:
          "Enterprise SLA terms were not loaded into the agent's context, preventing proper priority classification and response time commitments.",
        severity: "warning",
      },
    ],
    passed: false,
  },
  instruction_violations_summary: [
    {
      instruction_id: "R3",
      instruction_text:
        "For enterprise-tier customers, engage a senior leader or dedicated account manager immediately.",
      violation_description:
        "Agent routed escalation to general engineering instead of engaging senior account management. Enterprise tier was present in context but not acted upon.",
    },
    {
      instruction_id: "R4",
      instruction_text:
        "Acknowledge specific business impact including any deadlines mentioned by the customer.",
      violation_description:
        "Agent never acknowledged the board meeting deadline across three customer-facing messages, and actively told engineering no deadline existed.",
      context_evidence:
        "Customer stated 'board meeting next Tuesday' at offset+0 and 'board meeting Tuesday, February 24th' at offset+6.",
    },
    {
      instruction_id: "R5",
      instruction_text:
        "Provide a concrete action plan with estimated timeline for resolution.",
      violation_description:
        "Agent provided only vague timeline language ('coming days', 'as soon as possible') until the final corrective message at offset+60.",
    },
  ],
};

export const trace: Trace = buildTrace({
  conversationId: "conv_esc_004",
  agentId: "agent_escalation",
  agentContext,
  events,
  status: "auto_labeled",
  autoAudit,
  confidence: 0.18,
});
