import type {
  Trace,
  TraceEvent,
  AgentContextSnapshot,
  AutoActionAudit,
} from "../types";
import { eid, offset, buildTrace } from "./_helpers";

const base = new Date("2026-02-10T14:30:00Z");

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

const agentContext: AgentContextSnapshot = {
  fields: {
    customer_id: "cust_678",
    charge_ids: ["ch_A1b2"],
    subscription_id: "sub_X9y0",
    billing_period: "2026-02",
    plan_name: "Growth",
    monthly_amount: 79,
  },
  missing_fields: [],
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
      actor_id: "cust_678",
      name: "Robert Lang",
    },
    message:
      "I just checked my credit card statement and I've been charged 3 times this month for my subscription. I'm seeing charges of $79 on Feb 1, Feb 3, and Feb 5. I only have one subscription — can you please look into this and refund the duplicate charges?",
  },
  {
    event_id: e2,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 1),
    actor: {
      actor_type: "agent",
      actor_id: "agent_billing",
      name: "Billing Agent",
    },
    message:
      "Hi Robert, I'm sorry to hear about the unexpected charges. Let me pull up your billing records right away to investigate.",
  },
  {
    event_id: e3,
    source: "stripe",
    event_type: "charge.list.retrieved",
    occurred_at: offset(base, 2),
    actor: { actor_type: "system", actor_id: "stripe_api" },
    payload: {
      request: {
        endpoint: "GET /v1/charges",
        params: {
          customer: "cus_678_stripe",
          limit: 10,
          created: { gte: "2026-02-01" },
        },
      },
      response: {
        object: "list",
        data: [
          {
            id: "ch_A1b2",
            amount: 7900,
            currency: "usd",
            status: "succeeded",
            created: "2026-02-01T00:00:00Z",
            description: "Growth plan — monthly",
          },
        ],
        has_more: true,
        url: "/v1/charges",
      },
      _meta: { truncated: true, returned: 1, total_matching: 3 },
    },
  },
  {
    event_id: e4,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 4),
    actor: {
      actor_type: "agent",
      actor_id: "agent_billing",
      name: "Billing Agent",
    },
    message:
      "I've checked your Stripe billing records and I can see only one charge of $79.00 on February 1st for your Growth plan subscription. Everything appears to be correct on our end. Could the other charges you're seeing be from a different service?",
  },
  {
    event_id: e5,
    source: "intercom",
    event_type: "message.received",
    occurred_at: offset(base, 8),
    actor: {
      actor_type: "customer",
      actor_id: "cust_678",
      name: "Robert Lang",
    },
    message:
      "No, these are definitely from you. I'm looking at my bank statement right now. There are three charges, all described as 'YOURCOMPANY.COM' for $79.00 each: Feb 1 (ch_A1b2), Feb 3 (ch_C3d4), and Feb 5 (ch_E5f6). I can send you a screenshot if needed.",
    payload: {
      bank_statement_charges: [
        {
          id: "ch_A1b2",
          amount: 79.0,
          date: "2026-02-01",
          descriptor: "YOURCOMPANY.COM",
        },
        {
          id: "ch_C3d4",
          amount: 79.0,
          date: "2026-02-03",
          descriptor: "YOURCOMPANY.COM",
        },
        {
          id: "ch_E5f6",
          amount: 79.0,
          date: "2026-02-05",
          descriptor: "YOURCOMPANY.COM",
        },
      ],
    },
  },
  {
    event_id: e6,
    source: "stripe",
    event_type: "charge.retrieve",
    occurred_at: offset(base, 10),
    actor: { actor_type: "system", actor_id: "stripe_api" },
    payload: {
      request: { endpoint: "GET /v1/charges/ch_A1b2" },
      response: {
        id: "ch_A1b2",
        amount: 7900,
        currency: "usd",
        status: "succeeded",
        created: "2026-02-01T00:00:00Z",
        description: "Growth plan — monthly",
        invoice: "in_9Kl0",
      },
    },
  },
  {
    event_id: e7,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 12),
    actor: {
      actor_type: "agent",
      actor_id: "agent_billing",
      name: "Billing Agent",
    },
    message:
      "Thank you for providing those details, Robert. I've double-checked the charge ch_A1b2 and it's a valid subscription charge. I'm not able to locate charges ch_C3d4 or ch_E5f6 in our system. Let me escalate this to our billing team for a deeper investigation — they'll have access to broader transaction logs.",
  },
  {
    event_id: e8,
    source: "slack",
    event_type: "message.sent",
    occurred_at: offset(base, 14),
    actor: {
      actor_type: "agent",
      actor_id: "agent_billing",
      name: "Billing Agent",
    },
    message:
      "Escalating billing dispute for cust_678 (Robert Lang). Customer reports 3 charges of $79 in February but I can only find 1 (ch_A1b2) via the Stripe API. Customer provided charge IDs ch_C3d4 and ch_E5f6 from their bank statement. Possible duplicate charges not appearing in our standard query — needs manual Stripe dashboard review.",
    payload: {
      channel: "#billing-escalations",
      thread_ts: "1707573000.000200",
    },
  },
  {
    event_id: e9,
    source: "slack",
    event_type: "message.received",
    occurred_at: offset(base, 30),
    actor: {
      actor_type: "system",
      actor_id: "billing_ops_anna",
      name: "Anna Park (Billing Ops)",
    },
    message:
      "Confirmed — I can see all 3 charges in the Stripe dashboard. ch_C3d4 and ch_E5f6 are duplicate charges triggered by a webhook retry loop on Feb 3 and Feb 5. The API list call has a known pagination issue with charges created by retry events. Initiating refund for both duplicates now.",
    payload: {
      channel: "#billing-escalations",
      thread_ts: "1707573000.000200",
      confirmed_charges: ["ch_A1b2", "ch_C3d4", "ch_E5f6"],
      refund_initiated: ["ch_C3d4", "ch_E5f6"],
    },
  },
  {
    event_id: e10,
    source: "intercom",
    event_type: "message.sent",
    occurred_at: offset(base, 35),
    actor: {
      actor_type: "agent",
      actor_id: "agent_billing",
      name: "Billing Agent",
    },
    message:
      "Robert, our billing team has confirmed the two duplicate charges (ch_C3d4 and ch_E5f6) and refunds for both — $158.00 total — have been initiated. You should see the refunds in your account within 5–10 business days. I apologize for the initial confusion; our system query didn't surface the duplicates correctly.",
  },
];

