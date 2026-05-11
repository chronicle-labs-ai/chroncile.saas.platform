/*
 * Support-flow agents seed.
 *
 * One agent — `support-agent` — with three versions, the latest
 * "current". Run records pin to the seven trace blueprints in
 * `_scenarios/support-flow.ts`, so a navigation from a run drawer
 * to the timeline lands on the same conversation.
 */

import {
  AgentSnapshotSchema,
  AgentSummarySchema,
  HashIndexEntrySchema,
} from "chronicle/schemas/agents";
import type {
  AgentArtifact,
  AgentRun,
  AgentSnapshot,
  AgentSummary,
  AgentToolCall,
  AgentVersionSummary,
  HashDomain,
  HashIndexEntry,
} from "chronicle/types/agents";
import { z } from "zod";

import { validateInDev } from "../_validate";
import {
  SUPPORT_FLOW_AGENT_NAME,
  SUPPORT_FLOW_AGENT_CURRENT,
  SUPPORT_FLOW_AGENT_VERSIONS,
  SUPPORT_FLOW_ANCHOR_MS,
  SUPPORT_FLOW_TRACES,
  type SupportFlowAgentVersion,
  type SupportFlowEventTpl,
  type SupportFlowTrace,
} from "../_scenarios/support-flow";
import type { AgentsSeed, AgentsSeedData } from "./types";

const AgentSummaryListSchema = z.array(AgentSummarySchema);
const AgentSnapshotMapSchema = z.record(AgentSnapshotSchema);
const HashIndexEntryListSchema = z.array(HashIndexEntrySchema);

const ANCHOR = SUPPORT_FLOW_ANCHOR_MS;
const iso = (offsetMin: number) =>
  new Date(ANCHOR - offsetMin * 60_000).toISOString();

/* ── Tools shared across versions ─────────────────────── */

const TOOL_LOOKUP_CUSTOMER = {
  name: "lookupCustomer",
  description:
    "Fetch a customer profile from Intercom by email or conversation id.",
  inputSchemaHash: "sha256:1f5e1ade",
  inputSchemaPreview: {
    type: "object",
    properties: { email: { type: "string" } },
    required: ["email"],
  },
};
const TOOL_SEARCH_ORDERS = {
  name: "searchOrders",
  description:
    "Look up an order on Shopify by id, customer email, or order number.",
  inputSchemaHash: "sha256:7c33ab92",
  inputSchemaPreview: {
    type: "object",
    properties: { orderId: { type: "string" } },
    required: ["orderId"],
  },
};
const TOOL_PROCESS_REFUND = {
  name: "processRefund",
  description:
    "Issue a refund or schedule a subscription cancellation through Stripe.",
  inputSchemaHash: "sha256:9bdb1f04",
  inputSchemaPreview: {
    type: "object",
    properties: {
      chargeId: { type: "string" },
      amount: { type: "number" },
    },
  },
};
const TOOL_ESCALATE_TO_HUMAN = {
  name: "escalateToHuman",
  description:
    "Post a notification in #cx-alerts and hand the conversation to a teammate.",
  inputSchemaHash: "sha256:08aa4612",
  inputSchemaPreview: {
    type: "object",
    properties: { channel: { type: "string" }, priority: { type: "string" } },
    required: ["channel"],
  },
};

const TOOLS_BY_VERSION: Record<SupportFlowAgentVersion, AgentArtifact["tools"]> = {
  "1.0.0": [TOOL_SEARCH_ORDERS, TOOL_ESCALATE_TO_HUMAN],
  "1.1.0": [
    TOOL_SEARCH_ORDERS,
    TOOL_LOOKUP_CUSTOMER,
    TOOL_PROCESS_REFUND,
    TOOL_ESCALATE_TO_HUMAN,
  ],
  "1.2.0": [
    TOOL_SEARCH_ORDERS,
    TOOL_LOOKUP_CUSTOMER,
    TOOL_PROCESS_REFUND,
    TOOL_ESCALATE_TO_HUMAN,
  ],
};

const KNOWLEDGE_BASE_BY_VERSION: Record<
  SupportFlowAgentVersion,
  AgentArtifact["knowledgeSources"]
> = {
  "1.0.0": undefined,
  "1.1.0": undefined,
  "1.2.0": [
    {
      id: "kb-shipping-policy",
      label: "Shipping policy",
      kind: "doc",
      sizeLabel: "1.2k tokens",
      href: "https://docs.chronicle.io/policies/shipping",
    },
    {
      id: "kb-refund-policy",
      label: "Refund policy",
      kind: "doc",
      sizeLabel: "0.9k tokens",
      href: "https://docs.chronicle.io/policies/refunds",
    },
  ],
};

