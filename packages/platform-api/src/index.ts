import type {
  AgentEndpointResponse,
  AuditLogListResponse,
  AuthResponse,
  ConnectionListResponse,
  ConnectionResponse,
  CreateRunRequest,
  DashboardActivityResponse,
  DashboardStatsResponse,
  FeatureAccessResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ListRunsResponse,
  LoginRequest,
  SandboxAiChatRequest,
  SandboxAiChatResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  RunDetailResponse,
  RunResponse,
  SignupRequest,
  TenantResponse,
  UpdateAgentEndpointRequest,
  UpdateRunStatusRequest,
  UpdateStripeRequest,
} from "shared/generated";

export interface NangoProviderSummary {
  provider: string;
  displayName: string;
  description: string;
  integrationId: string;
  syncName: string;
  model: string;
  connection: ConnectionListResponse["connections"][number] | null;
}

export interface NangoProvidersResponse {
  providers: NangoProviderSummary[];
}

export interface CreateNangoConnectSessionResponse {
  provider: string;
  integrationId: string;
  sessionToken: string;
  expiresAt?: string | null;
}

export interface NangoConnectionActionResponse {
  success: boolean;
  message: string;
  connection?: ConnectionListResponse["connections"][number] | null;
}

export interface IntercomIntegrationResponse {
  provider: string;
  displayName: string;
  description: string;
  transport: "direct";
  isAvailable: boolean;
  connection: ConnectionListResponse["connections"][number] | null;
  setupStatus: string;
  workspaceId?: string | null;
  workspaceName?: string | null;
  workspaceRegion?: string | null;
  connectedAt?: string | null;
  lastReceivedAt?: string | null;
  eventCount?: number | null;
  webhookUrl: string;
}

export interface IntercomAuthorizeResponse {
  authorizeUrl: string;
}

export interface KlaviyoIntegrationResponse {
  provider: string;
  displayName: string;
  description: string;
  transport: "direct";
  isAvailable: boolean;
  connection: ConnectionListResponse["connections"][number] | null;
  setupStatus: string;
  accountId?: string | null;
  accountName?: string | null;
  connectedAt?: string | null;
  lastReceivedAt?: string | null;
  subscribedTopicCount?: number | null;
  eventCount?: number | null;
  webhookUrl: string;
}

export interface KlaviyoAuthorizeResponse {
  authorizeUrl: string;
}

export interface ShopifyIntegrationResponse {
  provider: string;
  displayName: string;
  description: string;
  transport: "direct";
  isAvailable: boolean;
  connection: ConnectionListResponse["connections"][number] | null;
  setupStatus: string;
  shopDomain?: string | null;
  shopName?: string | null;
  connectedAt?: string | null;
  lastReceivedAt?: string | null;
  subscribedTopicCount?: number | null;
  eventCount?: number | null;
  webhookUrl: string;
}

export interface ShopifyAuthorizeRequest {
  shopDomain: string;
}

export interface ShopifyAuthorizeResponse {
  authorizeUrl: string;
}

export interface TrellusIntegrationResponse {
  provider: string;
  displayName: string;
  description: string;
  transport: "webhook";
  connection: ConnectionListResponse["connections"][number] | null;
  webhookUrl?: string | null;
  headerName: string;
  headerValue?: string | null;
  setupStatus: string;
  lastReceivedAt?: string | null;
  eventCount?: number | null;
}

export const DEFAULT_BACKEND_URL = "http://localhost:8080";