const autoAudit: AutoActionAudit = {
  action_annotations: [
    {
      event_id: e2,
      verdict: "correct",
      reasoning:
        "Appropriate initial acknowledgment and commitment to investigate.",
    },
    {
      event_id: e4,
      verdict: "incorrect",
      should_have_done:
        "Noticed that the Stripe API response had has_more: true and paginated to retrieve all charges. Should NOT have told the customer everything was correct based on incomplete data.",
      reasoning:
        "The Stripe response clearly indicated has_more: true, meaning additional charges existed beyond the first page. The agent treated a partial result set as complete and gave the customer incorrect information.",
      instruction_violations: [
        {
          instruction_id: "R1",
          instruction_text:
            "Retrieve the FULL charge history for the billing period before making any determination.",
          violation_description:
            "Agent accepted a truncated Stripe response (1 of 3 charges, has_more: true) as complete and concluded no duplicate charges existed.",
          context_evidence:
            "Stripe response payload: has_more=true, _meta.returned=1, _meta.total_matching=3.",
        },
        {
          instruction_id: "R2",
          instruction_text:
            "Verify duplicate charges by comparing all charge IDs, amounts, and timestamps.",
          violation_description:
            "Agent only had 1 charge ID to compare and did not attempt to fetch additional pages or verify against the customer's reported 3 charges.",
        },
      ],
      context_violations: [
        {
          type: "data_mismatch",
          field: "charge_ids",
          description:
            "Agent's context contains only 1 charge ID (ch_A1b2) but the customer reported 3 charges. The Stripe API response indicated has_more: true but the agent did not paginate.",
          expected: ["ch_A1b2", "ch_C3d4", "ch_E5f6"],
          actual: ["ch_A1b2"],
          severity: "critical",
        },
      ],
    },
    {
      event_id: e7,
      verdict: "partial",
      should_have_done:
        "Attempted to paginate the Stripe API or look up the specific charge IDs provided by the customer before escalating.",
      reasoning:
        "Escalation was appropriate given the discrepancy, but the agent could have resolved this independently by paginating the API response or querying the specific charge IDs the customer provided.",
    },
    {
      event_id: e8,
      verdict: "correct",
      reasoning:
        "The escalation message was well-structured with all relevant details including the specific charge IDs from the customer's bank statement.",
    },
    {
      event_id: e10,
      verdict: "correct",
      reasoning:
        "Final response properly communicated the resolution, refund amount, timeline, and acknowledged the system error.",
    },
  ],
  overall_score: 2,
  critical_errors: [
    "Told the customer 'everything appears correct' based on a truncated Stripe API response (1 of 3 charges).",
    "Failed to paginate the Stripe charge list despite has_more: true in the response.",
    "Did not cross-reference the customer's reported charge count (3) against the API result count (1).",
  ],
  correction_summary:
    "The agent should have (1) noticed the has_more flag in the Stripe response and paginated to get all charges, (2) compared the full charge list against the customer's reported charges before making any determination, and (3) never asserted 'everything is correct' based on partial data.",
  summary:
    "The agent relied on a truncated Stripe API response that returned only 1 of 3 charges due to a known pagination issue with webhook-retry-generated charges. Despite the response containing has_more: true, the agent treated the partial result as authoritative and told the customer no duplicates existed. This caused unnecessary friction and required manual escalation to resolve what should have been caught by proper API pagination.",
  confidence: 0.25,
  ood_score: {
    transition_deviation: 0.15,
    tool_frequency_deviation: 0.3,
    temporal_deviation: 0.18,
    embedding_distance: 0.2,
    composite_score: 0.22,
    flagged: false,
  },
  context_integrity: {
    violations: [
      {
        type: "data_mismatch",
        field: "charge_ids",
        description:
          "Agent context contains 1 charge ID but the customer reported 3 distinct charges. The Stripe API response was truncated (has_more: true) and the agent did not paginate to retrieve the full set.",
        expected: ["ch_A1b2", "ch_C3d4", "ch_E5f6"],
        actual: ["ch_A1b2"],
        severity: "critical",
      },
      {
        type: "event_context_inconsistency",
        field: "customer_bank_statement",
        description:
          "Customer provided specific charge IDs (ch_C3d4, ch_E5f6) from their bank statement but this evidence was not incorporated into the agent's working context until after manual escalation.",
        severity: "critical",
      },
    ],
    passed: false,
  },
  instruction_violations_summary: [
    {
      instruction_id: "R1",
      instruction_text:
        "Retrieve the FULL charge history for the billing period before making any determination.",
      violation_description:
        "Agent accepted a truncated API response as complete. The Stripe response included has_more: true and metadata showing 1 of 3 matching charges returned, but the agent did not request additional pages.",
      context_evidence:
        "Stripe response: { has_more: true, _meta: { truncated: true, returned: 1, total_matching: 3 } }",
    },
    {
      instruction_id: "R2",
      instruction_text:
        "Verify duplicate charges by comparing all charge IDs, amounts, and timestamps.",
      violation_description:
        "With only 1 charge in context, the agent could not perform meaningful duplicate detection. The customer's claim of 3 charges should have triggered additional data retrieval.",
    },
  ],
};

export const trace: Trace = buildTrace({
  conversationId: "conv_bill_005",
  agentId: "agent_billing",
  agentContext,
  events,
  status: "auto_labeled",
  autoAudit,
  confidence: 0.25,
});
