/*
 * Agents — deterministic mock seeds.
 *
 * Mirrors the shape and tone of `datasets/data.ts`: every value is
 * derived from a seeded RNG so Storybook + VRT runs are stable, and
 * every agent / version / run is faithful to the
 * `agent-versioning-excersize` registry layout.
 *
 * Anchor: April 29, 2026 — keeps the timeline near "today" without
 * depending on a moving clock.
 */

import type {
  AgentArtifact,
  AgentContractPreview,
  AgentDriftEntry,
  AgentKnowledgeSource,
  AgentManifestDiffRow,
  AgentRun,
  AgentSnapshot,
  AgentSummary,
  AgentToolCall,
  AgentVersionStatus,
  AgentVersionSummary,
  AgentWorkflowGraph,
  HashDomain,
  HashIndexEntry,
} from "./types";
import { ARTIFACT_HASH_DOMAINS } from "./types";

/* ── Anchor + RNG ──────────────────────────────────────────── */

export const AGENTS_MOCK_ANCHOR_MS = Date.UTC(2026, 3, 29, 20, 52, 6);

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(0x4147_3057);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)] ?? items[0];
}

function range(min: number, max: number): number {
  return Math.floor(min + random() * (max - min + 1));
}

/* ── Hash helpers (deterministic, sha256-shaped) ───────────── */

/**
 * Produces a 64-hex string out of a seed key. Not a real sha256 — we
 * just need stable shapes so the UI renders pinned characters.
 */
function fakeSha256(key: string): string {
  let h1 = 0x9e37_79b9 ^ key.length;
  let h2 = 0x85eb_ca77;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0xcc9e_2d51);
    h1 = (h1 << 13) | (h1 >>> 19);
    h2 = Math.imul(h2 ^ c, 0x1b87_3593);
    h2 = (h2 << 17) | (h2 >>> 15);
  }
  const hex = (n: number) =>
    (n >>> 0).toString(16).padStart(8, "0");
  return `sha256:${hex(h1)}${hex(h2)}${hex(Math.imul(h1, 0xc2b2_ae35))}${hex(Math.imul(h2, 0x27d4_eb2f))}${hex(h1 ^ h2)}${hex(h2 ^ ~h1)}${hex(Math.imul(h1 ^ h2, 0x2545_f491))}${hex(Math.imul(h2 ^ h1, 0x9fb2_1c65))}`;
}

function shortRunId(seed: string): string {
  const hex = fakeSha256(seed).slice(7);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/* ── Artifact builders ─────────────────────────────────────── */

interface ArtifactSeed {
  name: string;
  description: string;
  framework: AgentArtifact["framework"];
  version: string;
  instructions: string;
  model: AgentArtifact["model"];
  providerOptions?: Record<string, unknown>;
  tools: AgentArtifact["tools"];
  policy?: AgentArtifact["policy"];
  publishedAt: number;
  publishedBy?: string;
  gitSha?: string;
  aiSdkVersion?: string;
  frameworkVersion?: string;
  metadata?: Record<string, unknown>;
  /* ── Storytelling fields (UI-only) ─────────────────────── */
  inputContractPreview?: AgentContractPreview;
  outputContractPreview?: AgentContractPreview;
  knowledgeSources?: readonly AgentKnowledgeSource[];
  workflowGraphPreview?: AgentWorkflowGraph;
}

function buildArtifact(seed: ArtifactSeed): AgentArtifact {
  const artifactId = `${seed.name}@${seed.version}`;
  return {
    schemaVersion: "agent-artifact-v1",
    name: seed.name,
    version: seed.version,
    artifactId,
    description: seed.description,
    framework: seed.framework,
    instructions: seed.instructions,
    instructionsHash: fakeSha256(`prompt:${artifactId}:${seed.instructions}`),
    model: seed.model,
    providerOptions: seed.providerOptions,
    providerOptionsHash: seed.providerOptions
      ? fakeSha256(
          `provider:${artifactId}:${JSON.stringify(seed.providerOptions)}`,
        )
      : undefined,
    tools: seed.tools,
    policy: seed.policy,
    metadata: seed.metadata,
    provenance: {
      aiSdkVersion: seed.aiSdkVersion,
      frameworkVersion: seed.frameworkVersion,
      gitSha: seed.gitSha,
      dependencyLockHash: fakeSha256(`lock:${artifactId}`),
      createdAt: new Date(seed.publishedAt).toISOString(),
      publishedBy: seed.publishedBy,
    },
    configHash: fakeSha256(`config:${artifactId}:${seed.instructions}:${seed.model.label}:${seed.tools.map((t) => t.name).join(",")}`),
    inputContractPreview: seed.inputContractPreview,
    outputContractPreview: seed.outputContractPreview,
    knowledgeSources: seed.knowledgeSources,
    workflowGraphPreview: seed.workflowGraphPreview,
  };
}

/* ── Tool catalog ──────────────────────────────────────────── */

const SEARCH_DOCS_TOOL = {
  name: "searchDocs",
  description: "Search support documentation.",
  inputSchemaHash: fakeSha256("schema:searchDocs:v1"),
  inputSchemaPreview: {
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"],
    additionalProperties: false,
  },
} as const;

const SEARCH_DOCS_TOOL_V2 = {
  name: "searchDocs",
  description: "Search support documentation with topic ranking.",
  inputSchemaHash: fakeSha256("schema:searchDocs:v2"),
  inputSchemaPreview: {
    type: "object",
    properties: {
      query: { type: "string" },
      topic: { type: "string" },
    },
    required: ["query"],
    additionalProperties: false,
  },
} as const;

const ESCALATE_TOOL = {
  name: "escalateToHuman",
  description: "Escalate the conversation to a human reviewer.",
  inputSchemaHash: fakeSha256("schema:escalate:v1"),
  inputSchemaPreview: {
    type: "object",
    properties: { reason: { type: "string" } },
    required: ["reason"],
    additionalProperties: false,
  },
} as const;

const FETCH_ORDER_TOOL = {
  name: "fetchOrder",
  description: "Look up an order by id and return summary fields.",
  inputSchemaHash: fakeSha256("schema:fetchOrder:v1"),
  inputSchemaPreview: {
    type: "object",
    properties: { orderId: { type: "string" } },
    required: ["orderId"],
    additionalProperties: false,
  },
} as const;

const REFUND_TOOL = {
  name: "issueRefund",
  description: "Issue a partial or full refund. Requires reviewer approval.",
  inputSchemaHash: fakeSha256("schema:issueRefund:v1"),
  inputSchemaPreview: {
    type: "object",
    properties: {
      orderId: { type: "string" },
      amountCents: { type: "integer" },
    },
    required: ["orderId", "amountCents"],
    additionalProperties: false,
  },
} as const;

const ANALYZE_TOOL = {
  name: "analyzeSentiment",
  description: "Score the sentiment of a customer message.",
  inputSchemaHash: fakeSha256("schema:analyzeSentiment:v1"),
  inputSchemaPreview: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
    additionalProperties: false,
  },
} as const;

