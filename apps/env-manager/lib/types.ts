export type EnvironmentType = "PRODUCTION" | "STAGING" | "DEVELOPMENT" | "EPHEMERAL";
export type EnvironmentStatus = "RUNNING" | "STOPPED" | "PROVISIONING" | "DESTROYING" | "ERROR";

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
  provisionLog: string | null;
  errorLog: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthCheckRecord {
  id: string;
  environmentId: string;
  backendStatus: number | null;
  frontendStatus: number | null;
  backendMs: number | null;
  frontendMs: number | null;
  gitSha: string | null;
  checkedAt: string;
}
