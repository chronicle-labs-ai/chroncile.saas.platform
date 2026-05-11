/*
 * Chronicle-demo agents seed.
 *
 * Single agent — `billing-agent@1.0.0` — for a subscription SaaS
 * company. Run records pin to the seven trace blueprints in
 * `_scenarios/chronicle-demo.ts`, so a navigation from a run drawer
 * to the timeline lands on the same conversation.
 *
 * Three of the seven runs are flagged by Chronicle as risky despite
 * the agent itself returning `success` — the demo's punchline. The
 * flag copy lives on the trace blueprint and is mirrored in the
 * datasets seed via `TraceSummary.note`.
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
  CHRONICLE_DEMO_AGENT_CURRENT,
  CHRONICLE_DEMO_AGENT_NAME,
  CHRONICLE_DEMO_AGENT_VERSIONS,
  CHRONICLE_DEMO_ANCHOR_MS,
  CHRONICLE_DEMO_TRACES,
  type ChronicleDemoAgentVersion,
  type ChronicleDemoEventTpl,
  type ChronicleDemoTrace,
} from "../_scenarios/chronicle-demo";
import type { AgentsSeed, AgentsSeedData } from "./types";

const AgentSummaryListSchema = z.array(AgentSummarySchema);
const AgentSnapshotMapSchema = z.record(AgentSnapshotSchema);
const HashIndexEntryListSchema = z.array(HashIndexEntrySchema);

const ANCHOR = CHRONICLE_DEMO_ANCHOR_MS;
const iso = (offsetMin: number) =>
  new Date(ANCHOR - offsetMin * 60_000).toISOString();

/* ── Tools ───────────────────────────────────────────── */

const TOOL_LOOKUP_CUSTOMER = {
  name: "lookupCustomer",
  description:
    "Fetch a customer profile from Intercom by email or conversation id.",
  inputSchemaHash: "sha256:cd_lookupCustomer",
  inputSchemaPreview: {
    type: "object",
    properties: { email: { type: "string" } },
    required: ["email"],
  },
};
const TOOL_LOOKUP_ACCOUNT = {
  name: "lookupAccount",
  description:
    "Fetch the company account from Salesforce, including the verified billing owner.",
  inputSchemaHash: "sha256:cd_lookupAccount",
  inputSchemaPreview: {
    type: "object",
    properties: { company: { type: "string" } },
    required: ["company"],
  },
};
const TOOL_CHECK_BILLING = {
  name: "checkBilling",
  description:
    "Read Stripe subscription, charges, and invoices for a customer.",
  inputSchemaHash: "sha256:cd_checkBilling",
  inputSchemaPreview: {
    type: "object",
    properties: {
      customerId: { type: "string" },
      period: { type: "string" },
    },
    required: ["customerId"],
  },
};
const TOOL_ISSUE_REFUND = {
  name: "issueRefund",
  description: "Issue a Stripe refund against a specific charge.",
  inputSchemaHash: "sha256:cd_issueRefund",
  inputSchemaPreview: {
    type: "object",
    properties: {
      chargeId: { type: "string" },
      amount: { type: "number" },
    },
    required: ["chargeId", "amount"],
  },
};
const TOOL_UPDATE_SUBSCRIPTION = {
  name: "updateSubscription",
  description:
    "Update a Stripe subscription — change interval, cancel at period end, etc.",
  inputSchemaHash: "sha256:cd_updateSubscription",
  inputSchemaPreview: {
    type: "object",
    properties: {
      subscriptionId: { type: "string" },
      cancelAtPeriodEnd: { type: "boolean" },
      interval: { type: "string" },
    },
    required: ["subscriptionId"],
  },
};
const TOOL_CHECK_PRODUCT_ACCESS = {
  name: "checkProductAccess",
  description:
    "Read tenant entitlement state from the product database (Postgres).",
  inputSchemaHash: "sha256:cd_checkProductAccess",
  inputSchemaPreview: {
    type: "object",
    properties: { tenantId: { type: "string" } },
    required: ["tenantId"],
  },
};
const TOOL_UPDATE_PRODUCT_ACCESS = {
  name: "updateProductAccess",
  description:
    "Reconcile tenant entitlement in the product database after a billing change.",
  inputSchemaHash: "sha256:cd_updateProductAccess",
  inputSchemaPreview: {
    type: "object",
    properties: {
      tenantId: { type: "string" },
      entitlement: { type: "string" },
    },
    required: ["tenantId", "entitlement"],
  },
};

