import type {
  AgentEndpointResponse,
  AuditLogListResponse,
  AuthResponse,
  ConnectionListResponse,
  ConnectionResponse,
  CreateRunRequest,
  DashboardActivityResponse,
  DashboardStatsResponse,
  DeployTriggerRequest,
  DeployedTriggersResponse,
  FeatureAccessResponse,
  ListRunsResponse,
  PipedreamTokenRequest,
  RunDetailResponse,
  RunResponse,
  SignupRequest,
  TenantResponse,
  UpdateAgentEndpointRequest,
  UpdateRunStatusRequest,
  UpdateStripeRequest,
} from "shared/generated";

export const DEFAULT_BACKEND_URL = "http://localhost:8080";

export function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type TokenProvider = () => string | null | undefined;

class PlatformApi {
  private baseUrl: string;
  private getToken: TokenProvider;

  constructor(baseUrl: string, getToken: TokenProvider) {
    this.baseUrl = baseUrl;
    this.getToken = getToken;
  }

  private async request<T>(
    method: string,
    path: string,
    options?: { body?: unknown; params?: Record<string, string | undefined> },
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) url.searchParams.set(key, value);
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({
        error: response.statusText,
      }));
      throw new ApiError(response.status, err.error || "Request failed");
    }

    if (response.status === 204) return undefined as T;
    return response.json();
  }

  getDashboardStats() {
    return this.request<DashboardStatsResponse>(
      "GET",
      "/api/platform/dashboard/stats",
    );
  }

  getDashboardActivity() {
    return this.request<DashboardActivityResponse>(
      "GET",
      "/api/platform/dashboard/activity",
    );
  }

  getFeatureAccess() {
    return this.request<FeatureAccessResponse>(
      "GET",
      "/api/platform/feature-access",
    );
  }

  listRuns(params?: { status?: string; limit?: number; offset?: number }) {
    return this.request<ListRunsResponse>("GET", "/api/platform/runs", {
      params: {
        status: params?.status,
        limit: params?.limit?.toString(),
        offset: params?.offset?.toString(),
      },
    });
  }

  createRun(body: CreateRunRequest) {
    return this.request<RunResponse>("POST", "/api/platform/runs", { body });
  }

  getRun(id: string) {
    return this.request<RunDetailResponse>(
      "GET",
      `/api/platform/runs/${id}`,
    );
  }

  updateRunStatus(id: string, body: UpdateRunStatusRequest) {
    return this.request<RunResponse>("PUT", `/api/platform/runs/${id}`, {
      body,
    });
  }

  getAgentEndpoint() {
    return this.request<AgentEndpointResponse>(
      "GET",
      "/api/platform/settings/agent-endpoint",
    );
  }

  updateAgentEndpoint(body: UpdateAgentEndpointRequest) {
    return this.request<AgentEndpointResponse>(
      "PUT",
      "/api/platform/settings/agent-endpoint",
      { body },
    );
  }

  listConnections() {
    return this.request<ConnectionListResponse>(
      "GET",
      "/api/platform/connections",
    );
  }

  getConnection(id: string) {
    return this.request<ConnectionResponse>(
      "GET",
      `/api/platform/connections/${id}`,
    );
  }

  deleteConnection(id: string) {
    return this.request<void>(
      "DELETE",
      `/api/platform/connections/${id}`,
    );
  }

  listAuditLogs(params?: { limit?: number; offset?: number }) {
    return this.request<AuditLogListResponse>("GET", "/api/platform/audit", {
      params: {
        limit: params?.limit?.toString(),
        offset: params?.offset?.toString(),
      },
    });
  }

  getTenant() {
    return this.request<TenantResponse>("GET", "/api/platform/tenant");
  }

  updateTenantStripe(body: UpdateStripeRequest) {
    return this.request<TenantResponse>("PUT", "/api/platform/tenant/stripe", {
      body,
    });
  }

  listPipedreamApps(params?: { q?: string; limit?: number }) {
    return this.request<{ data: unknown; pageInfo: unknown }>(
      "GET",
      "/api/platform/pipedream/apps",
      {
        params: {
          q: params?.q,
          limit: params?.limit?.toString(),
        },
      },
    );
  }

  listPipedreamTriggers(params?: {
    app?: string;
    q?: string;
    limit?: number;
  }) {
    return this.request<{ data: unknown; pageInfo: unknown }>(
      "GET",
      "/api/platform/pipedream/triggers",
      {
        params: {
          app: params?.app,
          q: params?.q,
          limit: params?.limit?.toString(),
        },
      },
    );
  }

  deployPipedreamTrigger(body: DeployTriggerRequest) {
    return this.request<{ data: unknown }>(
      "POST",
      "/api/platform/pipedream/triggers/deploy",
      { body },
    );
  }

  listDeployedTriggers() {
    return this.request<DeployedTriggersResponse>(
      "GET",
      "/api/platform/pipedream/triggers/deployed",
    );
  }

  getDeployedTrigger(id: string) {
    return this.request<{ data: unknown }>(
      "GET",
      `/api/platform/pipedream/triggers/deployed/${id}`,
    );
  }

  deleteDeployedTrigger(id: string) {
    return this.request<void>(
      "DELETE",
      `/api/platform/pipedream/triggers/deployed/${id}`,
    );
  }

  createPipedreamToken(body?: PipedreamTokenRequest) {
    return this.request<{ token: string }>(
      "POST",
      "/api/platform/pipedream/token",
      { body: body ?? {} },
    );
  }

  listPipedreamAccounts() {
    return this.request<{ data: unknown }>(
      "GET",
      "/api/platform/pipedream/accounts",
    );
  }

  signup(body: SignupRequest) {
    return this.request<AuthResponse>("POST", "/api/platform/auth/signup", {
      body,
    });
  }

  login(body: { email: string; password: string }) {
    return this.request<AuthResponse>("POST", "/api/platform/auth/login", {
      body,
    });
  }
}

export function createPlatformApi(getToken: TokenProvider): PlatformApi {
  return new PlatformApi(getBackendUrl(), getToken);
}

export type { PlatformApi };