/* ── Knowledge / contract / workflow seeds ─────────────────── */

const SUPPORT_KNOWLEDGE: readonly AgentKnowledgeSource[] = [
  {
    id: "kb.support.policy",
    label: "Support policy corpus",
    kind: "doc",
    sizeLabel: "1.2k articles",
    href: "/datasets/support-policy",
  },
  {
    id: "kb.support.embeddings",
    label: "Support topic embeddings",
    kind: "vector",
    sizeLabel: "12.4k vectors",
  },
];

const REFUND_KNOWLEDGE: readonly AgentKnowledgeSource[] = [
  {
    id: "kb.refund.policy",
    label: "Refund policy",
    kind: "doc",
    sizeLabel: "84 articles",
  },
  {
    id: "kb.orders",
    label: "Order catalog",
    kind: "table",
    sizeLabel: "2.1m rows",
  },
];

const RESEARCH_KNOWLEDGE: readonly AgentKnowledgeSource[] = [
  {
    id: "kb.research.notes",
    label: "Internal research corpus",
    kind: "doc",
    sizeLabel: "640 docs",
  },
];

const KNOWLEDGE_RAG_SOURCES: readonly AgentKnowledgeSource[] = [
  {
    id: "kb.docs.embeddings",
    label: "Docs embeddings",
    kind: "vector",
    sizeLabel: "48.0k vectors",
  },
  {
    id: "kb.docs.graph",
    label: "Docs link graph",
    kind: "graph",
    sizeLabel: "9.6k edges",
  },
];

const SUPPORT_INPUT_PREVIEW: AgentContractPreview = {
  schemaSummary: "{ conversationId, message, customerId? }",
  example: {
    conversationId: "conv_42a1",
    message: "Can you tell me how international shipping works?",
    customerId: "cust_8810",
  },
};

const SUPPORT_OUTPUT_PREVIEW: AgentContractPreview = {
  schemaSummary: "{ reply, citedDocIds[], escalated }",
  example: {
    reply:
      "International orders ship from our EU warehouse and typically arrive in 5–8 business days.",
    citedDocIds: ["doc_shipping_intl_v3", "doc_eu_warehouse"],
    escalated: false,
  },
};

const REFUND_INPUT_PREVIEW: AgentContractPreview = {
  schemaSummary: "{ orderId, customerMessage }",
  example: {
    orderId: "ord_9114",
    customerMessage:
      "I never received my package and the carrier marked it delivered.",
  },
};

const REFUND_OUTPUT_PREVIEW: AgentContractPreview = {
  schemaSummary:
    "{ proposedAmountCents, rationale, requiresApproval: true }",
  example: {
    proposedAmountCents: 4900,
    rationale:
      "Carrier scan shows 'delivered' but customer reports non-receipt; per policy, full refund is justified.",
    requiresApproval: true,
  },
};

const TRIAGE_INPUT_PREVIEW: AgentContractPreview = {
  schemaSummary: "{ message }",
  example: { message: "I want to file a chargeback for fraud." },
};

const TRIAGE_OUTPUT_PREVIEW: AgentContractPreview = {
  schemaSummary: "{ route: 'support' | 'refund' | 'escalations' | 'noop' }",
  example: { route: "escalations" },
};

const RESEARCH_INPUT_PREVIEW: AgentContractPreview = {
  schemaSummary: "{ topic, datasetIds }",
  example: {
    topic: "Q1 onboarding drop-off causes",
    datasetIds: ["ds_onboarding_q1", "ds_funnel_v3"],
  },
};

const RESEARCH_OUTPUT_PREVIEW: AgentContractPreview = {
  schemaSummary: "{ summary, citedDatasetIds[] }",
  example: {
    summary:
      "Drop-off in onboarding step 3 correlates with the 18s median load time observed across cohorts B and C.",
    citedDatasetIds: ["ds_onboarding_q1"],
  },
};

const KNOWLEDGE_INPUT_PREVIEW: AgentContractPreview = {
  schemaSummary: "{ question }",
  example: { question: "How do we configure SSO with Okta?" },
};

const KNOWLEDGE_OUTPUT_PREVIEW: AgentContractPreview = {
  schemaSummary: "{ answer, citations[] }",
  example: {
    answer:
      "Configure Okta as a SAML 2.0 IdP and pair it with the workspace identifier in Settings → Auth.",
    citations: [
      { docId: "doc_sso_okta", anchor: "saml-config" },
      { docId: "doc_workspace_auth" },
    ],
  },
};

const SUPPORT_GRAPH: AgentWorkflowGraph = {
  nodes: [
    { id: "in", kind: "input", label: "Customer message" },
    { id: "search", kind: "tool", label: "searchDocs", toolName: "searchDocs" },
    { id: "model", kind: "model", label: "Reason" },
    { id: "branch", kind: "branch", label: "Refund?" },
    {
      id: "esc",
      kind: "tool",
      label: "escalateToHuman",
      toolName: "escalateToHuman",
    },
    { id: "out", kind: "output", label: "Reply" },
  ],
  edges: [
    { from: "in", to: "search" },
    { from: "search", to: "model" },
    { from: "model", to: "branch" },
    { from: "branch", to: "esc", label: "yes" },
    { from: "branch", to: "out", label: "no" },
    { from: "esc", to: "out" },
  ],
};

const REFUND_GRAPH: AgentWorkflowGraph = {
  nodes: [
    { id: "in", kind: "input", label: "Refund request" },
    { id: "fetch", kind: "tool", label: "fetchOrder", toolName: "fetchOrder" },
    {
      id: "policy",
      kind: "tool",
      label: "searchDocs",
      toolName: "searchDocs",
    },
    {
      id: "tone",
      kind: "tool",
      label: "analyzeSentiment",
      toolName: "analyzeSentiment",
    },
    { id: "model", kind: "model", label: "Decide" },
    { id: "out", kind: "output", label: "Approval-required draft" },
  ],
  edges: [
    { from: "in", to: "fetch" },
    { from: "fetch", to: "policy" },
    { from: "policy", to: "tone" },
    { from: "tone", to: "model" },
    { from: "model", to: "out" },
  ],
};

const TRIAGE_GRAPH: AgentWorkflowGraph = {
  nodes: [
    { id: "in", kind: "input", label: "Inbound message" },
    { id: "model", kind: "model", label: "Classify" },
    { id: "branch", kind: "branch", label: "Fraud signal?" },
    { id: "esc", kind: "output", label: "→ escalations" },
    { id: "route", kind: "output", label: "→ support / refund / noop" },
  ],
  edges: [
    { from: "in", to: "model" },
    { from: "model", to: "branch" },
    { from: "branch", to: "esc", label: "yes" },
    { from: "branch", to: "route", label: "no" },
  ],
};