const PUBLISHED_AT_BY_VERSION: Record<SupportFlowAgentVersion, string> = {
  "1.0.0": iso(112 * 24 * 60),
  "1.1.0": iso(60 * 24 * 60),
  "1.2.0": iso(11 * 24 * 60),
};

function artifactFor(version: SupportFlowAgentVersion): AgentArtifact {
  return {
    schemaVersion: "agent-artifact-v1",
    name: SUPPORT_FLOW_AGENT_NAME,
    version,
    artifactId: `art_support_${version.replace(/\./g, "_")}`,
    description:
      "Frontline customer-support agent. Reads incoming Intercom messages, looks up orders + customers, refunds when policy allows, and escalates to a human via Slack otherwise.",
    framework: "vercel-ai-sdk",
    instructions:
      "You are the Chronicle support agent. Resolve order, refund, and policy questions using the tools provided. When in doubt, escalate to #cx-alerts via Slack rather than guess.",
    instructionsHash: `sha256:prompt_${version}`,
    model: {
      provider: "openai",
      modelId: version === "1.0.0" ? "gpt-4o-mini" : "gpt-4o",
      label: version === "1.0.0" ? "OpenAI GPT-4o-mini" : "OpenAI GPT-4o",
    },
    providerOptions: { temperature: 0.2 },
    providerOptionsHash: `sha256:provider_${version}`,
    tools: TOOLS_BY_VERSION[version] as AgentArtifact["tools"],
    policy: {
      maxSteps: 6,
      allowedTools: TOOLS_BY_VERSION[version].map((t) => t.name),
      approvalRequired: ["processRefund"],
    },
    metadata: { owner: "support@chronicle.io", environment: "production" },
    provenance: {
      aiSdkVersion: "ai@4.1.0",
      frameworkVersion: "vercel-ai-sdk@4.1",
      gitSha: `abc${version.replace(/\./g, "")}`,
      dependencyLockHash: `sha256:lock_${version}`,
      createdAt: PUBLISHED_AT_BY_VERSION[version],
      publishedBy: "naomi@chronicle.io",
    },
    configHash: `sha256:config_${version}`,
    inputContractPreview: {
      schemaSummary: "{ message: string; conversationId: string }",
      example: { message: "Where's my order?", conversationId: "c_48c1" },
    },
    outputContractPreview: {
      schemaSummary: "{ reply: string; nextAction?: 'reply' | 'escalate' }",
      example: { reply: "Order shipped via DHL — ETA Apr 30.", nextAction: "reply" },
    },
    knowledgeSources: KNOWLEDGE_BASE_BY_VERSION[version],
    workflowGraphPreview: {
      nodes: [
        { id: "n_in", kind: "input", label: "Conversation in" },
        { id: "n_lookup", kind: "tool", label: "lookupCustomer", toolName: "lookupCustomer" },
        { id: "n_search", kind: "tool", label: "searchOrders", toolName: "searchOrders" },
        { id: "n_branch", kind: "branch", label: "Within policy?" },
        { id: "n_refund", kind: "tool", label: "processRefund", toolName: "processRefund" },
        { id: "n_escalate", kind: "tool", label: "escalateToHuman", toolName: "escalateToHuman" },
        { id: "n_out", kind: "output", label: "Reply" },
      ],
      edges: [
        { from: "n_in", to: "n_lookup" },
        { from: "n_lookup", to: "n_search" },
        { from: "n_search", to: "n_branch" },
        { from: "n_branch", to: "n_refund", label: "yes" },
        { from: "n_branch", to: "n_escalate", label: "no" },
        { from: "n_refund", to: "n_out" },
        { from: "n_escalate", to: "n_out" },
      ],
    },
  };
}

/* ── Run + tool-call materialisation per trace ────────── */

function toolCallsFromTrace(trace: SupportFlowTrace): AgentToolCall[] {
  const startMs = ANCHOR - trace.startMinutesBack * 60_000;
  const out: AgentToolCall[] = [];
  for (let i = 0; i < trace.events.length; i += 1) {
    const ev = trace.events[i];
    if (ev.source !== "agent" || ev.type !== "tool.call") continue;
    /* Pair with the next non-agent event that responds to it. */
    const reply = nextReplyEvent(trace.events, i);
    const toolName = (ev.message ?? "").split("(")[0].trim();
    out.push({
      callId: `call_${trace.traceId}_${i}`,
      toolName,
      startedAt: new Date(startMs + ev.delayMs).toISOString(),
      finishedAt: reply
        ? new Date(startMs + reply.delayMs).toISOString()
        : undefined,
      durationMs: reply ? reply.delayMs - ev.delayMs : undefined,
      status:
        reply && (reply.type.includes("error") || reply.type.includes("not_found"))
          ? "error"
          : "success",
      argsHash: `sha256:args_${trace.traceId}_${i}`,
      resultHash: `sha256:res_${trace.traceId}_${i}`,
      argsPreview: { call: ev.message },
      resultPreview: reply ? { summary: reply.message } : undefined,
    });
  }
  return out;
}

