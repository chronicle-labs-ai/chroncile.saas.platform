/*
 * Agents — types for the Agent Versioning surface.
 *
 * These are TS mirrors of the shapes produced by the
 * `agent-versioning-excersize` wrapper:
 *
 *   - `AgentArtifact`   ↔  `AgentManifest`   (one immutable per name@version)
 *   - `AgentRun`        ↔  `RunRecord`       (many per artifact)
 *   - `AgentToolCall`   ↔  `ToolCallRecord`
 *   - `HashIndexEntry`  ↔  hash-tree index entry (cross-domain lookups)
 *
 * The UI is read-only over these shapes — no mutations, no new fields.
 * Anything we surface in the dashboard must be derivable from the
 * registry's existing data.
 *
 * `AgentSummary` and `AgentSnapshot` are local UI projections that roll
 * artifacts + runs together for the manager / detail-page surfaces.
 * They are NOT part of the wrapper's contract.
 */

/* ── Hash domains ──────────────────────────────────────────── */

/**
 * The 13 hash domains the wrapper tracks. The first eight describe the
 * artifact (config-time); the last five describe a run (observed at
 * call-time).
 */
export type HashDomain =
  | "agent.root"
  | "prompt"
  | "model.contract"
  | "provider.options"
  | "tool.contract"
  | "runtime.policy"
  | "dependency"
  | "knowledge.contract"
  | "workflow.graph"
  | "effective.run"
  | "provider.observation"
  | "operational"
  | "output";

export const ARTIFACT_HASH_DOMAINS: readonly HashDomain[] = [
  "prompt",
  "model.contract",
  "provider.options",
  "tool.contract",
  "runtime.policy",
  "dependency",
  "knowledge.contract",
  "workflow.graph",
];

export const RUN_HASH_DOMAINS: readonly HashDomain[] = [
  "effective.run",
  "provider.observation",
  "operational",
  "output",
];

/* ── Framework registry ────────────────────────────────────── */

/**
 * Framework label is metadata only — the design system surfaces it as a
 * small badge but never as a primary filter. Mirrors the adapter layer
 * in `packages/adapter-*` and `packages/python-adapters/*`.
 */
export type AgentFramework =
  | "vercel-ai-sdk"
  | "openai-agents"
  | "langchain"
  | "mastra"
  | "langchain-python"
  | "llamaindex"
  | "crewai"
  | "smolagents"
  | "pydantic-ai"
  | "strands"
  | "google-adk"
  | "openai-agents-python"
  | "autogen";

/* ── Run status ────────────────────────────────────────────── */

export type AgentRunStatus = "started" | "success" | "error";
export type AgentRunOperation = "generate" | "stream";

/* ── Tool + policy ─────────────────────────────────────────── */