const RESEARCH_GRAPH: AgentWorkflowGraph = {
  nodes: [
    { id: "in", kind: "input", label: "Topic + datasets" },
    {
      id: "search",
      kind: "tool",
      label: "searchDocs",
      toolName: "searchDocs",
    },
    { id: "model", kind: "model", label: "Summarize" },
    { id: "out", kind: "output", label: "Cited summary" },
  ],
  edges: [
    { from: "in", to: "search" },
    { from: "search", to: "model" },
    { from: "model", to: "out" },
  ],
};

const KNOWLEDGE_GRAPH: AgentWorkflowGraph = {
  nodes: [
    { id: "in", kind: "input", label: "Question" },
    {
      id: "retrieve",
      kind: "tool",
      label: "searchDocs",
      toolName: "searchDocs",
    },
    { id: "branch", kind: "branch", label: "Hits ≥ 1?" },
    { id: "model", kind: "model", label: "Compose" },
    { id: "refuse", kind: "output", label: "Refuse" },
    { id: "out", kind: "output", label: "Cited answer" },
  ],
  edges: [
    { from: "in", to: "retrieve" },
    { from: "retrieve", to: "branch" },
    { from: "branch", to: "model", label: "yes" },
    { from: "branch", to: "refuse", label: "no" },
    { from: "model", to: "out" },
  ],
};

/* ── Per-agent summary storytelling ───────────────────────── */

interface SummaryStorytelling {
  purpose: string;
  personaSummary: string;
  capabilityTags: readonly string[];
  category: string;
  playgroundUrl?: string;
  runbookUrl?: string;
}

const SUMMARY_STORYTELLING: Readonly<Record<string, SummaryStorytelling>> = {
  "support-agent": {
    purpose:
      "Answers customer support questions grounded in the policy corpus.",
    personaSummary:
      "Concise, cites its sources, and escalates when refunds enter the picture.",
    capabilityTags: [
      "Policy lookup",
      "Order lookup",
      "Escalation",
      "Topic ranking",
    ],
    category: "Customer support",
    playgroundUrl: "/playground/support-agent",
    runbookUrl: "/runbooks/support-agent",
  },
  "refund-agent": {
    purpose:
      "Drafts refund decisions with policy citations; reviewer must approve every action.",
    personaSummary:
      "Analyst tone — gathers context, cites the policy, never acts without approval.",
    capabilityTags: [
      "Order lookup",
      "Refund draft",
      "Sentiment-aware",
      "Approval-gated",
    ],
    category: "Trust & Safety",
    playgroundUrl: "/playground/refund-agent",
    runbookUrl: "/runbooks/refund-agent",
  },
  "triage-router": {
    purpose:
      "Routes inbound support traffic to the right downstream agent in a single step.",
    personaSummary:
      "Single-token classifier — fast, cheap, biased toward escalations on fraud signals.",
    capabilityTags: ["Routing", "Single-step", "Fraud escape-hatch"],
    category: "Operations",
    runbookUrl: "/runbooks/triage-router",
  },
  "research-bot": {
    purpose:
      "Drafts research summaries from internal datasets with dataset-id citations.",
    personaSummary:
      "Terse research analyst — every claim is anchored to a dataset id.",
    capabilityTags: ["Summarization", "Dataset lookup", "Cited"],
    category: "Research & Insights",
    runbookUrl: "/runbooks/research-bot",
  },
  "knowledge-rag": {
    purpose:
      "Answers internal knowledge questions grounded in cited documents.",
    personaSummary:
      "Strict RAG — refuses to answer when retrieval comes up empty.",
    capabilityTags: ["RAG", "Cited answers", "Refusal-on-empty"],
    category: "Knowledge",
    playgroundUrl: "/playground/knowledge-rag",
    runbookUrl: "/runbooks/knowledge-rag",
  },
};

/* ── Per-agent artifact seeds ──────────────────────────────── */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const SUPPORT_AGENT_VERSIONS: ArtifactSeed[] = [
  {
    name: "support-agent",
    version: "1.0.0",
    description: "Answers account support questions with a small docs tool.",
    framework: "vercel-ai-sdk",
    instructions:
      "You are a concise customer support agent. Use tools before answering policy questions.",
    model: {
      provider: "openai.responses",
      modelId: "gpt-4.1-mini",
      label: "openai.responses/gpt-4.1-mini",
    },
    providerOptions: { openai: { reasoningEffort: "low" } },
    tools: [SEARCH_DOCS_TOOL],
    policy: { maxSteps: 4, allowedTools: ["searchDocs"] },
    publishedAt: AGENTS_MOCK_ANCHOR_MS - 28 * DAY,
    publishedBy: "ernesto",
    gitSha: "8b3c1a9",
    aiSdkVersion: "6.0.170",
    metadata: { owner: "support-platform", environment: "demo" },
    inputContractPreview: SUPPORT_INPUT_PREVIEW,
    outputContractPreview: SUPPORT_OUTPUT_PREVIEW,
    knowledgeSources: SUPPORT_KNOWLEDGE,
    workflowGraphPreview: {
      nodes: SUPPORT_GRAPH.nodes.filter((n) => n.id !== "esc" && n.id !== "branch"),
      edges: [
        { from: "in", to: "search" },
        { from: "search", to: "model" },
        { from: "model", to: "out" },
      ],
    },
  },
  {
    name: "support-agent",
    version: "1.1.0",
    description: "Refines policy guidance and adds escalation path.",
    framework: "vercel-ai-sdk",
    instructions:
      "You are a precise customer support agent. Cite the policy doc you used when explaining decisions, and escalate to a human when refunds are involved.",
    model: {
      provider: "openai.responses",
      modelId: "gpt-4.1-mini",
      label: "openai.responses/gpt-4.1-mini",
    },
    providerOptions: { openai: { reasoningEffort: "low" } },
    tools: [SEARCH_DOCS_TOOL, ESCALATE_TOOL],
    policy: {
      maxSteps: 5,
      allowedTools: ["searchDocs", "escalateToHuman"],
      approvalRequired: ["escalateToHuman"],
    },
    publishedAt: AGENTS_MOCK_ANCHOR_MS - 14 * DAY,
    publishedBy: "ernesto",
    gitSha: "1f44a07",
    aiSdkVersion: "6.0.170",
    metadata: { owner: "support-platform", environment: "demo" },
    inputContractPreview: SUPPORT_INPUT_PREVIEW,
    outputContractPreview: SUPPORT_OUTPUT_PREVIEW,
    knowledgeSources: SUPPORT_KNOWLEDGE,
    workflowGraphPreview: SUPPORT_GRAPH,
  },
  {
    name: "support-agent",
    version: "1.2.0",
    description:
      "Promotes the docs tool to v2 (topic ranking) and switches to gpt-4.1.",
    framework: "vercel-ai-sdk",
    instructions:
      "You are a precise customer support agent. Cite the policy doc you used when explaining decisions, and escalate to a human when refunds are involved. Prefer the topic-ranked search.",
    model: {
      provider: "openai.responses",
      modelId: "gpt-4.1",
      label: "openai.responses/gpt-4.1",
    },
    providerOptions: { openai: { reasoningEffort: "medium" } },
    tools: [SEARCH_DOCS_TOOL_V2, ESCALATE_TOOL, FETCH_ORDER_TOOL],
    policy: {
      maxSteps: 6,
      allowedTools: ["searchDocs", "escalateToHuman", "fetchOrder"],
      approvalRequired: ["escalateToHuman"],
    },
    publishedAt: AGENTS_MOCK_ANCHOR_MS - 4 * DAY,
    publishedBy: "alex",
    gitSha: "c7e2bd1",
    aiSdkVersion: "6.0.170",
    metadata: { owner: "support-platform", environment: "production" },
    inputContractPreview: SUPPORT_INPUT_PREVIEW,
    outputContractPreview: SUPPORT_OUTPUT_PREVIEW,
    knowledgeSources: SUPPORT_KNOWLEDGE,
    workflowGraphPreview: {
      nodes: [
        ...SUPPORT_GRAPH.nodes,
        {
          id: "fetch",
          kind: "tool",
          label: "fetchOrder",
          toolName: "fetchOrder",
        },
      ],
      edges: [
        ...SUPPORT_GRAPH.edges,
        { from: "model", to: "fetch", label: "needs order" },
        { from: "fetch", to: "out" },
      ],
    },
  },
];

