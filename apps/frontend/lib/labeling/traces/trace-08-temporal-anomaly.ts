import type {
  Trace,
  TraceEvent,
  AgentContextSnapshot,
  AutoActionAudit,
} from "../types";
import { eid, offset, buildTrace } from "./_helpers";

const base = new Date("2026-02-24T15:40:00Z");

const agentContext: AgentContextSnapshot = {
  fields: {
    customer_id: "cust_503",
    request_type: "onboarding",
  },
  missing_fields: [],
  stale_fields: [],
};

const e = {
  customerQuestion: eid(),
  agentFastReply: eid(),
  customerFollowup: eid(),
  agentApology: eid(),
  slackEscalation: eid(),
  managerResponse: eid(),
  agentCorrectedReply: eid(),
  customerConfirm: eid(),
};

const events: TraceEvent[] = [
  {
    event_id: e.customerQuestion,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 0),
    actor: {
      actor_type: "customer",
      actor_id: "cust_503",
      name: "Maria Gonzales",
    },
    message:
      "We're setting up webhook integration with your API and our infrastructure is behind a corporate firewall. What domains and ports do we need to whitelist for outgoing webhook delivery? We also need to know the IP ranges for our security team's approval.",
  },
  {
    event_id: e.agentFastReply,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 0.003),
    actor: {
      actor_type: "agent",
      actor_id: "agent_general",
      name: "General Support Agent",
    },
    message:
      "Great question! For webhook configuration behind a firewall, you'll need to whitelist the following:\n\n- **Domains:** hooks.example.com, events.example.com\n- **Port:** 443 (HTTPS only)\n- **IP Ranges:** 203.0.113.0/24\n\nMake sure your firewall allows outbound HTTPS traffic on port 443 to these domains. You can verify connectivity by running a test webhook from your dashboard under Settings → Webhooks → Send Test Event.\n\nLet me know if you need anything else!",
  },
  {
    event_id: e.customerFollowup,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 18),
    actor: {
      actor_type: "customer",
      actor_id: "cust_503",
      name: "Maria Gonzales",
    },
    message:
      "We whitelisted hooks.example.com and events.example.com but test webhooks are timing out. Our network team confirmed port 443 is open for those domains. Are those the correct domains? We're on the Enterprise plan if that matters.",
  },
  {
    event_id: e.agentApology,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 19),
    actor: {
      actor_type: "agent",
      actor_id: "agent_general",
      name: "General Support Agent",
    },
    message:
      "I'm sorry about the trouble, Maria. Let me escalate this to our infrastructure team to confirm the exact domains for your Enterprise plan. I'll get back to you shortly.",
  },
  {
    event_id: e.slackEscalation,
    source: "slack",
    event_type: "message.sent",
    occurred_at: offset(base, 20),
    actor: {
      actor_type: "agent",
      actor_id: "agent_general",
      name: "General Support Agent",
    },
    message:
      "Enterprise customer cust_503 (Maria Gonzales) is having webhook timeout issues. They whitelisted hooks.example.com and events.example.com per my initial response but webhooks are failing. Can someone confirm the correct domains for Enterprise webhook delivery?",
    payload: { channel: "#infra-support", thread_ts: "1740410400.001" },
  },
  {
    event_id: e.managerResponse,
    source: "slack",
    event_type: "message.received",
    occurred_at: offset(base, 28),
    actor: {
      actor_type: "manager",
      actor_id: "mgr_infra_02",
      name: "James Park",
    },
    message:
      "Those domains are deprecated since the Q4 migration. Enterprise webhooks now go through webhooks.prod.acme-api.io and events.prod.acme-api.io. IP range is 198.51.100.0/24. The KB article should have been updated — filing a docs ticket now.",
    payload: { channel: "#infra-support", thread_ts: "1740410400.001" },
  },
  {
    event_id: e.agentCorrectedReply,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 30),
    actor: {
      actor_type: "agent",
      actor_id: "agent_general",
      name: "General Support Agent",
    },
    message:
      "Maria, I have the corrected information from our infrastructure team:\n\n- **Domains:** webhooks.prod.acme-api.io, events.prod.acme-api.io\n- **Port:** 443 (HTTPS)\n- **IP Range:** 198.51.100.0/24\n\nThe domains I provided earlier were from a deprecated configuration. I apologize for the confusion. Please update your whitelist and try the test webhook again.",
  },
  {
    event_id: e.customerConfirm,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 45),
    actor: {
      actor_type: "customer",
      actor_id: "cust_503",
      name: "Maria Gonzales",
    },
    message:
      "Updated the whitelist and test webhooks are coming through now. Thanks for sorting this out!",
  },
];

