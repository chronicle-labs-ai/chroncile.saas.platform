const PIPEDREAM_API_URL = "https://api.pipedream.com";

const PIPEDREAM_CLIENT_ID = process.env.PIPEDREAM_CLIENT_ID;
const PIPEDREAM_CLIENT_SECRET = process.env.PIPEDREAM_CLIENT_SECRET;
const PIPEDREAM_PROJECT_ID = process.env.PIPEDREAM_PROJECT_ID;
const PIPEDREAM_ENVIRONMENT = (process.env.PIPEDREAM_ENVIRONMENT || "development") as "development" | "production";
const PIPEDREAM_WEBHOOK_URL = process.env.PIPEDREAM_WEBHOOK_URL;

export interface CreateTokenOptions {
  externalUserId: string;
  app?: string;
  allowedOrigins?: string[];
  successRedirectUri?: string;
  errorRedirectUri?: string;
  webhookUri?: string;
}

export interface CreateTokenResponse {
  token: string;
  connect_link_url: string;
  expires_at: string;
}

export interface ConfiguredProps {
  [key: string]: unknown;
}

export interface DeployTriggerOptions {
  id: string;
  externalUserId: string;
  configuredProps?: ConfiguredProps;
  webhookUrl?: string;
  workflowId?: string;
  emitOnDeploy?: boolean;
}

export interface DeployedTrigger {
  id: string;
  owner_id: string;
  component_id: string;
  component_key?: string;
  configurable_props: ConfigurableProp[];
  configured_props: ConfiguredProps;
  active: boolean;
  created_at: number;
  updated_at: number;
  name: string;
  name_slug: string;
}

export interface ConfigurableProp {
  name: string;
  type: string;
  label?: string;
  description?: string;
  optional?: boolean;
  remoteOptions?: boolean;
  reloadProps?: boolean;
  options?: PropOption[];
}

export interface PropOption {
  label: string;
  value: string | number | boolean;
}

export interface TriggerComponent {
  key: string;
  name: string;
  description?: string;
  version: string;
  configurable_props: ConfigurableProp[];
}

export interface App {
  id: string;
  name_slug: string;
  name: string;
  auth_type: string;
  description?: string;
  img_src?: string;
  categories?: string;
}

export interface Account {
  id: string; // apn_xxx
  name: string;
  external_id?: string;
  healthy: boolean;
  dead: boolean;
  app: App;
  created_at: string;
  updated_at: string;
}

export interface ConnectionSuccessWebhook {
  event: "CONNECTION_SUCCESS";
  connect_token: string;
  environment: string;
  connect_session_id: number;
  account: Account;
}

export interface ConnectionErrorWebhook {
  event: "CONNECTION_ERROR";
  connect_token: string;
  environment: string;
  connect_session_id: number;
  error: string;
}

export type ConnectWebhookPayload = ConnectionSuccessWebhook | ConnectionErrorWebhook;

let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 300000) {
    return cachedAccessToken;
  }

  if (!PIPEDREAM_CLIENT_ID || !PIPEDREAM_CLIENT_SECRET) {
    throw new Error("PIPEDREAM_CLIENT_ID and PIPEDREAM_CLIENT_SECRET must be set");
  }

  const response = await fetch(`${PIPEDREAM_API_URL}/v1/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: PIPEDREAM_CLIENT_ID,
      client_secret: PIPEDREAM_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Pipedream access token: ${error}`);
  }

  const data = await response.json();
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000);
  
  if (!cachedAccessToken) {
    throw new Error("Failed to get access token from response");
  }
  
  return cachedAccessToken;
}

async function pipedreamFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await getAccessToken();
  const url = `${PIPEDREAM_API_URL}${endpoint}`;
  
  console.log(`[Pipedream] ${options.method || "GET"} ${url}`);
  
  const response = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "x-pd-environment": PIPEDREAM_ENVIRONMENT,
      ...options.headers,
    },
  });

  const responseText = await response.text();

  if (!response.ok) {
    const error = responseText;
    console.error(`[Pipedream] Error: ${response.status} - ${error}`);
    console.error(`[Pipedream] Project ID: ${PIPEDREAM_PROJECT_ID}`);
    throw new Error(`Pipedream API error: ${response.status} - ${error}`);
  }

  return JSON.parse(responseText);
}