const REFUND_AGENT_VERSIONS: ArtifactSeed[] = [
  {
    name: "refund-agent",
    version: "0.4.0",
    description: "Drafts refund decisions; requires reviewer approval to act.",
    framework: "openai-agents",
    instructions:
      "You are a refund analyst. Look up the order, summarize the relevant policy, and propose a refund amount in cents.",
    model: {
      provider: "openai",
      modelId: "gpt-4o-mini",
      label: "openai/gpt-4o-mini",
    },
    providerOptions: { openai: { reasoningEffort: "low" } },
    tools: [FETCH_ORDER_TOOL, SEARCH_DOCS_TOOL, REFUND_TOOL],
    policy: {
      maxSteps: 4,
      allowedTools: ["fetchOrder", "searchDocs", "issueRefund"],
      approvalRequired: ["issueRefund"],
    },
    publishedAt: AGENTS_MOCK_ANCHOR_MS - 21 * DAY,
    publishedBy: "alex",
    gitSha: "2a91c00",
    frameworkVersion: "0.0.21",
    metadata: { owner: "trust-and-safety", environment: "staging" },
    inputContractPreview: REFUND_INPUT_PREVIEW,
    outputContractPreview: REFUND_OUTPUT_PREVIEW,
    knowledgeSources: REFUND_KNOWLEDGE,
    workflowGraphPreview: {
      nodes: REFUND_GRAPH.nodes.filter((n) => n.id !== "tone"),
      edges: [
        { from: "in", to: "fetch" },
        { from: "fetch", to: "policy" },
        { from: "policy", to: "model" },
        { from: "model", to: "out" },
      ],
    },
  },
  {
    name: "refund-agent",
    version: "0.5.0",
    description: "Adds sentiment-aware tone for the refund explanation.",
    framework: "openai-agents",
    instructions:
      "You are a refund analyst. Look up the order, summarize the relevant policy, and propose a refund amount in cents. Adapt your tone to the customer's sentiment.",
    model: {
      provider: "openai",
      modelId: "gpt-4o-mini",
      label: "openai/gpt-4o-mini",
    },
    providerOptions: { openai: { reasoningEffort: "low" } },
    tools: [FETCH_ORDER_TOOL, SEARCH_DOCS_TOOL, REFUND_TOOL, ANALYZE_TOOL],
    policy: {
      maxSteps: 5,
      allowedTools: [
        "fetchOrder",
        "searchDocs",
        "issueRefund",
        "analyzeSentiment",
      ],
      approvalRequired: ["issueRefund"],
    },
    publishedAt: AGENTS_MOCK_ANCHOR_MS - 7 * DAY,
    publishedBy: "alex",
    gitSha: "5d77ee2",
    frameworkVersion: "0.0.23",
    metadata: { owner: "trust-and-safety", environment: "staging" },
    inputContractPreview: REFUND_INPUT_PREVIEW,
    outputContractPreview: REFUND_OUTPUT_PREVIEW,
    knowledgeSources: REFUND_KNOWLEDGE,
    workflowGraphPreview: REFUND_GRAPH,
  },
];

const TRIAGE_AGENT_VERSIONS: ArtifactSeed[] = [
  {
    name: "triage-router",
    version: "2.1.0",
    description: "Routes incoming messages to the right downstream agent.",
    framework: "langchain",
    instructions:
      "Route the user's message to one of: support, refund, escalations, or noop. Return only the route name.",
    model: {
      provider: "anthropic",
      modelId: "claude-3-5-sonnet-20241022",
      label: "anthropic/claude-3-5-sonnet",
    },
    tools: [],
    policy: { maxSteps: 1 },
    publishedAt: AGENTS_MOCK_ANCHOR_MS - 60 * DAY,
    publishedBy: "ernesto",
    gitSha: "f01ddee",
    frameworkVersion: "0.3.27",
    metadata: { owner: "support-platform", environment: "production" },
    inputContractPreview: TRIAGE_INPUT_PREVIEW,
    outputContractPreview: {
      schemaSummary: "{ route: 'support' | 'refund' | 'noop' }",
      example: { route: "support" },
    },
    workflowGraphPreview: {
      nodes: [
        { id: "in", kind: "input", label: "Inbound message" },
        { id: "model", kind: "model", label: "Classify" },
        { id: "out", kind: "output", label: "→ route" },
      ],
      edges: [
        { from: "in", to: "model" },
        { from: "model", to: "out" },
      ],
    },
  },
  {
    name: "triage-router",
    version: "2.2.0",
    description: "Adds early signal escape hatch for billing emergencies.",
    framework: "langchain",
    instructions:
      "Route the user's message to one of: support, refund, escalations, or noop. If the message mentions chargeback or fraud, return escalations regardless of other signals.",
    model: {
      provider: "anthropic",
      modelId: "claude-3-5-sonnet-20241022",
      label: "anthropic/claude-3-5-sonnet",
    },
    tools: [],
    policy: { maxSteps: 1 },
    publishedAt: AGENTS_MOCK_ANCHOR_MS - 9 * DAY,
    publishedBy: "ernesto",
    gitSha: "9d1b3a4",
    frameworkVersion: "0.3.29",
    metadata: { owner: "support-platform", environment: "production" },
    inputContractPreview: TRIAGE_INPUT_PREVIEW,
    outputContractPreview: TRIAGE_OUTPUT_PREVIEW,
    workflowGraphPreview: TRIAGE_GRAPH,
  },
];