export function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
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
    options?: { body?: unknown; params?: Record<string, string | undefined> }
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
      "/api/platform/dashboard/stats"
    );
  }

  getDashboardActivity() {
    return this.request<DashboardActivityResponse>(
      "GET",
      "/api/platform/dashboard/activity"
    );
  }

  getFeatureAccess() {
    return this.request<FeatureAccessResponse>(
      "GET",
      "/api/platform/feature-access"
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
    return this.request<RunDetailResponse>("GET", `/api/platform/runs/${id}`);
  }

  updateRunStatus(id: string, body: UpdateRunStatusRequest) {
    return this.request<RunResponse>("PUT", `/api/platform/runs/${id}`, {
      body,
    });
  }

  getAgentEndpoint() {
    return this.request<AgentEndpointResponse>(
      "GET",
      "/api/platform/settings/agent-endpoint"
    );
  }

  updateAgentEndpoint(body: UpdateAgentEndpointRequest) {
    return this.request<AgentEndpointResponse>(
      "PUT",
      "/api/platform/settings/agent-endpoint",
      { body }
    );
  }

  sandboxAiChat(body: SandboxAiChatRequest) {
    return this.request<SandboxAiChatResponse>(
      "POST",
      "/api/platform/sandboxes/ai/chat",
      { body }
    );
  }

  listConnections() {
    return this.request<ConnectionListResponse>(
      "GET",
      "/api/platform/connections"
    );
  }

  getConnection(id: string) {
    return this.request<ConnectionResponse>(
      "GET",
      `/api/platform/connections/${id}`
    );
  }

  deleteConnection(id: string) {
    return this.request<void>("DELETE", `/api/platform/connections/${id}`);
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

  listNangoProviders() {
    return this.request<NangoProvidersResponse>(
      "GET",
      "/api/platform/integrations/providers"
    );
  }

  listNangoConnections() {
    return this.request<ConnectionListResponse>(
      "GET",
      "/api/platform/integrations/connections"
    );
  }

  createNangoConnectSession(body: { provider: string }) {
    return this.request<CreateNangoConnectSessionResponse>(
      "POST",
      "/api/platform/integrations/connect-session",
      { body }
    );
  }

  syncNangoConnection(body: {
    provider: string;
    connectionId: string;
    providerConfigKey?: string;
  }) {
    return this.request<NangoConnectionActionResponse>(
      "POST",
      "/api/platform/integrations/connections/sync",
      { body }
    );
  }

  triggerNangoSync(body: {
    provider: string;
    syncMode?: string;
    requestedSyncName?: string;
  }) {
    return this.request<NangoConnectionActionResponse>(
      "POST",
      "/api/platform/integrations/sync",
      { body }
    );
  }

  disconnectNango(body: { provider: string }) {
    return this.request<NangoConnectionActionResponse>(
      "POST",
      "/api/platform/integrations/disconnect",
      { body }
    );
  }

  getIntercomIntegration() {
    return this.request<IntercomIntegrationResponse>(
      "GET",
      "/api/platform/integrations/intercom"
    );
  }

  authorizeIntercom() {
    return this.request<IntercomAuthorizeResponse>(
      "POST",
      "/api/platform/integrations/intercom/authorize"
    );
  }

  disconnectIntercom() {
    return this.request<IntercomIntegrationResponse>(
      "POST",
      "/api/platform/integrations/intercom/disconnect"
    );
  }

  getKlaviyoIntegration() {
    return this.request<KlaviyoIntegrationResponse>(
      "GET",
      "/api/platform/integrations/klaviyo"
    );
  }

  authorizeKlaviyo() {
    return this.request<KlaviyoAuthorizeResponse>(
      "POST",
      "/api/platform/integrations/klaviyo/authorize"
    );
  }

  disconnectKlaviyo() {
    return this.request<KlaviyoIntegrationResponse>(
      "POST",
      "/api/platform/integrations/klaviyo/disconnect"
    );
  }

  getShopifyIntegration() {
    return this.request<ShopifyIntegrationResponse>(
      "GET",
      "/api/platform/integrations/shopify"
    );
  }

  authorizeShopify(body: ShopifyAuthorizeRequest) {
    return this.request<ShopifyAuthorizeResponse>(
      "POST",
      "/api/platform/integrations/shopify/authorize",
      { body }
    );
  }

  disconnectShopify() {
    return this.request<ShopifyIntegrationResponse>(
      "POST",
      "/api/platform/integrations/shopify/disconnect"
    );
  }

  getTrellusIntegration() {
    return this.request<TrellusIntegrationResponse>(
      "GET",
      "/api/platform/integrations/trellus"
    );
  }

  setupTrellusIntegration(body?: { rotateSecret?: boolean }) {
    return this.request<TrellusIntegrationResponse>(
      "POST",
      "/api/platform/integrations/trellus/setup",
      { body: body ?? {} }
    );
  }

  rotateTrellusSecret() {
    return this.request<TrellusIntegrationResponse>(
      "POST",
      "/api/platform/integrations/trellus/rotate-secret"
    );
  }

  disconnectTrellus() {
    return this.request<TrellusIntegrationResponse>(
      "POST",
      "/api/platform/integrations/trellus/disconnect"
    );
  }

  signup(body: SignupRequest) {
    return this.request<AuthResponse>("POST", "/api/platform/auth/signup", {
      body,
    });
  }

  login(body: LoginRequest) {
    return this.request<AuthResponse>("POST", "/api/platform/auth/login", {
      body,
    });
  }

  forgotPassword(body: ForgotPasswordRequest) {
    return this.request<ForgotPasswordResponse>(
      "POST",
      "/api/platform/auth/forgot-password",
      { body }
    );
  }

  resetPassword(body: ResetPasswordRequest) {
    return this.request<ResetPasswordResponse>(
      "POST",
      "/api/platform/auth/reset-password",
      { body }
    );
  }
}

export function createPlatformApi(getToken: TokenProvider): PlatformApi {
  return new PlatformApi(getBackendUrl(), getToken);
}

export type { PlatformApi };
