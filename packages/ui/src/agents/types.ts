/*
 * Agents — types for the Agent Versioning surface.
 *
 * Phase A unification: every shape that crosses the wire now lives
 * in `shared/generated` (auto-derived from the matching Rust crates
 * via `cargo run -p gen-contracts`). This file re-exports those for
 * ergonomic imports inside the design system. The constants
 * (`ARTIFACT_HASH_DOMAINS`, `RUN_HASH_DOMAINS`) stay TS-only — they
 * mirror Rust's `HashDomain` enum but the partition is purely a
 * presentation concern, not a wire shape.
 */

import type { HashDomain } from "chronicle/types";

/* ── Re-exports from shared/generated ───────────────────── */

export type {
  AgentArtifact,
  AgentContractPreview,
  AgentDriftEntry,
  AgentFramework,
  AgentKnowledgeKind,
  AgentKnowledgeSource,
  AgentManifestDiffRow,
  AgentModelDescriptor,
  AgentPolicy,
  AgentPreparedCall,
  AgentProvenance,
  AgentRun,
  AgentRunError,
  AgentRunOperation,
  AgentRunResponse,
  AgentRunStatus,
  AgentRunUsage,
  AgentSnapshot,
  AgentSummary,
  AgentToolCall,
  AgentToolDefinition,
  AgentVersionStatus,
  AgentVersionSummary,
  AgentWorkflowEdge,
  AgentWorkflowGraph,
  AgentWorkflowNode,
  AgentWorkflowNodeKind,
  HashDomain,
  HashIndexEntry,
} from "chronicle/types";

/* ── UI-only partitions (mirror Rust enum but not on the wire) */

/** Hash domains attached to an artifact (config-time). */
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

/** Hash domains attached to a run (call-time). */
export const RUN_HASH_DOMAINS: readonly HashDomain[] = [
  "effective.run",
  "provider.observation",
  "operational",
  "output",
];