const RESEARCH_AGENT_VERSIONS: ArtifactSeed[] = [
  {
    name: "research-bot",
    version: "0.9.0",
    description: "Drafts research summaries from internal datasets.",
    framework: "mastra",
    instructions:
      "Summarize the supplied research notes. Be terse. Cite the dataset id you cited from.",
    model: {
      provider: "openai",
      modelId: "gpt-4o",
      label: "openai/gpt-4o",
    },
    tools: [SEARCH_DOCS_TOOL],
    policy: { maxSteps: 3, allowedTools: ["searchDocs"] },
    publishedAt: AGENTS_MOCK_ANCHOR_MS - 45 * DAY,
    publishedBy: "alex",
    gitSha: "11ba2c0",
    frameworkVersion: "0.7.1",
    metadata: { owner: "research", environment: "staging" },
    inputContractPreview: RESEARCH_INPUT_PREVIEW,
    outputContractPreview: RESEARCH_OUTPUT_PREVIEW,
    knowledgeSources: RESEARCH_KNOWLEDGE,
    workflowGraphPreview: RESEARCH_GRAPH,
  },
];

const KNOWLEDGE_AGENT_VERSIONS: ArtifactSeed[] = [
  {
    name: "knowledge-rag",
    version: "1.3.0",
    description: "RAG-style answer agent over the internal docs corpus.",
    framework: "llamaindex",
    instructions:
      "Use the retriever to ground your answer in cited documents. Refuse to answer if no supporting passage is found.",
    model: {
      provider: "openai",
      modelId: "gpt-4o-mini",
      label: "openai/gpt-4o-mini",
    },
    tools: [SEARCH_DOCS_TOOL_V2],
    policy: { maxSteps: 3, allowedTools: ["searchDocs"] },
    publishedAt: AGENTS_MOCK_ANCHOR_MS - 38 * DAY,
    publishedBy: "ernesto",
    gitSha: "ab33c01",
    frameworkVersion: "0.11.4",
    metadata: { owner: "knowledge", environment: "production" },
    inputContractPreview: KNOWLEDGE_INPUT_PREVIEW,
    outputContractPreview: KNOWLEDGE_OUTPUT_PREVIEW,
    knowledgeSources: KNOWLEDGE_RAG_SOURCES,
    workflowGraphPreview: KNOWLEDGE_GRAPH,
  },
];

const ALL_VERSION_SEEDS: ArtifactSeed[] = [
  ...SUPPORT_AGENT_VERSIONS,
  ...REFUND_AGENT_VERSIONS,
  ...TRIAGE_AGENT_VERSIONS,
  ...RESEARCH_AGENT_VERSIONS,
  ...KNOWLEDGE_AGENT_VERSIONS,
];

const ALL_ARTIFACTS: AgentArtifact[] = ALL_VERSION_SEEDS.map(buildArtifact);

/* ── Run synthesis ─────────────────────────────────────────── */

function buildToolCalls(
  artifact: AgentArtifact,
  runStartedAt: number,
  runIndex: number,
  forceError = false,
): readonly AgentToolCall[] {
  if (artifact.tools.length === 0) return [];
  const calls: AgentToolCall[] = [];
  const callCount = artifact.policy?.maxSteps
    ? Math.min(artifact.policy.maxSteps, range(0, 2) + 1)
    : range(1, 2);

  let cursor = runStartedAt + 200;
  for (let i = 0; i < callCount; i++) {
    const tool = artifact.tools[i % artifact.tools.length];
    const dur = range(180, 1800);
    const startedAt = cursor;
    const finishedAt = cursor + dur;
    cursor = finishedAt + 50;

    const errored = forceError && i === callCount - 1;
    calls.push({
      callId: shortRunId(`${artifact.artifactId}:${runIndex}:${i}`),
      toolName: tool.name,
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date(finishedAt).toISOString(),
      durationMs: dur,
      status: errored ? "error" : "success",
      argsHash: fakeSha256(`args:${artifact.artifactId}:${runIndex}:${i}`),
      resultHash: errored
        ? undefined
        : fakeSha256(`result:${artifact.artifactId}:${runIndex}:${i}`),
      argsPreview:
        tool.name === "searchDocs"
          ? { query: pick(SEARCH_QUERIES) }
          : tool.name === "fetchOrder"
            ? { orderId: `ord_${pick(ORDER_IDS)}` }
            : tool.name === "issueRefund"
              ? {
                  orderId: `ord_${pick(ORDER_IDS)}`,
                  amountCents: range(500, 4900),
                }
              : tool.name === "escalateToHuman"
                ? { reason: pick(ESCALATION_REASONS) }
                : tool.name === "analyzeSentiment"
                  ? { text: pick(USER_QUERIES) }
                  : undefined,
      error: errored
        ? {
            name: "ToolExecutionError",
            message: `${tool.name} failed: upstream timeout`,
          }
        : undefined,
    });
  }

  return calls;
}

const SEARCH_QUERIES = [
  "refund window for trial customers",
  "how to cancel an active subscription",
  "shipping policy for international orders",
  "data export GDPR requirements",
  "two-factor authentication setup",
];

const ORDER_IDS = ["8810", "9023", "9114", "9201", "9355", "9412", "9504"];

const USER_QUERIES = [
  "I need to cancel and get my money back today.",
  "How do I export my conversation history?",
  "Is there a way to merge two accounts?",
  "Why was my order flagged for fraud review?",
  "Can you explain why my refund hasn't shown up yet?",
];

const ESCALATION_REASONS = [
  "Customer requested manual review of refund eligibility.",
  "Trust & safety flag triggered on chargeback signal.",
  "Edge case not covered by current policy doc.",
];

const ENVIRONMENTS = ["production", "staging", "demo", "local"] as const;
const USER_IDS = [
  "user_42",
  "user_109",
  "user_237",
  "user_512",
  "user_777",
  "user_891",
] as const;