function nextReplyEvent(
  events: readonly SupportFlowEventTpl[],
  fromIdx: number,
): SupportFlowEventTpl | undefined {
  for (let j = fromIdx + 1; j < events.length; j += 1) {
    if (events[j].source !== "agent") return events[j];
  }
  return undefined;
}

function runFromTrace(trace: SupportFlowTrace, version: string): AgentRun {
  const startMs = ANCHOR - trace.startMinutesBack * 60_000;
  const status =
    trace.status === "ok" ? "success" : trace.status === "warn" ? "success" : "error";
  return {
    schemaVersion: "agent-run-v1",
    runId: `run_${trace.traceId}`,
    artifactId: `art_support_${version.replace(/\./g, "_")}`,
    configHash: `sha256:config_${version}`,
    operation: "generate",
    startedAt: new Date(startMs).toISOString(),
    finishedAt: new Date(startMs + trace.durationMs).toISOString(),
    durationMs: trace.durationMs,
    status,
    inputHash: `sha256:input_${trace.traceId}`,
    callOptionsHash: `sha256:opts_${version}`,
    preparedCall: {
      hash: `sha256:prep_${trace.traceId}`,
      activeTools: TOOLS_BY_VERSION[version as SupportFlowAgentVersion].map(
        (t) => t.name,
      ),
      providerOptionsHash: `sha256:provider_${version}`,
    },
    response: {
      id: `resp_${trace.traceId}`,
      modelId: version === "1.0.0" ? "gpt-4o-mini-2024-07-18" : "gpt-4o-2024-11-20",
      bodyHash: `sha256:body_${trace.traceId}`,
      finishReason: status === "error" ? "error" : "stop",
      usage: {
        inputTokens: 240 + Math.floor(trace.events.length * 18),
        outputTokens: 40 + Math.floor(trace.events.length * 9),
        totalTokens: 280 + Math.floor(trace.events.length * 27),
      },
      headers: {
        "x-request-id": `req_${trace.traceId}`,
        "openai-version": "2020-10-01",
      },
    },
    toolCalls: toolCallsFromTrace(trace),
    trace: {
      traceId: trace.traceId,
      conversation: trace.label,
      customer: trace.customer,
    },
    error:
      status === "error"
        ? {
            name: "OrderNotFound",
            message: "Order id not present in the connected Shopify shop",
          }
        : undefined,
  };
}

/* ── Aggregate the snapshot ──────────────────────────── */

const ALL_RUNS: AgentRun[] = SUPPORT_FLOW_TRACES.map((t) =>
  runFromTrace(t, SUPPORT_FLOW_AGENT_CURRENT),
);

function versionSummary(version: SupportFlowAgentVersion): AgentVersionSummary {
  const runsForVersion = version === SUPPORT_FLOW_AGENT_CURRENT ? ALL_RUNS : [];
  const successes = runsForVersion.filter((r) => r.status === "success").length;
  return {
    artifact: artifactFor(version),
    runCount: runsForVersion.length,
    successRate:
      runsForVersion.length > 0 ? successes / runsForVersion.length : 0,
    meanDurationMs:
      runsForVersion.length > 0
        ? Math.round(
            runsForVersion.reduce((acc, r) => acc + (r.durationMs ?? 0), 0) /
              runsForVersion.length,
          )
        : undefined,
    p95DurationMs: runsForVersion.length > 0 ? 4_000 : undefined,
    totalTokens: runsForVersion.reduce(
      (acc, r) => acc + (r.response?.usage?.totalTokens ?? 0),
      0,
    ),
    lastRunAt:
      runsForVersion.length > 0
        ? runsForVersion[0].startedAt
        : undefined,
    resolvedModelIds:
      version === "1.0.0" ? ["gpt-4o-mini-2024-07-18"] : ["gpt-4o-2024-11-20"],
    status:
      version === SUPPORT_FLOW_AGENT_CURRENT
        ? "current"
        : version === "1.1.0"
          ? "stable"
          : "deprecated",
  };
}

const VERSIONS: AgentVersionSummary[] = SUPPORT_FLOW_AGENT_VERSIONS.map(
  versionSummary,
).reverse();

