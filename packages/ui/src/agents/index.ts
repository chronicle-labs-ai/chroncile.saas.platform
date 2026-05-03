/*
 * Agents — dashboard surfaces for the agent-versioning artifactory.
 *
 * Mirrors the `datasets/` and `connections/` modules. The wrapper at
 * `agent-versioning-excersize` writes immutable `AgentManifest`s and
 * `RunRecord`s plus a flat hash index; this module surfaces every
 * piece of that:
 *
 *   - Manager: list / grid of registered agents
 *   - Detail page: Overview · Versions · Diff · Runs · Tools · Drift
 *   - Run drawer: per-run forensics (manifest, response, tool calls,
 *     headers, errors)
 *   - Hash index page: cross-cutting hash lookup
 *
 * All surfaces are read-only over the registry and accept seed/mock
 * data; a future PR can swap the wrapper's local file registry for an
 * HTTP service without touching the components.
 */

/* ── Top-level surfaces ─────────────────────────────────────── */
export { AgentsManager } from "./agents-manager";
export type {
  AgentsManagerProps,
  AgentsManagerDetailHelpers,
} from "./agents-manager";

export {
  AgentDetailPage,
  AGENT_DETAIL_TABS,
  resolveLegacyAgentDetailTab,
} from "./agent-detail-page";
export type {
  AgentDetailPageProps,
  AgentDetailTab,
} from "./agent-detail-page";

export { AgentRunDetailDrawer } from "./agent-run-detail-drawer";
export type { AgentRunDetailDrawerProps } from "./agent-run-detail-drawer";

export {
  AgentHashIndexPage,
  HashIndexLaunchButton,
} from "./agent-hash-index-page";
export type { AgentHashIndexPageProps } from "./agent-hash-index-page";

/* ── Manager-level pieces ──────────────────────────────────── */
export {
  AgentsToolbar,
  AGENT_HEALTH_FILTERS,
  AGENT_GROUP_BY_OPTIONS,
  matchesHealthFilter,
} from "./agents-toolbar";
export type {
  AgentsToolbarProps,
  AgentsView,
  AgentsGroupBy,
  AgentHealthFilter,
} from "./agents-toolbar";

export { AgentsKpiStrip, AGENTS_KPI_KEYS } from "./agents-kpi-strip";
export type {
  AgentsKpiStripProps,
  AgentsKpiKey,
} from "./agents-kpi-strip";

export { AgentCard } from "./agent-card";
export type { AgentCardProps } from "./agent-card";

export { AgentRow } from "./agent-row";
export type { AgentRowProps } from "./agent-row";

export { AgentEmpty } from "./agent-empty";
export type { AgentEmptyProps } from "./agent-empty";

export { AgentActionsMenu } from "./agent-actions-menu";
export type { AgentActionsMenuProps } from "./agent-actions-menu";

/* ── Detail-level pieces ───────────────────────────────────── */
export { AgentMetricsStrip } from "./agent-metrics-strip";
export type { AgentMetricsStripProps } from "./agent-metrics-strip";

export { AgentVersionTimeline } from "./agent-version-timeline";
export type { AgentVersionTimelineProps } from "./agent-version-timeline";

export { AgentVersionRow } from "./agent-version-row";
export type { AgentVersionRowProps } from "./agent-version-row";

export { AgentVersionCompare } from "./agent-version-compare";
export type { AgentVersionCompareProps } from "./agent-version-compare";

export { AgentRunsTable } from "./agent-runs-table";
export type { AgentRunsTableProps } from "./agent-runs-table";

export { AgentRunRow } from "./agent-run-row";
export type { AgentRunRowProps } from "./agent-run-row";

export { AgentToolsPanel } from "./agent-tools-panel";
export type { AgentToolsPanelProps } from "./agent-tools-panel";

export { AgentDriftTimeline } from "./agent-drift-timeline";
export type { AgentDriftTimelineProps } from "./agent-drift-timeline";

export { AgentPulseBar } from "./agent-pulse-bar";
export type { AgentPulseBarProps } from "./agent-pulse-bar";

export { AgentConfigCanvas } from "./agent-config-canvas";
export type { AgentConfigCanvasProps } from "./agent-config-canvas";

export { AgentWorkflowGraphPreview } from "./agent-workflow-graph-preview";
export type { AgentWorkflowGraphPreviewProps } from "./agent-workflow-graph-preview";

/* ── Atoms ─────────────────────────────────────────────────── */
export { AgentFrameworkBadge } from "./agent-framework-badge";
export type { AgentFrameworkBadgeProps } from "./agent-framework-badge";

export { AgentVersionBadge } from "./agent-version-badge";
export type { AgentVersionBadgeProps } from "./agent-version-badge";

export { AgentModelLabel } from "./agent-model-label";
export type { AgentModelLabelProps } from "./agent-model-label";

export { AgentCompanyMark } from "./agent-company-mark";
export type { AgentCompanyMarkProps } from "./agent-company-mark";

export {
  getCompanyLogoTone,
  useDetectedLogoTone,
} from "./company-tone";
export type {
  CompanyLogoTone,
  UseDetectedLogoToneOptions,
} from "./company-tone";

export { AgentConfigHashChip } from "./agent-config-hash-chip";
export type { AgentConfigHashChipProps } from "./agent-config-hash-chip";

export { HashDomainChip } from "./hash-domain-chip";
export type { HashDomainChipProps } from "./hash-domain-chip";

export { RunStatusDot } from "./run-status-dot";
export type { RunStatusDotProps } from "./run-status-dot";

export { TokenUsageBar } from "./token-usage-bar";
export type { TokenUsageBarProps } from "./token-usage-bar";

/* ── Framework + hash-domain meta ──────────────────────────── */
export {
  FRAMEWORK_META,
  HASH_DOMAIN_META,
  getModelProviderMeta,
} from "./framework-meta";
export type { FrameworkMeta, ModelProviderMeta } from "./framework-meta";

/* ── Types ─────────────────────────────────────────────────── */
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
  AgentRun,
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
  AgentWorkflowGraph,
  AgentWorkflowNodeKind,
  HashDomain,
  HashIndexEntry,
} from "./types";

export { ARTIFACT_HASH_DOMAINS, RUN_HASH_DOMAINS } from "./types";

/* ── Mock seeds for stories + bring-up ─────────────────────── */
export {
  AGENTS_MOCK_ANCHOR_MS,
  agentsManagerSeed,
  agentSnapshotsByName,
  buildDriftEntries,
  diffArtifacts,
  diffDomainStatus,
  globalHashIndexSeed,
} from "./data";