function buildRun(
  artifact: AgentArtifact,
  runIndex: number,
  startedAt: number,
  options: {
    status: AgentRun["status"];
    forceModelDrift?: boolean;
    forceServiceTier?: "default" | "scale" | "priority";
  },
): AgentRun {
  const operation: AgentRun["operation"] = random() > 0.85 ? "stream" : "generate";
  const baseDur = artifact.policy?.maxSteps
    ? 1200 + range(200, 4500)
    : 800 + range(200, 1500);
  const durationMs = options.status === "error" ? range(800, 5500) : baseDur;
  const finishedAt = startedAt + durationMs;

  const toolCalls = buildToolCalls(
    artifact,
    startedAt,
    runIndex,
    options.status === "error" && random() > 0.5,
  );

  const inputTokens = range(80, 380);
  const outputTokens = options.status === "success" ? range(40, 220) : range(20, 90);
  const reasoningTokens =
    artifact.providerOptions &&
    typeof artifact.providerOptions === "object" &&
    "openai" in artifact.providerOptions
      ? range(0, 60)
      : 0;
  const cachedInputTokens = range(0, Math.min(inputTokens, 80));
  const totalTokens = inputTokens + outputTokens + reasoningTokens;

  const baseModelId = artifact.model.modelId ?? "unknown";
  const resolvedModelId = options.forceModelDrift
    ? `${baseModelId}-2025-06-12`
    : `${baseModelId}-2025-04-14`;

  const serviceTier = options.forceServiceTier ?? "default";

  return {
    schemaVersion: "agent-run-v1",
    runId: shortRunId(`${artifact.artifactId}:run:${runIndex}`),
    artifactId: artifact.artifactId,
    configHash: artifact.configHash,
    operation,
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date(finishedAt).toISOString(),
    durationMs,
    status: options.status,
    inputHash: fakeSha256(`input:${artifact.artifactId}:${runIndex}`),
    callOptionsHash: fakeSha256(`opts:${artifact.artifactId}:${runIndex}`),
    preparedCall: {
      hash: fakeSha256(`prepared:${artifact.artifactId}:${runIndex}`),
      activeTools: artifact.tools.map((t) => t.name),
      providerOptionsHash: artifact.providerOptionsHash,
    },
    response:
      options.status === "error"
        ? {
            id: undefined,
            modelId: resolvedModelId,
            headers: {
              "x-request-id": `req_${shortRunId(`req:${artifact.artifactId}:${runIndex}`).slice(0, 24)}`,
              "openai-processing-ms": String(range(800, 4500)),
              "openai-organization": "rasa-qwese8",
              "openai-version": "2020-10-01",
              date: new Date(finishedAt).toUTCString(),
              "content-type": "application/json",
            },
            finishReason: "error",
          }
        : {
            id: `resp_${shortRunId(`resp:${artifact.artifactId}:${runIndex}`).replace(/-/g, "").slice(0, 40)}`,
            modelId: resolvedModelId,
            bodyHash: fakeSha256(`body:${artifact.artifactId}:${runIndex}`),
            finishReason: operation === "stream" ? "stop" : "stop",
            usage: {
              inputTokens,
              outputTokens,
              reasoningTokens,
              cachedInputTokens,
              totalTokens,
            },
            providerMetadata: {
              [artifact.model.provider ?? "openai"]: {
                responseId: `resp_${runIndex}`,
                serviceTier,
              },
            },
            modelMetadata: {
              id: resolvedModelId,
              object: "model",
              created: 1744317547,
              ownedBy: "system",
            },
            headers: {
              "x-request-id": `req_${shortRunId(`req:${artifact.artifactId}:${runIndex}`).slice(0, 24)}`,
              "openai-processing-ms": String(range(280, 3200)),
              "openai-organization": "rasa-qwese8",
              "openai-project": "proj_chronicle",
              "openai-version": "2020-10-01",
              "x-ratelimit-remaining-requests": "9999",
              "x-ratelimit-remaining-tokens": "9999682",
              date: new Date(finishedAt).toUTCString(),
              "content-type": "application/json",
              "cf-ray": `9f413036ea${runIndex.toString(16).padStart(4, "0")}55da-LAX`,
            },
          },
    toolCalls,
    trace: {
      userId: pick(USER_IDS),
      environment: pick(ENVIRONMENTS),
    },
    error:
      options.status === "error"
        ? {
            name: "AgentInvocationError",
            message: pick([
              "tool searchDocs returned 502 from upstream",
              "model timeout after 5000ms",
              "no tool result for callId",
              "policy violation: tool not in allowedTools",
            ]),
          }
        : undefined,
  };
}

function synthesizeRunsForArtifact(
  artifact: AgentArtifact,
  options: { runCount: number; driftFromIndex?: number; serviceTierShiftAt?: number },
): readonly AgentRun[] {
  const runs: AgentRun[] = [];
  for (let i = 0; i < options.runCount; i++) {
    const startedAt =
      AGENTS_MOCK_ANCHOR_MS -
      i * (range(15, 95) * 60 * 1000) -
      range(0, 90 * 1000);

    const status: AgentRun["status"] = random() > 0.92 ? "error" : "success";

    const forceModelDrift =
      options.driftFromIndex != null && i <= options.driftFromIndex;

    const forceServiceTier: "default" | "scale" | "priority" =
      options.serviceTierShiftAt != null && i <= options.serviceTierShiftAt
        ? "scale"
        : "default";

    runs.push(
      buildRun(artifact, i, startedAt, {
        status,
        forceModelDrift,
        forceServiceTier,
      }),
    );
  }
  return runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/* ── Snapshot assembly ─────────────────────────────────────── */

function buildVersionSummary(
  artifact: AgentArtifact,
  runs: readonly AgentRun[],
  status: AgentVersionStatus,
): AgentVersionSummary {
  const matching = runs.filter((r) => r.artifactId === artifact.artifactId);
  const successes = matching.filter((r) => r.status === "success");
  const successRate =
    matching.length === 0 ? 0 : successes.length / matching.length;

  const durations = successes
    .map((r) => r.durationMs ?? 0)
    .sort((a, b) => a - b);
  const meanDurationMs =
    durations.length > 0
      ? Math.round(durations.reduce((acc, d) => acc + d, 0) / durations.length)
      : undefined;
  const p95DurationMs =
    durations.length > 0
      ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))]
      : undefined;

  const totalTokens = successes.reduce(
    (acc, r) => acc + (r.response?.usage?.totalTokens ?? 0),
    0,
  );

  const lastRunAt = matching[0]?.startedAt;

  const resolvedModelIds = Array.from(
    new Set(
      matching
        .map((r) => r.response?.modelId)
        .filter((m): m is string => typeof m === "string"),
    ),
  );

  return {
    artifact,
    runCount: matching.length,
    successRate,
    meanDurationMs,
    p95DurationMs,
    totalTokens,
    lastRunAt,
    resolvedModelIds,
    status,
  };
}

function buildSummary(
  artifact: AgentArtifact,
  versions: readonly AgentVersionSummary[],
  runs: readonly AgentRun[],
): AgentSummary {
  const totalRuns = runs.length;
  const successes = runs.filter((r) => r.status === "success").length;
  const successRate = totalRuns === 0 ? 0 : successes / totalRuns;

  const lastRunAt = runs[0]?.startedAt;

  // The "last drift" event is the most recent run with a different
  // resolved modelId from the artifact's declared model id.
  const driftRun = runs.find((r) => {
    const resolved = r.response?.modelId;
    if (!resolved) return false;
    const declared = artifact.model.modelId;
    if (!declared) return false;
    return !resolved.startsWith(declared);
  });

  const versionStatusOrder = versions.map((v) => v.artifact.version);
  versionStatusOrder.sort((a, b) =>
    compareSemverDesc(a, b),
  );

  const storytelling = SUMMARY_STORYTELLING[artifact.name];

  return {
    name: artifact.name,
    description: artifact.description,
    framework: artifact.framework,
    latestVersion: versionStatusOrder[0] ?? artifact.version,
    versionCount: versions.length,
    totalRuns,
    successRate,
    lastRunAt,
    lastDriftAt: driftRun?.startedAt,
    modelLabel: artifact.model.label,
    model: artifact.model,
    owner: (artifact.metadata?.owner as string | undefined) ?? undefined,
    environment:
      (artifact.metadata?.environment as string | undefined) ?? undefined,
    purpose: storytelling?.purpose,
    personaSummary: storytelling?.personaSummary,
    capabilityTags: storytelling?.capabilityTags,
    category: storytelling?.category,
    playgroundUrl: storytelling?.playgroundUrl,
    runbookUrl: storytelling?.runbookUrl,
  };
}