const TOOLS_BY_VERSION: Record<
  ChronicleDemoAgentVersion,
  AgentArtifact["tools"]
> = {
  "1.0.0": [
    TOOL_LOOKUP_CUSTOMER,
    TOOL_LOOKUP_ACCOUNT,
    TOOL_CHECK_BILLING,
    TOOL_ISSUE_REFUND,
    TOOL_UPDATE_SUBSCRIPTION,
    TOOL_CHECK_PRODUCT_ACCESS,
    TOOL_UPDATE_PRODUCT_ACCESS,
  ],
};

const KNOWLEDGE_BASE_BY_VERSION: Record<
  ChronicleDemoAgentVersion,
  AgentArtifact["knowledgeSources"]
> = {
  "1.0.0": [
    {
      id: "kb-refund-policy",
      label: "Refund policy",
      kind: "doc",
      sizeLabel: "1.4k tokens",
      href: "https://docs.chronicle.io/policies/saas-refunds",
    },
    {
      id: "kb-billing-admin-policy",
      label: "Billing-admin verification",
      kind: "doc",
      sizeLabel: "0.7k tokens",
      href: "https://docs.chronicle.io/policies/billing-admin",
    },
  ],
};

const PUBLISHED_AT_BY_VERSION: Record<ChronicleDemoAgentVersion, string> = {
  "1.0.0": iso(9 * 24 * 60),
};

function artifactFor(version: ChronicleDemoAgentVersion): AgentArtifact {
  return {
    schemaVersion: "agent-artifact-v1",
    name: CHRONICLE_DEMO_AGENT_NAME,
    version,
    artifactId: `art_billing_${version.replace(/\./g, "_")}`,
    description:
      "Billing support agent for a subscription software company. Reads inbound Intercom messages, looks up the customer + Salesforce account, queries Stripe, updates the subscription, reconciles product access, and replies in-conversation.",
    framework: "vercel-ai-sdk",
    instructions:
      "You are the Chronicle billing-support agent. Resolve cancellation, refund, and plan-change requests using the tools provided. Always check the requester is the billing admin before making destructive billing changes; never refund more than policy allows; reconcile product entitlement after billing mutations.",
    instructionsHash: `sha256:cd_prompt_${version}`,
    model: {
      provider: "openai",
      modelId: "gpt-4o",
      label: "OpenAI GPT-4o",
    },
    providerOptions: { temperature: 0.2 },
    providerOptionsHash: `sha256:cd_provider_${version}`,
    tools: TOOLS_BY_VERSION[version] as AgentArtifact["tools"],
    policy: {
      maxSteps: 8,
      allowedTools: TOOLS_BY_VERSION[version].map((t) => t.name),
      approvalRequired: ["issueRefund", "updateSubscription"],
    },
    metadata: { owner: "billing@chronicle.io", environment: "production" },
    provenance: {
      aiSdkVersion: "ai@4.1.0",
      frameworkVersion: "vercel-ai-sdk@4.1",
      gitSha: `cd_${version.replace(/\./g, "")}`,
      dependencyLockHash: `sha256:cd_lock_${version}`,
      createdAt: PUBLISHED_AT_BY_VERSION[version],
      publishedBy: "naomi@chronicle.io",
    },
    configHash: `sha256:cd_config_${version}`,
    inputContractPreview: {
      schemaSummary: "{ message: string; conversationId: string }",
      example: {
        message: "Please cancel my subscription.",
        conversationId: "c_demo01",
      },
    },
    outputContractPreview: {
      schemaSummary: "{ reply: string; nextAction?: 'reply' | 'escalate' }",
      example: {
        reply: "Your subscription is set to cancel at the end of the period.",
        nextAction: "reply",
      },
    },
    knowledgeSources: KNOWLEDGE_BASE_BY_VERSION[version],
    workflowGraphPreview: {
      nodes: [
        { id: "n_in", kind: "input", label: "Conversation in" },
        {
          id: "n_lookup",
          kind: "tool",
          label: "lookupCustomer",
          toolName: "lookupCustomer",
        },
        {
          id: "n_account",
          kind: "tool",
          label: "lookupAccount",
          toolName: "lookupAccount",
        },
        {
          id: "n_billing",
          kind: "tool",
          label: "checkBilling",
          toolName: "checkBilling",
        },
        { id: "n_branch", kind: "branch", label: "What does the user want?" },
        {
          id: "n_refund",
          kind: "tool",
          label: "issueRefund",
          toolName: "issueRefund",
        },
        {
          id: "n_subscription",
          kind: "tool",
          label: "updateSubscription",
          toolName: "updateSubscription",
        },
        {
          id: "n_product",
          kind: "tool",
          label: "updateProductAccess",
          toolName: "updateProductAccess",
        },
        { id: "n_out", kind: "output", label: "Reply" },
      ],
      edges: [
        { from: "n_in", to: "n_lookup" },
        { from: "n_lookup", to: "n_account" },
        { from: "n_account", to: "n_billing" },
        { from: "n_billing", to: "n_branch" },
        { from: "n_branch", to: "n_refund", label: "refund" },
        { from: "n_branch", to: "n_subscription", label: "cancel/change" },
        { from: "n_subscription", to: "n_product" },
        { from: "n_refund", to: "n_out" },
        { from: "n_product", to: "n_out" },
      ],
    },
  };
}