export async function createConnectToken(
  options: CreateTokenOptions
): Promise<CreateTokenResponse> {
  if (!PIPEDREAM_PROJECT_ID) {
    throw new Error("PIPEDREAM_PROJECT_ID must be set");
  }

  const requestBody: Record<string, unknown> = {
    external_user_id: options.externalUserId,
    allowed_origins: options.allowedOrigins,
    success_redirect_uri: options.successRedirectUri,
    error_redirect_uri: options.errorRedirectUri,
    webhook_uri: options.webhookUri,
  };
  
  if (options.app) {
    requestBody.app_id = options.app;
  }
  
  Object.keys(requestBody).forEach(key => {
    if (requestBody[key] === undefined) {
      delete requestBody[key];
    }
  });
  
  console.log("[Pipedream] Token request body:", JSON.stringify(requestBody, null, 2));

  return pipedreamFetch<CreateTokenResponse>(
    `/v1/connect/${PIPEDREAM_PROJECT_ID}/tokens`,
    {
      method: "POST",
      body: JSON.stringify(requestBody),
    }
  );
}

export async function listApps(options?: {
  limit?: number;
  offset?: number;
  query?: string;
}): Promise<{ data: App[] }> {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", options.limit.toString());
  if (options?.offset) params.set("offset", options.offset.toString());
  if (options?.query) params.set("q", options.query);

  return pipedreamFetch<{ data: App[] }>(
    `/v1/connect/apps?${params}`
  );
}

export async function listTriggers(options?: {
  app?: string;
  limit?: number;
  offset?: number;
  query?: string;
}): Promise<{ data: TriggerComponent[] }> {
  if (!PIPEDREAM_PROJECT_ID) {
    throw new Error("PIPEDREAM_PROJECT_ID must be set");
  }

  const params = new URLSearchParams();
  if (options?.app) params.set("app", options.app);
  if (options?.limit) params.set("limit", options.limit.toString());
  if (options?.offset) params.set("offset", options.offset.toString());
  if (options?.query) params.set("q", options.query);

  return pipedreamFetch<{ data: TriggerComponent[] }>(
    `/v1/connect/${PIPEDREAM_PROJECT_ID}/triggers?${params}`
  );
}

export async function getTrigger(triggerId: string): Promise<{ data: TriggerComponent }> {
  if (!PIPEDREAM_PROJECT_ID) {
    throw new Error("PIPEDREAM_PROJECT_ID must be set");
  }

  return pipedreamFetch<{ data: TriggerComponent }>(
    `/v1/connect/${PIPEDREAM_PROJECT_ID}/triggers/${triggerId}`
  );
}

export async function configureTriggerProp(options: {
  triggerId: string;
  externalUserId: string;
  propName: string;
  configuredProps: ConfiguredProps;
  query?: string;
}): Promise<{ options: PropOption[] }> {
  if (!PIPEDREAM_PROJECT_ID) {
    throw new Error("PIPEDREAM_PROJECT_ID must be set");
  }

  return pipedreamFetch<{ options: PropOption[] }>(
    `/v1/connect/${PIPEDREAM_PROJECT_ID}/triggers/${options.triggerId}/props/${options.propName}`,
    {
      method: "POST",
      body: JSON.stringify({
        external_user_id: options.externalUserId,
        configured_props: options.configuredProps,
        query: options.query,
      }),
    }
  );
}

export async function deployTrigger(
  options: DeployTriggerOptions
): Promise<{ data: DeployedTrigger }> {
  if (!PIPEDREAM_PROJECT_ID) {
    throw new Error("PIPEDREAM_PROJECT_ID must be set");
  }

  return pipedreamFetch<{ data: DeployedTrigger }>(
    `/v1/connect/${PIPEDREAM_PROJECT_ID}/triggers/deploy`,
    {
      method: "POST",
      body: JSON.stringify({
        id: options.id,
        external_user_id: options.externalUserId,
        configured_props: options.configuredProps,
        webhook_url: options.webhookUrl || PIPEDREAM_WEBHOOK_URL,
        workflow_id: options.workflowId,
        emit_on_deploy: options.emitOnDeploy ?? false,
      }),
    }
  );
}

