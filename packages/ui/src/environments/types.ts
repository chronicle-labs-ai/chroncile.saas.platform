export type EnvironmentStatus =
  | "ready"
  | "seeding"
  | "running"
  | "degraded"
  | "needs-reset";

export type EnvironmentView = "list" | "grid";
export type EnvironmentLens =
  | "overview"
  | "tools"
  | "data"
  | "activity"
  | "terminal";

export type EnvironmentToolKind =
  | "mcp"
  | "cli"
  | "api"
  | "database"
  | "filesystem";

export type EnvironmentToolStatus =
  | "available"
  | "faulted"
  | "disabled"
  | "warming";

export type EnvironmentToolMode =
  | "sandboxed-writes"
  | "read-only"
  | "mocked"
  | "replay-backed";

export type EnvironmentToolCategory =
  | "Billing"
  | "Messaging"
  | "CRM"
  | "Database"
  | "Filesystem"
  | "Identity"
  | "Storage"
  | "Compute"
  | "Custom";

/**
 * Catalog entry for the "Add tool" picker. Templates are turned into
 * concrete `EnvironmentTool` rows when the user picks one.
 */
export interface EnvironmentToolTemplate {
  id: string;
  name: string;
  source: string;
  kind: EnvironmentToolKind;
  mode: EnvironmentToolMode;
  category: EnvironmentToolCategory;
  capabilities: readonly string[];
  description: string;
}

export type EnvironmentActivityKind =
  | "seed"
  | "tool"
  | "failure"
  | "agent"
  | "reset";

export interface EnvironmentTool {
  id: string;
  name: string;
  kind: EnvironmentToolKind;
  source: string;
  mode: EnvironmentToolMode;
  status: EnvironmentToolStatus;
  latencyMs: number;
  enabled: boolean;
  capabilities: readonly string[];
  description: string;
}

export interface EnvironmentTraceSeed {
  id: string;
  title: string;
  sources: readonly string[];
  events: number;
  records: number;
  entities: number;
  files: number;
}

export interface EnvironmentDataSnapshot {
  id: string;
  name: string;
  sourceDataset: string;
  seededAt: string;
  scenarios: number;
  entities: number;
  records: number;
  files: number;
  traces: number;
  traceSeeds: readonly EnvironmentTraceSeed[];
}

export interface EnvironmentResources {
  vCpu: number;
  memoryGib: number;
  diskGib: number;
}

export interface EnvironmentScenarioSet {
  id: string;
  name: string;
  description: string;
  count: number;
  coverage: readonly string[];
  recommendedTools: readonly string[];
}

export interface EnvironmentFailure {
  id: string;
  name: string;
  target: string;
  description: string;
  active: boolean;
  severity: "low" | "medium" | "high";
}

export interface EnvironmentAgentIdentity {
  id: string;
  label: string;
  principal: string;
  scopes: readonly string[];
}

export interface EnvironmentActivity {
  id: string;
  kind: EnvironmentActivityKind;
  title: string;
  detail: string;
  at: string;
  actor: string;
}

export interface SandboxExecuteResult {
  output: string;
  exitCode: number;
  sandboxId?: string;
}

export type SandboxExecutor = (
  environmentId: string,
  command: string
) => Promise<SandboxExecuteResult>;

/**
 * Daytona-derived runtime status. Keeps the SDK enum values verbatim so
 * UI lookups are stable regardless of platform changes.
 */
export type SandboxRuntimeStatus =
  | "creating"
  | "starting"
  | "started"
  | "stopping"
  | "stopped"
  | "destroying"
  | "destroyed"
  | "error"
  | "unknown"
  | (string & {});

export interface SandboxLiveStats {
  status: SandboxRuntimeStatus;
  vCpu: number;
  cpuPct: number;
  memoryUsedGib: number;
  memoryTotalGib: number;
  memoryPct: number;
  diskUsedGib: number;
  diskTotalGib: number;
  diskPct: number;
  sandboxId?: string;
}

export interface SandboxLifecycleResult {
  status: SandboxRuntimeStatus;
  sandboxId?: string;
}

export type SandboxStatsFetcher = (
  environmentId: string
) => Promise<SandboxLiveStats>;

export type SandboxLifecycleAction = (
  environmentId: string
) => Promise<SandboxLifecycleResult>;

export interface SandboxEnvironment {
  id: string;
  name: string;
  company: string;
  description: string;
  owner: string;
  status: EnvironmentStatus;
  updatedAt: string;
  eventsPerMin: number;
  activeAgents: number;
  currentSnapshot: EnvironmentDataSnapshot;
  resources: EnvironmentResources;
  scenarioSets: readonly EnvironmentScenarioSet[];
  tools: readonly EnvironmentTool[];
  failures: readonly EnvironmentFailure[];
  agentIdentities: readonly EnvironmentAgentIdentity[];
  activity: readonly EnvironmentActivity[];
  tags: readonly string[];
}