const SUMMARY: AgentSummary = {
  name: SUPPORT_FLOW_AGENT_NAME,
  description:
    "Customer support assistant. Reads Intercom messages, looks up orders and customers, refunds when policy allows, and escalates to humans through Slack otherwise.",
  framework: "vercel-ai-sdk",
  latestVersion: SUPPORT_FLOW_AGENT_CURRENT,
  versionCount: SUPPORT_FLOW_AGENT_VERSIONS.length,
  totalRuns: ALL_RUNS.length,
  successRate:
    ALL_RUNS.filter((r) => r.status === "success").length / ALL_RUNS.length,
  lastRunAt: ALL_RUNS[0]?.startedAt,
  modelLabel: "OpenAI GPT-4o",
  model: { provider: "openai", modelId: "gpt-4o", label: "OpenAI GPT-4o" },
  owner: "support@chronicle.io",
  environment: "production",
  purpose:
    "Resolve order, refund, and policy questions on first response — escalate cleanly when out of scope.",
  personaSummary: "Patient, factual, defers to humans on edge cases.",
  capabilityTags: [
    "Refunds",
    "Order lookup",
    "Subscription mgmt",
    "Slack escalation",
  ],
  category: "Customer support",
  playgroundUrl: "https://playground.chronicle.io/agents/support-agent",
};

const HASH_INDEX: HashIndexEntry[] = (() => {
  const out: HashIndexEntry[] = [];
  /* Per-artifact hashes (one per version × hash-domain). */
  for (const v of SUPPORT_FLOW_AGENT_VERSIONS) {
    const artifact = artifactFor(v);
    const observedAt = artifact.provenance.createdAt;
    const domains: Array<{ domain: HashDomain; hash: string; path: string; preview?: string }> = [
      { domain: "agent.root", hash: artifact.configHash, path: "agent.root" },
      { domain: "prompt", hash: artifact.instructionsHash ?? "", path: "prompt.instructions" },
      {
        domain: "model.contract",
        hash: `sha256:model_${v}`,
        path: "model.contract",
        preview: `${artifact.model.label} · temperature 0.2`,
      },
      {
        domain: "provider.options",
        hash: artifact.providerOptionsHash ?? "",
        path: "provider.options",
      },
      {
        domain: "tool.contract",
        hash: `sha256:tools_${v}`,
        path: "tools[]",
        preview: `${artifact.tools.length} tool(s)`,
      },
      {
        domain: "runtime.policy",
        hash: `sha256:policy_${v}`,
        path: "policy",
      },
    ];
    for (const d of domains) {
      if (!d.hash) continue;
      out.push({
        hash: d.hash,
        kind: d.domain,
        artifactId: artifact.artifactId,
        framework: artifact.framework,
        path: d.path,
        preview: d.preview,
        observedAt,
      });
    }
  }
  /* Per-run effective + observation hashes. */
  for (const run of ALL_RUNS) {
    out.push({
      hash: `sha256:effective_${run.runId}`,
      kind: "effective.run",
      artifactId: run.artifactId,
      runId: run.runId,
      path: "effective.run",
      observedAt: run.startedAt,
    });
    if (run.response?.bodyHash) {
      out.push({
        hash: run.response.bodyHash,
        kind: "output",
        artifactId: run.artifactId,
        runId: run.runId,
        path: "response.body",
        preview: run.response.modelId,
        observedAt: run.finishedAt ?? run.startedAt,
      });
    }
  }
  return out;
})();

const SNAPSHOT: AgentSnapshot = {
  summary: SUMMARY,
  versions: VERSIONS,
  runs: ALL_RUNS,
  hashIndex: HASH_INDEX,
};

/* ── Seed factory ────────────────────────────────────── */

export const supportFlowAgentsSeed: AgentsSeed = {
  id: "support-flow",
  label: "Support flow",
  description:
    "1 agent (`support-agent`) with three versions and seven recent runs covering the typical support outcomes.",
  build(): AgentsSeedData {
    const summaries = structuredClone([SUMMARY]) as AgentSummary[];
    const snapshotsByName = structuredClone({
      [SUPPORT_FLOW_AGENT_NAME]: SNAPSHOT,
    }) as Record<string, AgentSnapshot>;
    const hashIndex = structuredClone(HASH_INDEX) as HashIndexEntry[];

    validateInDev(
      AgentSummaryListSchema,
      summaries,
      "agents:support-flow summaries",
    );
    validateInDev(
      AgentSnapshotMapSchema,
      snapshotsByName,
      "agents:support-flow snapshotsByName",
    );
    validateInDev(
      HashIndexEntryListSchema,
      hashIndex,
      "agents:support-flow hashIndex",
    );

    return { summaries, snapshotsByName, hashIndex };
  },
};