export async function listDeployedTriggers(
  externalUserId: string
): Promise<{ data: DeployedTrigger[] }> {
  if (!PIPEDREAM_PROJECT_ID) {
    throw new Error("PIPEDREAM_PROJECT_ID must be set");
  }

  const params = new URLSearchParams({ external_user_id: externalUserId });
  return pipedreamFetch<{ data: DeployedTrigger[] }>(
    `/v1/connect/${PIPEDREAM_PROJECT_ID}/triggers/deployed?${params}`
  );
}

export async function getDeployedTrigger(
  deploymentId: string
): Promise<{ data: DeployedTrigger }> {
  if (!PIPEDREAM_PROJECT_ID) {
    throw new Error("PIPEDREAM_PROJECT_ID must be set");
  }

  return pipedreamFetch<{ data: DeployedTrigger }>(
    `/v1/connect/${PIPEDREAM_PROJECT_ID}/triggers/deployed/${deploymentId}`
  );
}

export async function deleteDeployedTrigger(deploymentId: string): Promise<void> {
  if (!PIPEDREAM_PROJECT_ID) {
    throw new Error("PIPEDREAM_PROJECT_ID must be set");
  }

  await pipedreamFetch<void>(
    `/v1/connect/${PIPEDREAM_PROJECT_ID}/triggers/deployed/${deploymentId}`,
    { method: "DELETE" }
  );
}

export async function updateDeployedTrigger(
  deploymentId: string,
  options: { active?: boolean; configuredProps?: ConfiguredProps }
): Promise<{ data: DeployedTrigger }> {
  if (!PIPEDREAM_PROJECT_ID) {
    throw new Error("PIPEDREAM_PROJECT_ID must be set");
  }

  return pipedreamFetch<{ data: DeployedTrigger }>(
    `/v1/connect/${PIPEDREAM_PROJECT_ID}/triggers/deployed/${deploymentId}`,
    {
      method: "PATCH",
      body: JSON.stringify(options),
    }
  );
}

export async function listAccounts(
  externalUserId: string,
  options?: { app?: string }
): Promise<{ data: Account[] }> {
  if (!PIPEDREAM_PROJECT_ID) {
    throw new Error("PIPEDREAM_PROJECT_ID must be set");
  }

  const params = new URLSearchParams({ external_user_id: externalUserId });
  if (options?.app) params.set("app", options.app);

  return pipedreamFetch<{ data: Account[] }>(
    `/v1/connect/${PIPEDREAM_PROJECT_ID}/accounts?${params}`
  );
}

export async function getAccount(accountId: string): Promise<{ data: Account }> {
  if (!PIPEDREAM_PROJECT_ID) {
    throw new Error("PIPEDREAM_PROJECT_ID must be set");
  }

  const account = await pipedreamFetch<Account>(
    `/v1/connect/${PIPEDREAM_PROJECT_ID}/accounts/${accountId}`
  );

  return { data: account };
}

export async function deleteAccount(accountId: string): Promise<void> {
  if (!PIPEDREAM_PROJECT_ID) {
    throw new Error("PIPEDREAM_PROJECT_ID must be set");
  }

  await pipedreamFetch<void>(
    `/v1/connect/${PIPEDREAM_PROJECT_ID}/accounts/${accountId}`,
    { method: "DELETE" }
  );
}

export function isPipedreamConfigured(): boolean {
  return !!(
    PIPEDREAM_CLIENT_ID &&
    PIPEDREAM_CLIENT_SECRET &&
    PIPEDREAM_PROJECT_ID
  );
}

export function getWebhookUrl(): string | undefined {
  return PIPEDREAM_WEBHOOK_URL;
}

export function getEnvironment(): "development" | "production" {
  return PIPEDREAM_ENVIRONMENT;
}

export default {
  createConnectToken,
  listApps,
  listTriggers,
  getTrigger,
  configureTriggerProp,
  deployTrigger,
  listDeployedTriggers,
  getDeployedTrigger,
  deleteDeployedTrigger,
  updateDeployedTrigger,
  listAccounts,
  getAccount,
  deleteAccount,
  isPipedreamConfigured,
  getWebhookUrl,
  getEnvironment,
};