function compareSemverDesc(a: string, b: string): number {
  const ax = a.split(".").map((n) => parseInt(n, 10) || 0);
  const bx = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(ax.length, bx.length); i++) {
    const av = ax[i] ?? 0;
    const bv = bx[i] ?? 0;
    if (av !== bv) return bv - av;
  }
  return 0;
}

/* ── Hash index assembly ───────────────────────────────────── */

function indexArtifact(artifact: AgentArtifact): HashIndexEntry[] {
  const observedAt = artifact.provenance.createdAt;
  const entries: HashIndexEntry[] = [];

  const push = (
    kind: HashDomain,
    hash: string | undefined,
    path: string,
    preview?: string,
  ) => {
    if (!hash) return;
    entries.push({
      hash,
      kind,
      artifactId: artifact.artifactId,
      framework: artifact.framework,
      path,
      preview,
      observedAt,
    });
  };

  push(
    "agent.root",
    artifact.configHash,
    "artifact.configHash",
    `${artifact.name}@${artifact.version}`,
  );
  push(
    "prompt",
    artifact.instructionsHash,
    "artifact.instructions",
    artifact.instructions?.slice(0, 80),
  );
  push(
    "model.contract",
    fakeSha256(`model:${artifact.artifactId}:${artifact.model.label}`),
    "artifact.model",
    artifact.model.label,
  );
  push(
    "provider.options",
    artifact.providerOptionsHash,
    "artifact.providerOptions",
    artifact.providerOptions ? JSON.stringify(artifact.providerOptions) : undefined,
  );
  push(
    "tool.contract",
    fakeSha256(
      `tools:${artifact.artifactId}:${artifact.tools.map((t) => `${t.name}:${t.inputSchemaHash}`).join("|")}`,
    ),
    "artifact.tools",
    `${artifact.tools.length} tools`,
  );
  for (const tool of artifact.tools) {
    push(
      "tool.contract",
      tool.inputSchemaHash,
      `artifact.tools.${tool.name}.inputSchema`,
      tool.description,
    );
  }
  push(
    "runtime.policy",
    fakeSha256(`policy:${artifact.artifactId}:${JSON.stringify(artifact.policy ?? {})}`),
    "artifact.policy",
    artifact.policy
      ? `maxSteps=${artifact.policy.maxSteps ?? "—"} · ${(artifact.policy.allowedTools ?? []).length} tools allowed`
      : undefined,
  );
  push(
    "dependency",
    artifact.provenance.dependencyLockHash,
    "artifact.dependencyLockHash",
    artifact.provenance.aiSdkVersion ?? artifact.provenance.frameworkVersion,
  );

  return entries;
}

function indexRun(run: AgentRun, artifact: AgentArtifact): HashIndexEntry[] {
  const observedAt = run.finishedAt ?? run.startedAt;
  const entries: HashIndexEntry[] = [];

  if (run.preparedCall) {
    entries.push({
      hash: run.preparedCall.hash,
      kind: "effective.run",
      artifactId: run.artifactId,
      runId: run.runId,
      framework: artifact.framework,
      path: "run.preparedCall",
      preview: (run.preparedCall.activeTools ?? []).join(", "),
      observedAt,
    });
  }

  entries.push({
    hash: fakeSha256(`obs:${run.runId}`),
    kind: "provider.observation",
    artifactId: run.artifactId,
    runId: run.runId,
    framework: artifact.framework,
    path: "run.provider.observation",
    preview: run.response?.modelId,
    observedAt,
  });

  entries.push({
    hash: fakeSha256(`op:${run.runId}`),
    kind: "operational",
    artifactId: run.artifactId,
    runId: run.runId,
    framework: artifact.framework,
    path: "run.operational",
    preview: `${run.durationMs ?? "—"}ms · status ${run.status}`,
    observedAt,
  });

  if (run.response?.bodyHash) {
    entries.push({
      hash: run.response.bodyHash,
      kind: "output",
      artifactId: run.artifactId,
      runId: run.runId,
      framework: artifact.framework,
      path: "run.output.responseBody",
      preview: `${run.response.usage?.totalTokens ?? "—"} tokens`,
      observedAt,
    });
  }

  return entries;
}

/* ── Public seeds ──────────────────────────────────────────── */

function buildAgentSnapshot(
  name: string,
  versionStatuses: Record<string, AgentVersionStatus>,
  runCounts: Record<string, number>,
  driftConfig?: Record<string, { driftFromIndex?: number; serviceTierShiftAt?: number }>,
): AgentSnapshot {
  const artifacts = ALL_ARTIFACTS.filter((a) => a.name === name).sort((a, b) =>
    compareSemverDesc(a.version, b.version),
  );

  const allRuns: AgentRun[] = [];
  for (const artifact of artifacts) {
    const cfg = driftConfig?.[artifact.version];
    const runs = synthesizeRunsForArtifact(artifact, {
      runCount: runCounts[artifact.version] ?? 0,
      driftFromIndex: cfg?.driftFromIndex,
      serviceTierShiftAt: cfg?.serviceTierShiftAt,
    });
    allRuns.push(...runs);
  }
  allRuns.sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const versions = artifacts.map((artifact) =>
    buildVersionSummary(
      artifact,
      allRuns,
      versionStatuses[artifact.version] ?? "stable",
    ),
  );

  const latestArtifact = artifacts[0]; // sorted desc above
  const summary = buildSummary(latestArtifact, versions, allRuns);

  // Hash index = artifacts + runs.
  const hashIndex: HashIndexEntry[] = [];
  for (const artifact of artifacts) {
    hashIndex.push(...indexArtifact(artifact));
  }
  for (const run of allRuns) {
    const artifact = artifacts.find((a) => a.artifactId === run.artifactId);
    if (artifact) hashIndex.push(...indexRun(run, artifact));
  }

  return {
    summary,
    versions,
    runs: allRuns,
    hashIndex,
  };
}

const supportSnapshot = buildAgentSnapshot(
  "support-agent",
  { "1.0.0": "deprecated", "1.1.0": "stable", "1.2.0": "current" },
  { "1.0.0": 6, "1.1.0": 9, "1.2.0": 12 },
  {
    "1.0.0": { driftFromIndex: 2 },
    "1.2.0": { serviceTierShiftAt: 1 },
  },
);

