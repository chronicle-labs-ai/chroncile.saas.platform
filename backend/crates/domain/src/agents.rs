//! Agents — wire shapes for the Agent Versioning surface.
//!
//! Source-of-truth derivation: see `packages/ui/src/agents/types.ts`.
//! Every shape that a dashboard component reads goes through here so
//! the chronicle backend, the `chronicle` data provider, and the
//! design-system components agree on a single set of names + types.
//!
//! Naming + serialization conventions match `domain::datasets`:
//! `#[serde(rename_all = "camelCase")]` on structs,
//! `#[serde(rename_all = "kebab-case")]` on framework / status
//! enums (those have multi-word kebab-case spellings on the wire),
//! `#[serde(rename_all = "lowercase")]` on the simple short-tag enums.

use chrono::{DateTime, Utc};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use ts_rs::TS;

/* ── Hash domains ────────────────────────────────────────── */

/// The 13 hash domains the wrapper tracks. The first eight describe the
/// artifact (config-time); the last five describe a run (observed at
/// call-time).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "kebab-case")]
#[ts(export, export_to = "types/agents/")]
pub enum HashDomain {
    #[serde(rename = "agent.root")]
    AgentRoot,
    #[serde(rename = "prompt")]
    Prompt,
    #[serde(rename = "model.contract")]
    ModelContract,
    #[serde(rename = "provider.options")]
    ProviderOptions,
    #[serde(rename = "tool.contract")]
    ToolContract,
    #[serde(rename = "runtime.policy")]
    RuntimePolicy,
    #[serde(rename = "dependency")]
    Dependency,
    #[serde(rename = "knowledge.contract")]
    KnowledgeContract,
    #[serde(rename = "workflow.graph")]
    WorkflowGraph,
    #[serde(rename = "effective.run")]
    EffectiveRun,
    #[serde(rename = "provider.observation")]
    ProviderObservation,
    #[serde(rename = "operational")]
    Operational,
    #[serde(rename = "output")]
    Output,
}

/* ── Framework registry ─────────────────────────────────── */

/// Framework label. Multi-word kebab-case to match the existing TS
/// union (`vercel-ai-sdk`, `openai-agents-python`, etc.).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "kebab-case")]
#[ts(export, export_to = "types/agents/")]
pub enum AgentFramework {
    VercelAiSdk,
    OpenaiAgents,
    Langchain,
    Mastra,
    LangchainPython,
    Llamaindex,
    Crewai,
    Smolagents,
    PydanticAi,
    Strands,
    GoogleAdk,
    OpenaiAgentsPython,
    Autogen,
}

