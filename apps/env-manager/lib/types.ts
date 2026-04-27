import type {
  FeatureAccessSnapshot,
  FeatureFlagDefinition,
  FeatureFlagOverride,
} from "shared/generated";

// ── Environment ──────────────────────────────────────────────────────────────

export type EnvironmentType =
  | "PRODUCTION"
  | "STAGING"
  | "DEVELOPMENT"
  | "LOCAL"
  | "EPHEMERAL";
export type EnvironmentStatus =
  | "RUNNING"
  | "STOPPED"
  | "PROVISIONING"
  | "DESTROYING"
  | "ERROR";

export interface EnvironmentRecord {
  id: string;
  name: string;
  type: EnvironmentType;
  status: EnvironmentStatus;
  gitBranch: string | null;
  gitSha: string | null;
  gitTag: string | null;
  flyAppName: string | null;
  flyAppUrl: string | null;
  flyDbName: string | null;
  vercelUrl: string | null;
  vercelDeploymentId: string | null;
  vercelEnvVarId: string | null;
  isHealthy: boolean;
  lastHealthAt: string | null;
  serviceSecret: string | null;
  provisionLog: string | null;
  errorLog: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Health Checks ────────────────────────────────────────────────────────────

export interface ServiceHealthStatus {
  status: "up" | "down" | "unconfigured";
  latencyMs?: number;
  error?: string;
}

export interface HealthCheckRecord {
  id: string;
  environmentId: string;
  backendStatus: number | null;
  frontendStatus: number | null;
  backendMs: number | null;
  frontendMs: number | null;
  gitSha: string | null;
  serviceStatuses: Record<string, ServiceHealthStatus> | null;
  checkedAt: string;
}

// ── Stress / Load Tests ──────────────────────────────────────────────────────

export type StressTestStatus =
  | "queued"
  | "initializing"
  | "running"
  | "finished"
  | "aborted"
  | "error";

export interface StressTestConfig {
  vus: number;
  duration: string;
  rampUp: string;
  endpoints: string[];
}

export interface StressTestResultSummary {
  avgLatency?: number;
  p95?: number;
  p99?: number;
  rps?: number;
  errorRate?: number;
}

export interface StressTestRecord {
  id: string;
  environmentId: string;
  k6TestRunId: string | null;
  name: string;
  status: StressTestStatus;
  config: StressTestConfig;
  resultSummary: StressTestResultSummary | null;
  k6Url: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

// ── Logs ─────────────────────────────────────────────────────────────────────

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  source: "provision" | "fly-machine" | "fly-runtime" | "vercel-build";
}

export interface LogsResponse {
  provision: LogEntry[];
  fly: LogEntry[];
  vercel: LogEntry[];
  errors: Record<string, string>;
}

export type LogTab = "provision" | "fly" | "vercel";

// ── Environment Stats ────────────────────────────────────────────────────────

export interface EnvironmentStats {
  tenants: number | null;
  users: number | null;
  events: number | null;
  runs: number | null;
  connections: number | null;
  _note?: string | null;
}

// ── Tenants & Orgs ───────────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  stripeSubscriptionStatus: string | null;
  createdAt: string;
  userCount: number;
}

export interface OrgUser {
  id: string;
  email: string;
  name: string | null;
  authProvider: string;
  createdAt: string;
}

export interface TenantFeatureAccessResponse {
  tenant: Tenant | null;
  access: FeatureAccessSnapshot;
  overrides: FeatureFlagOverride[];
}

export interface FeatureFlagDefinitionsResponse {
  flags: FeatureFlagDefinition[];
}

// ── Live Resources ───────────────────────────────────────────────────────────

export interface MachineResource {
  id: string;
  name: string;
  state: string;
  region: string;
  cpus: number | null;
  cpuKind: string;
  memoryMb: number | null;
  imageRef: string | null;
  updatedAt: string;
  createdAt: string;
  checks: Array<{ name: string; status: string; output: string }>;
  events: Array<{
    type: string;
    status: string;
    timestamp: string;
    exitCode: number | null;
  }>;
}

export interface VolumeResource {
  id: string;
  name: string;
  state: string;
  sizeGb: number | null;
  region: string;
  encrypted: boolean;
  attachedMachineId: string | null;
}

export interface ResourcesData {
  machines: MachineResource[];
  volumes: VolumeResource[];
  ips: Array<{ address: string; type: string; region: string }>;
  postgres: {
    name: string;
    url: string;
    storageGb: number;
    volumes: Array<{
      id: string;
      name: string;
      sizeGb: number | null;
      region: string;
    }>;
    machines: Array<{ id: string; state: string; region: string }>;
  } | null;
  metrics: {
    totalCpus: number;
    totalMemoryMb: number;
    runningMachines: number;
    stoppedMachines: number;
    totalMachines: number;
    totalVolumeGb: number;
    totalIps: number;
    dbStorageGb: number;
    dbMachines: number;
  };
}

// ── Metrics ──────────────────────────────────────────────────────────────────

export type TimeWindow = "30m" | "1h" | "6h" | "24h";

export interface MetricSeries {
  series: Array<{ t: number; v: number | null }>;
  current: number | null;
}

export interface MetricsData {
  window: string;
  cpu: MetricSeries;
  memory: MetricSeries;
  disk: MetricSeries;
  requests: MetricSeries;
  netIn: MetricSeries;
  netOut: MetricSeries;
}