/* ── Run + tool-call materialisation per trace ────────── */

function toolCallsFromTrace(trace: ChronicleDemoTrace): AgentToolCall[] {
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
      argsHash: `sha256:cd_args_${trace.traceId}_${i}`,
      resultHash: `sha256:cd_res_${trace.traceId}_${i}`,
      argsPreview: { call: ev.message },
      resultPreview: reply ? { summary: reply.message } : undefined,
    });
  }
  return out;
}

function nextReplyEvent(
  events: readonly ChronicleDemoEventTpl[],
  fromIdx: number,
): ChronicleDemoEventTpl | undefined {
  for (let j = fromIdx + 1; j < events.length; j += 1) {
    if (events[j].source !== "agent") return events[j];
  }
  return undefined;
}

function runFromTrace(trace: ChronicleDemoTrace, version: string): AgentRun {
  const startMs = ANCHOR - trace.startMinutesBack * 60_000;
  /* `warn` is "agent finished, but Chronicle flagged the outcome" —
     the run itself still returned `success`. `error` is "agent threw"
     which the demo never does. Mirrors support-flow's mapping. */
  const status =
    trace.status === "ok" ? "success" : trace.status === "warn" ? "success" : "error";
  return {
    schemaVersion: "agent-run-v1",
    runId: `run_${trace.traceId}`,
    artifactId: `art_billing_${version.replace(/\./g, "_")}`,
    configHash: `sha256:cd_config_${version}`,
    operation: "generate",
    startedAt: new Date(startMs).toISOString(),
    finishedAt: new Date(startMs + trace.durationMs).toISOString(),
    durationMs: trace.durationMs,
    status,
    inputHash: `sha256:cd_input_${trace.traceId}`,
    callOptionsHash: `sha256:cd_opts_${version}`,
    preparedCall: {
      hash: `sha256:cd_prep_${trace.traceId}`,
      activeTools: TOOLS_BY_VERSION[
        version as ChronicleDemoAgentVersion
      ].map((t) => t.name),
      providerOptionsHash: `sha256:cd_provider_${version}`,
    },
    response: {
      id: `resp_${trace.traceId}`,
      modelId: "gpt-4o-2024-11-20",
      bodyHash: `sha256:cd_body_${trace.traceId}`,
      finishReason: status === "error" ? "error" : "stop",
      usage: {
        inputTokens: 280 + Math.floor(trace.events.length * 22),
        outputTokens: 60 + Math.floor(trace.events.length * 11),
        totalTokens: 340 + Math.floor(trace.events.length * 33),
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
    error: undefined,
  };
}

/* ── Aggregate the snapshot ──────────────────────────── */

const ALL_RUNS: AgentRun[] = CHRONICLE_DEMO_TRACES.map((t) =>
  runFromTrace(t, CHRONICLE_DEMO_AGENT_CURRENT),
);

function versionSummary(
  version: ChronicleDemoAgentVersion,
): AgentVersionSummary {
  const runsForVersion =
    version === CHRONICLE_DEMO_AGENT_CURRENT ? ALL_RUNS : [];
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
    p95DurationMs: runsForVersion.length > 0 ? 3_100 : undefined,
    totalTokens: runsForVersion.reduce(
      (acc, r) => acc + (r.response?.usage?.totalTokens ?? 0),
      0,
    ),
    lastRunAt:
      runsForVersion.length > 0 ? runsForVersion[0].startedAt : undefined,
    resolvedModelIds: ["gpt-4o-2024-11-20"],
    status: version === CHRONICLE_DEMO_AGENT_CURRENT ? "current" : "deprecated",
  };
}

const VERSIONS: AgentVersionSummary[] = CHRONICLE_DEMO_AGENT_VERSIONS.map(
  versionSummary,
);

const SUMMARY: AgentSummary = {
  name: CHRONICLE_DEMO_AGENT_NAME,
  description:
    "Subscription-billing support assistant. Handles cancellations, refunds, and plan changes by reading Intercom, Salesforce, and Stripe and reconciling the product database.",
  framework: "vercel-ai-sdk",
  latestVersion: CHRONICLE_DEMO_AGENT_CURRENT,
  versionCount: CHRONICLE_DEMO_AGENT_VERSIONS.length,
  totalRuns: ALL_RUNS.length,
  successRate:
    ALL_RUNS.filter((r) => r.status === "success").length / ALL_RUNS.length,
  lastRunAt: ALL_RUNS[0]?.startedAt,
  modelLabel: "OpenAI GPT-4o",
  model: { provider: "openai", modelId: "gpt-4o", label: "OpenAI GPT-4o" },
  owner: "billing@chronicle.io",
  environment: "production",
  purpose:
    "Resolve subscription cancellations, refunds, and plan changes on first response — flagged when policy, ownership, or system-state checks should have stopped the action.",
  personaSummary: "Crisp, transactional, defers to policy on edge cases.",
  capabilityTags: [
    "Cancellations",
    "Refunds",
    "Plan changes",
    "Entitlement reconciliation",
  ],
  category: "Billing support",
  playgroundUrl: "https://playground.chronicle.io/agents/billing-agent",
};

const HASH_INDEX: HashIndexEntry[] = (() => {
  const out: HashIndexEntry[] = [];
  /* Per-artifact hashes (one per version × hash-domain). */
  for (const v of CHRONICLE_DEMO_AGENT_VERSIONS) {
    const artifact = artifactFor(v);
    const observedAt = artifact.provenance.createdAt;
    const domains: Array<{
      domain: HashDomain;
      hash: string;
      path: string;
      preview?: string;
    }> = [
      { domain: "agent.root", hash: artifact.configHash, path: "agent.root" },
      {
        domain: "prompt",
        hash: artifact.instructionsHash ?? "",
        path: "prompt.instructions",
      },
      {
        domain: "model.contract",
        hash: `sha256:cd_model_${v}`,
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
        hash: `sha256:cd_tools_${v}`,
        path: "tools[]",
        preview: `${artifact.tools.length} tool(s)`,
      },
      {
        domain: "runtime.policy",
        hash: `sha256:cd_policy_${v}`,
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
      hash: `sha256:cd_effective_${run.runId}`,
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

export const chronicleDemoAgentsSeed: AgentsSeed = {
  id: "chronicle-demo",
  label: "Chronicle demo (billing)",
  description:
    "1 agent (`billing-agent@1.0.0`) with seven runs — four pass, three Chronicle-flagged (unauthorized cancel · over-refund · cross-system mismatch).",
  build(): AgentsSeedData {
    const summaries = structuredClone([SUMMARY]) as AgentSummary[];
    const snapshotsByName = structuredClone({
      [CHRONICLE_DEMO_AGENT_NAME]: SNAPSHOT,
    }) as Record<string, AgentSnapshot>;
    const hashIndex = structuredClone(HASH_INDEX) as HashIndexEntry[];

    validateInDev(
      AgentSummaryListSchema,
      summaries,
      "agents:chronicle-demo summaries",
    );
    validateInDev(
      AgentSnapshotMapSchema,
      snapshotsByName,
      "agents:chronicle-demo snapshotsByName",
    );
    validateInDev(
      HashIndexEntryListSchema,
      hashIndex,
      "agents:chronicle-demo hashIndex",
    );

    return { summaries, snapshotsByName, hashIndex };
  },
};