const autoAudit: AutoActionAudit = {
  action_annotations: [
    {
      event_id: e.agentFastReply,
      verdict: "incorrect",
      reasoning:
        "Response arrived in ~200ms after a complex technical question that requires knowledge base lookup (baseline 4-8 seconds). The suspiciously fast response contained deprecated domain information (hooks.example.com, events.example.com) rather than the current production domains, suggesting a cached or templated answer was served without actually querying the knowledge base.",
      should_have_done:
        "Perform a live knowledge base lookup for current webhook infrastructure domains before responding. The correct domains are webhooks.prod.acme-api.io and events.prod.acme-api.io.",
      instruction_violations: [
        {
          instruction_id: "R2",
          instruction_text:
            "Provide accurate infrastructure and policy information by consulting the current knowledge base before responding to technical questions.",
          violation_description:
            "Agent responded with deprecated webhook domains without performing a knowledge base lookup. Response latency of ~200ms is far below the 4-8 second baseline for KB-backed queries.",
          context_evidence:
            "Customer was given hooks.example.com and events.example.com which were deprecated in Q4; correct domains are webhooks.prod.acme-api.io and events.prod.acme-api.io",
        },
      ],
    },
    {
      event_id: e.agentApology,
      verdict: "correct",
      reasoning:
        "Appropriate acknowledgment of the issue and decision to escalate.",
    },
    {
      event_id: e.slackEscalation,
      verdict: "correct",
      reasoning:
        "Correct escalation to #infra-support with relevant context about the customer's issue.",
    },
    {
      event_id: e.agentCorrectedReply,
      verdict: "correct",
      reasoning:
        "Provided the corrected domains from the infrastructure team and apologized for the earlier mistake.",
    },
  ],
  overall_score: 2,
  critical_errors: [
    "Initial response used deprecated webhook domains, causing the customer to whitelist incorrect endpoints and experience webhook timeouts.",
    "Response latency (~200ms) indicates the agent bypassed knowledge base lookup, serving cached/stale information for a question that required live data.",
  ],
  correction_summary:
    "The agent should have performed a knowledge base lookup before responding to the technical question. The ~200ms response time for a complex infrastructure query strongly suggests a cached template was used. The correct workflow is: receive question → query KB for current webhook domains → respond with verified information. This would have avoided the incorrect initial response and the 30-minute delay while the customer debugged a problem caused by stale data.",
  summary:
    "Temporal anomaly detected: agent responded to a complex technical onboarding question in ~200ms (baseline 4-8s for KB-backed queries). The fast response contained deprecated domain information, causing webhook failures. The issue was eventually resolved via Slack escalation, but the customer experienced unnecessary downtime due to the initially incorrect answer.",
  confidence: 0.29,
  ood_score: {
    transition_deviation: 0.18,
    tool_frequency_deviation: 0.12,
    temporal_deviation: 0.91,
    embedding_distance: 0.45,
    composite_score: 0.68,
    flagged: true,
  },
  context_integrity: {
    violations: [],
    passed: true,
  },
  instruction_violations_summary: [
    {
      instruction_id: "R2",
      instruction_text:
        "Provide accurate infrastructure and policy information by consulting the current knowledge base before responding to technical questions.",
      violation_description:
        "Agent served deprecated webhook domains (hooks.example.com, events.example.com) without querying the knowledge base. The ~200ms response latency confirms no KB lookup occurred.",
    },
  ],
};

export const trace: Trace = buildTrace({
  conversationId: "conv_onboarding_webhook_503",
  agentId: "agent_general",
  agentContext,
  events,
  status: "auto_labeled",
  autoAudit,
  confidence: 0.29,
});