export interface AgentToolDefinition {
  name: string;
  description?: string;
  inputSchemaHash?: string;
  /** Optional small input-schema preview rendered in the Tools tab.
   *  Carrying it on the artifact saves us a round-trip when the user
   *  inspects a tool. */
  inputSchemaPreview?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface AgentPolicy {
  maxSteps?: number;
  allowedTools?: readonly string[];
  approvalRequired?: readonly string[];
  metadata?: Record<string, unknown>;
}

export interface AgentModelDescriptor {
  provider?: string;
  modelId?: string;
  label: string;
}

/* ── Artifact (one per name@version) ───────────────────────── */

export interface AgentArtifact {
  schemaVersion: "agent-artifact-v1";
  name: string;
  version: string;
  artifactId: string;
  description?: string;
  framework: AgentFramework;
  instructions?: string;
  instructionsHash?: string;
  model: AgentModelDescriptor;
  providerOptions?: Record<string, unknown>;
  providerOptionsHash?: string;
  tools: readonly AgentToolDefinition[];
  policy?: AgentPolicy;
  metadata?: Record<string, unknown>;
  provenance: {
    aiSdkVersion?: string;
    frameworkVersion?: string;
    gitSha?: string;
    dependencyLockHash?: string;
    createdAt: string;
    publishedBy?: string;
  };
  configHash: string;
}

/* ── Run + tool call ───────────────────────────────────────── */

export interface AgentToolCall {
  callId: string;
  toolName: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  status: AgentRunStatus;
  argsHash?: string;
  resultHash?: string;
  /** Optional small preview of the tool args rendered in the run drawer. */
  argsPreview?: Record<string, unknown>;
  resultPreview?: Record<string, unknown>;
  error?: {
    name?: string;
    message: string;
    stack?: string;
  };
}

export interface AgentRunUsage {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  totalTokens?: number;
}

export interface AgentRunResponse {
  id?: string;
  modelId?: string;
  bodyHash?: string;
  finishReason?: string;
  usage?: AgentRunUsage;
  providerMetadata?: Record<string, unknown>;
  modelMetadata?: Record<string, unknown>;
  /** Subset of headers the wrapper preserves; we surface the
   *  interesting ones (request id, processing-ms, service tier). */
  headers?: Record<string, string>;
}

export interface AgentRun {
  schemaVersion: "agent-run-v1";
  runId: string;
  artifactId: string;
  configHash: string;
  operation: AgentRunOperation;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  status: AgentRunStatus;
  inputHash?: string;
  callOptionsHash?: string;
  preparedCall?: {
    hash: string;
    activeTools?: readonly string[];
    providerOptionsHash?: string;
  };
  response?: AgentRunResponse;
  toolCalls: readonly AgentToolCall[];
  trace?: Record<string, string>;
  error?: {
    name?: string;
    message: string;
    stack?: string;
  };
}

/* ── Hash index ────────────────────────────────────────────── */

export interface HashIndexEntry {
  hash: string;
  kind: HashDomain;
  artifactId?: string;
  runId?: string;
  framework?: AgentFramework;
  path: string;
  /** Stringified preview of the value rendered next to the hash. */
  preview?: string;
  observedAt: string;
}

/* ── UI projections ────────────────────────────────────────── */

/**
 * Roll-up of one (name, version) inside an agent's history. Pre-computed
 * from runs so the version timeline can render without re-scanning the
 * full run list. Mirrors `DatasetCluster` in spirit.
 */
export interface AgentVersionSummary {
  artifact: AgentArtifact;
  /** Runs observed against this version. */
  runCount: number;
  /** Successful runs / total runs (0..1). */
  successRate: number;
  /** Mean duration across successful runs (ms). */
  meanDurationMs?: number;
  /** p95 duration across successful runs (ms). */
  p95DurationMs?: number;
  /** Total token usage across runs. */
  totalTokens?: number;
  /** ISO of the most recent run against this version. */
  lastRunAt?: string;
  /** Set of resolved modelIds the wrapper has observed against this
   *  artifact. When > 1, the version has experienced model drift. */
  resolvedModelIds: readonly string[];
  /** "current" tones the row in ember; "deprecated" greys it out. */
  status: AgentVersionStatus;
}

export type AgentVersionStatus = "current" | "stable" | "deprecated" | "draft";

/**
 * Manager-row projection — the data needed to render an agent in the
 * grid/list before the user opens its detail page.
 */
export interface AgentSummary {
  name: string;
  description?: string;
  framework: AgentFramework;
  /** Most-recently-published version. */
  latestVersion: string;
  /** Total number of versions in the registry for this agent. */
  versionCount: number;
  /** Total runs across all versions. */
  totalRuns: number;
  /** Successful runs / total runs (0..1) across all versions. */
  successRate: number;
  /** ISO of the most recent run. */
  lastRunAt?: string;
  /** Last drift event, if any (resolved-model change, service-tier
   *  shift, etc). Used by the manager card's secondary line. */
  lastDriftAt?: string;
  /** Convenience label rendered when the structured `model` shape
   *  isn't useful (e.g. plain text mentions). */
  modelLabel: string;
  /** Structured model descriptor for the latest version. Drives the
   *  company-logo prefixed label rendered on cards / rows. */
  model: AgentModelDescriptor;
  /** Owner / environment label from artifact metadata. */
  owner?: string;
  environment?: string;
}

/**
 * Full data the agent detail page needs to render every tab.
 * Loaded once and threaded through the component tree.
 */
export interface AgentSnapshot {
  summary: AgentSummary;
  /** Versions ordered newest first. */
  versions: readonly AgentVersionSummary[];
  /** Runs across all versions, ordered newest first. */
  runs: readonly AgentRun[];
  /** Per-domain hash-index entries observed for this agent (artifacts
   *  + runs). The Hash Index page uses a global pool that includes
   *  these too. */
  hashIndex: readonly HashIndexEntry[];
}

/* ── Diff helpers (Compare tab) ────────────────────────────── */

/**
 * One row in the structured diff between two artifacts. The Compare
 * tab groups these by `domain` and renders a Same/Changed badge per
 * group.
 */
export interface AgentManifestDiffRow {
  domain: HashDomain;
  /** JSON path within the domain ("model.modelId", "tools.searchDocs.inputSchemaHash", …). */
  path: string;
  before: unknown;
  after: unknown;
  /** Convenience flag — true when before/after are deep-equal. */
  unchanged: boolean;
}

/* ── Drift entry ───────────────────────────────────────────── */

/**
 * One row in the Drift tab. The wrapper writes
 * `provider.observation` entries per run — we collapse consecutive
 * observations with the same shape and surface only the transitions.
 */
export interface AgentDriftEntry {
  observedAt: string;
  runId: string;
  artifactId: string;
  /** Short verb summarizing the change ("model resolved id changed",
   *  "service tier shifted", …). */
  summary: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}