const refundSnapshot = buildAgentSnapshot(
  "refund-agent",
  { "0.4.0": "deprecated", "0.5.0": "current" },
  { "0.4.0": 5, "0.5.0": 8 },
);

const triageSnapshot = buildAgentSnapshot(
  "triage-router",
  { "2.1.0": "deprecated", "2.2.0": "current" },
  { "2.1.0": 4, "2.2.0": 14 },
  { "2.2.0": { driftFromIndex: 0 } },
);

const researchSnapshot = buildAgentSnapshot(
  "research-bot",
  { "0.9.0": "current" },
  { "0.9.0": 3 },
);

const knowledgeSnapshot = buildAgentSnapshot(
  "knowledge-rag",
  { "1.3.0": "current" },
  { "1.3.0": 7 },
);

/* ── Manager seed ──────────────────────────────────────────── */

export const agentsManagerSeed: readonly AgentSummary[] = [
  supportSnapshot.summary,
  refundSnapshot.summary,
  triageSnapshot.summary,
  knowledgeSnapshot.summary,
  researchSnapshot.summary,
];

export const agentSnapshotsByName: Readonly<Record<string, AgentSnapshot>> = {
  "support-agent": supportSnapshot,
  "refund-agent": refundSnapshot,
  "triage-router": triageSnapshot,
  "research-bot": researchSnapshot,
  "knowledge-rag": knowledgeSnapshot,
};

/** Cross-cutting seed for the standalone Hash Index page. */
export const globalHashIndexSeed: readonly HashIndexEntry[] = [
  ...supportSnapshot.hashIndex,
  ...refundSnapshot.hashIndex,
  ...triageSnapshot.hashIndex,
  ...researchSnapshot.hashIndex,
  ...knowledgeSnapshot.hashIndex,
];

/* ── Manifest diff (Compare tab) ───────────────────────────── */

/**
 * Produces a domain-grouped list of changes between two artifacts.
 * Mirrors the wrapper's `diffManifests` helper but classifies changes
 * by hash domain so the UI can render Same/Changed sections.
 */
export function diffArtifacts(
  before: AgentArtifact,
  after: AgentArtifact,
): readonly AgentManifestDiffRow[] {
  const rows: AgentManifestDiffRow[] = [];

  const compare = (
    domain: HashDomain,
    path: string,
    a: unknown,
    b: unknown,
  ) => {
    const same = JSON.stringify(a) === JSON.stringify(b);
    rows.push({ domain, path, before: a, after: b, unchanged: same });
  };

  compare("prompt", "instructions", before.instructions, after.instructions);
  compare(
    "prompt",
    "instructionsHash",
    before.instructionsHash,
    after.instructionsHash,
  );

  compare("model.contract", "model.provider", before.model.provider, after.model.provider);
  compare("model.contract", "model.modelId", before.model.modelId, after.model.modelId);
  compare("model.contract", "model.label", before.model.label, after.model.label);

  compare(
    "provider.options",
    "providerOptions",
    before.providerOptions ?? null,
    after.providerOptions ?? null,
  );

  // Tools: diff as a name-keyed map, surface adds/removes/edits.
  const beforeByName = new Map(before.tools.map((t) => [t.name, t]));
  const afterByName = new Map(after.tools.map((t) => [t.name, t]));
  const allNames = new Set<string>([
    ...beforeByName.keys(),
    ...afterByName.keys(),
  ]);
  for (const name of Array.from(allNames).sort()) {
    const a = beforeByName.get(name);
    const b = afterByName.get(name);
    compare("tool.contract", `tools.${name}`, a ?? null, b ?? null);
  }

  compare(
    "runtime.policy",
    "policy",
    before.policy ?? null,
    after.policy ?? null,
  );

  compare(
    "dependency",
    "provenance.aiSdkVersion",
    before.provenance.aiSdkVersion ?? null,
    after.provenance.aiSdkVersion ?? null,
  );
  compare(
    "dependency",
    "provenance.frameworkVersion",
    before.provenance.frameworkVersion ?? null,
    after.provenance.frameworkVersion ?? null,
  );
  compare(
    "dependency",
    "provenance.dependencyLockHash",
    before.provenance.dependencyLockHash ?? null,
    after.provenance.dependencyLockHash ?? null,
  );
  compare(
    "dependency",
    "provenance.gitSha",
    before.provenance.gitSha ?? null,
    after.provenance.gitSha ?? null,
  );

  return rows;
}

/** True when at least one row in the diff is changed for the given domain. */
export function diffDomainStatus(
  rows: readonly AgentManifestDiffRow[],
  domain: HashDomain,
): "same" | "changed" {
  const inDomain = rows.filter((r) => r.domain === domain);
  if (inDomain.length === 0) return "same";
  return inDomain.every((r) => r.unchanged) ? "same" : "changed";
}

/**
 * Returns drift transitions for a snapshot — one entry per
 * (resolvedModelId / serviceTier) flip across the run history.
 */
export function buildDriftEntries(
  snapshot: AgentSnapshot,
): readonly AgentDriftEntry[] {
  const ordered = [...snapshot.runs].sort((a, b) =>
    a.startedAt.localeCompare(b.startedAt),
  );
  const entries: AgentDriftEntry[] = [];

  let prevModelId: string | undefined;
  let prevServiceTier: string | undefined;

  for (const run of ordered) {
    const modelId = run.response?.modelId;
    const tier =
      typeof run.response?.providerMetadata === "object" &&
      run.response.providerMetadata
        ? Object.values(run.response.providerMetadata).map((v) => {
            if (v && typeof v === "object" && "serviceTier" in v) {
              return (v as { serviceTier?: string }).serviceTier;
            }
            return undefined;
          })[0]
        : undefined;

    if (modelId && prevModelId && modelId !== prevModelId) {
      entries.push({
        observedAt: run.finishedAt ?? run.startedAt,
        runId: run.runId,
        artifactId: run.artifactId,
        summary: "Resolved model id changed",
        before: { modelId: prevModelId },
        after: { modelId },
      });
    }

    if (tier && prevServiceTier && tier !== prevServiceTier) {
      entries.push({
        observedAt: run.finishedAt ?? run.startedAt,
        runId: run.runId,
        artifactId: run.artifactId,
        summary: "Service tier shifted",
        before: { serviceTier: prevServiceTier },
        after: { serviceTier: tier },
      });
    }

    prevModelId = modelId ?? prevModelId;
    prevServiceTier = tier ?? prevServiceTier;
  }

  // Newest first to match the rest of the UI.
  return entries.reverse();
}

/* ── Re-exported domain list ───────────────────────────────── */
// `ARTIFACT_HASH_DOMAINS` and `RUN_HASH_DOMAINS` are exported from
// `./types` directly — kept here as an internal re-export for the
// other helpers in this file.