/* ── Run status ──────────────────────────────────────────── */

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/agents/")]
pub enum AgentRunStatus {
    Started,
    Success,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/agents/")]
pub enum AgentRunOperation {
    Generate,
    Stream,
}

/* ── Tool + policy ──────────────────────────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/agents/")]
pub struct AgentToolDefinition {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub input_schema_hash: Option<String>,
    /// Optional small input-schema preview rendered in the Tools tab.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional, type = "Record<string, unknown>")]
    pub input_schema_preview: Option<HashMap<String, serde_json::Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional, type = "Record<string, unknown>")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/agents/")]
pub struct AgentPolicy {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub max_steps: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub allowed_tools: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub approval_required: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional, type = "Record<string, unknown>")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/agents/")]
pub struct AgentModelDescriptor {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub provider: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub model_id: Option<String>,
    pub label: String,
}

/* ── Storytelling projections ───────────────────────────── */

/// Compact preview of an input or output contract for the artifact's
/// Capabilities section.
#[derive(Debug, Clone, Default, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/agents/")]
pub struct AgentContractPreview {
    /// One-line shape summary.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub schema_summary: Option<String>,
    /// Representative example payload.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional, type = "unknown")]
    pub example: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/agents/")]
pub enum AgentKnowledgeKind {
    Vector,
    Doc,
    Table,
    Graph,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/agents/")]
pub struct AgentKnowledgeSource {
    pub id: String,
    pub label: String,
    pub kind: AgentKnowledgeKind,
    /// Optional human-readable size hint, e.g. "12.4k docs".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub size_label: Option<String>,
    /// Optional jump-out link.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub href: Option<String>,
}

/* ── Workflow graph preview ─────────────────────────────── */

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/agents/")]
pub enum AgentWorkflowNodeKind {
    Input,
    Tool,
    Model,
    Branch,
    Output,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/agents/")]
pub struct AgentWorkflowNode {
    pub id: String,
    pub kind: AgentWorkflowNodeKind,
    pub label: String,
    /// Optional tool name reference for tool nodes.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub tool_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/agents/")]
pub struct AgentWorkflowEdge {
    pub from: String,
    pub to: String,
    /// Optional short label rendered along the edge.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/agents/")]
pub struct AgentWorkflowGraph {
    pub nodes: Vec<AgentWorkflowNode>,
    pub edges: Vec<AgentWorkflowEdge>,
}

/* ── Provenance ─────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/agents/")]
pub struct AgentProvenance {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub ai_sdk_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub framework_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub git_sha: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub dependency_lock_hash: Option<String>,
    pub created_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub published_by: Option<String>,
}

/* ── Artifact ───────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/agents/")]
pub struct AgentArtifact {
    /// Schema marker — frontend code matches against the literal
    /// string `"agent-artifact-v1"` so newer payloads can co-exist
    /// when we evolve the shape.
    pub schema_version: String,
    pub name: String,
    pub version: String,
    pub artifact_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub description: Option<String>,
    pub framework: AgentFramework,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub instructions: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub instructions_hash: Option<String>,
    pub model: AgentModelDescriptor,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional, type = "Record<string, unknown>")]
    pub provider_options: Option<HashMap<String, serde_json::Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub provider_options_hash: Option<String>,
    pub tools: Vec<AgentToolDefinition>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub policy: Option<AgentPolicy>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional, type = "Record<string, unknown>")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    pub provenance: AgentProvenance,
    pub config_hash: String,

    /* ── Storytelling fields ─────────────────────────────── */
    /// Compact preview of the input contract this artifact expects.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub input_contract_preview: Option<AgentContractPreview>,
    /// Compact preview of the output contract this artifact emits.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub output_contract_preview: Option<AgentContractPreview>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub knowledge_sources: Option<Vec<AgentKnowledgeSource>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub workflow_graph_preview: Option<AgentWorkflowGraph>,
}

/* ── Run + tool call ────────────────────────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/agents/")]
pub struct AgentRunError {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub name: Option<String>,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub stack: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/agents/")]
pub struct AgentToolCall {
    pub call_id: String,
    pub tool_name: String,
    pub started_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub finished_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub duration_ms: Option<u32>,
    pub status: AgentRunStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub args_hash: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub result_hash: Option<String>,
    /// Optional small preview of the tool args.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional, type = "Record<string, unknown>")]
    pub args_preview: Option<HashMap<String, serde_json::Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional, type = "Record<string, unknown>")]
    pub result_preview: Option<HashMap<String, serde_json::Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub error: Option<AgentRunError>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/agents/")]
pub struct AgentRunUsage {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub input_tokens: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub output_tokens: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub reasoning_tokens: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub cached_input_tokens: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub total_tokens: Option<u32>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/agents/")]
pub struct AgentRunResponse {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub model_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub body_hash: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub finish_reason: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub usage: Option<AgentRunUsage>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional, type = "Record<string, unknown>")]
    pub provider_metadata: Option<HashMap<String, serde_json::Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional, type = "Record<string, unknown>")]
    pub model_metadata: Option<HashMap<String, serde_json::Value>>,
    /// Subset of headers preserved for the run drawer.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional, type = "Record<string, string>")]
    pub headers: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/agents/")]
pub struct AgentPreparedCall {
    pub hash: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub active_tools: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub provider_options_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/agents/")]
pub struct AgentRun {
    pub schema_version: String,
    pub run_id: String,
    pub artifact_id: String,
    pub config_hash: String,
    pub operation: AgentRunOperation,
    pub started_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub finished_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub duration_ms: Option<u32>,
    pub status: AgentRunStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub input_hash: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub call_options_hash: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub prepared_call: Option<AgentPreparedCall>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub response: Option<AgentRunResponse>,
    pub tool_calls: Vec<AgentToolCall>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional, type = "Record<string, string>")]
    pub trace: Option<HashMap<String, String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub error: Option<AgentRunError>,
}

/* ── Hash index ─────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/agents/")]
pub struct HashIndexEntry {
    pub hash: String,
    pub kind: HashDomain,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub artifact_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub run_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub framework: Option<AgentFramework>,
    pub path: String,
    /// Stringified preview of the value rendered next to the hash.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub preview: Option<String>,
    pub observed_at: DateTime<Utc>,
}

/* ── Version + summary projections ──────────────────────── */

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "types/agents/")]
pub enum AgentVersionStatus {
    Current,
    Stable,
    Deprecated,
    Draft,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/agents/")]
pub struct AgentVersionSummary {
    pub artifact: AgentArtifact,
    pub run_count: u32,
    /// Successful runs / total runs (0..1).
    pub success_rate: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub mean_duration_ms: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub p95_duration_ms: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub total_tokens: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub last_run_at: Option<DateTime<Utc>>,
    pub resolved_model_ids: Vec<String>,
    pub status: AgentVersionStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/agents/")]
pub struct AgentSummary {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub description: Option<String>,
    pub framework: AgentFramework,
    pub latest_version: String,
    pub version_count: u32,
    pub total_runs: u32,
    pub success_rate: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub last_run_at: Option<DateTime<Utc>>,
    /// Last drift event, if any.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub last_drift_at: Option<DateTime<Utc>>,
    pub model_label: String,
    pub model: AgentModelDescriptor,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub owner: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub environment: Option<String>,

    /* ── Storytelling fields ─────────────────────────────── */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub purpose: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub persona_summary: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub capability_tags: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub category: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub playground_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub runbook_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/agents/")]
pub struct AgentSnapshot {
    pub summary: AgentSummary,
    pub versions: Vec<AgentVersionSummary>,
    pub runs: Vec<AgentRun>,
    pub hash_index: Vec<HashIndexEntry>,
}

/* ── Diff + drift ───────────────────────────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/agents/")]
pub struct AgentManifestDiffRow {
    pub domain: HashDomain,
    /// JSON path within the domain.
    pub path: String,
    #[ts(type = "unknown")]
    pub before: serde_json::Value,
    #[ts(type = "unknown")]
    pub after: serde_json::Value,
    /// True when before/after are deep-equal.
    pub unchanged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "types/agents/")]
pub struct AgentDriftEntry {
    pub observed_at: DateTime<Utc>,
    pub run_id: String,
    pub artifact_id: String,
    /// Short verb summarizing the change.
    pub summary: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional, type = "Record<string, unknown>")]
    pub before: Option<HashMap<String, serde_json::Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional, type = "Record<string, unknown>")]
    pub after: Option<HashMap<String, serde_json::Value>>,
}
