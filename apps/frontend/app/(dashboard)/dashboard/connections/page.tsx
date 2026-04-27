import { auth } from "@/server/auth/auth";
import { fetchFromBackend } from "@/server/backend/fetch-from-backend";
import { redirect } from "next/navigation";
import type {
  IntercomIntegrationResponse,
  KlaviyoIntegrationResponse,
  NangoProviderSummary,
  ShopifyIntegrationResponse,
  TrellusIntegrationResponse,
} from "platform-api";
import type { ConnectionListResponse } from "shared/generated";
import { ConnectionsClient } from "./connections-client";

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const params = await searchParams;

  let providers: NangoProviderSummary[] = [];
  let connections: ConnectionListResponse["connections"] = [];
  let intercom: IntercomIntegrationResponse | null = null;
  let klaviyo: KlaviyoIntegrationResponse | null = null;
  let shopify: ShopifyIntegrationResponse | null = null;
  let trellus: TrellusIntegrationResponse | null = null;
  let initialLoadError: string | null = null;

  const [
    providersResult,
    connectionsResult,
    intercomResult,
    klaviyoResult,
    shopifyResult,
    trellusResult,
  ] = await Promise.allSettled([
    fetchFromBackend<{ providers: NangoProviderSummary[] }>(
      "/api/platform/integrations/providers"
    ),
    fetchFromBackend<ConnectionListResponse>(
      "/api/platform/integrations/connections"
    ),
    fetchFromBackend<IntercomIntegrationResponse>(
      "/api/platform/integrations/intercom"
    ),
    fetchFromBackend<KlaviyoIntegrationResponse>(
      "/api/platform/integrations/klaviyo"
    ),
    fetchFromBackend<ShopifyIntegrationResponse>(
      "/api/platform/integrations/shopify"
    ),
    fetchFromBackend<TrellusIntegrationResponse>(
      "/api/platform/integrations/trellus"
    ),
  ]);

  if (providersResult.status === "fulfilled") {
    providers = providersResult.value.providers;
  } else {
    initialLoadError = "Failed to load integrations.";
  }

  if (connectionsResult.status === "fulfilled") {
    connections = connectionsResult.value.connections;
  } else if (providers.length > 0) {
    connections = providers.flatMap((provider) =>
      provider.connection ? [provider.connection] : []
    );
  }

  if (intercomResult.status === "fulfilled") {
    intercom = intercomResult.value;
  } else {
    intercom = {
      provider: "intercom",
      displayName: "Intercom",
      description:
        "Connect Intercom directly via OAuth with Chronicle-managed webhooks.",
      transport: "direct",
      isAvailable: false,
      connection: null,
      setupStatus: "unavailable",
      workspaceId: null,
      workspaceName: null,
      workspaceRegion: null,
      connectedAt: null,
      lastReceivedAt: null,
      eventCount: 0,
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/webhooks/intercom`,
    };
  }

  if (trellusResult.status === "fulfilled") {
    trellus = trellusResult.value;
  } else {
    trellus = {
      provider: "trellus",
      displayName: "Trellus.ai",
      description: "Receive Trellus call events via direct webhook.",
      transport: "webhook",
      connection: null,
      webhookUrl: null,
      headerName: "x-chronicle-webhook-secret",
      headerValue: null,
      setupStatus: "not_configured",
      lastReceivedAt: null,
      eventCount: 0,
    };
  }

  if (klaviyoResult.status === "fulfilled") {
    klaviyo = klaviyoResult.value;
  } else {
    klaviyo = {
      provider: "klaviyo",
      displayName: "Klaviyo",
      description:
        "Connect Klaviyo directly via OAuth with Chronicle-managed system webhooks.",
      transport: "direct",
      isAvailable: false,
      connection: null,
      setupStatus: "unavailable",
      accountId: null,
      accountName: null,
      connectedAt: null,
      lastReceivedAt: null,
      subscribedTopicCount: 0,
      eventCount: 0,
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/webhooks/klaviyo`,
    };
  }

  if (shopifyResult.status === "fulfilled") {
    shopify = shopifyResult.value;
  } else {
    shopify = {
      provider: "shopify",
      displayName: "Shopify",
      description:
        "Connect Shopify directly via OAuth with Chronicle-managed webhook subscriptions.",
      transport: "direct",
      isAvailable: false,
      connection: null,
      setupStatus: "unavailable",
      shopDomain: null,
      shopName: null,
      connectedAt: null,
      lastReceivedAt: null,
      subscribedTopicCount: 0,
      eventCount: 0,
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/webhooks/shopify`,
    };
  }

  return (
    <ConnectionsClient
      initialProviders={providers}
      initialConnections={connections}
      initialIntercom={intercom}
      initialKlaviyo={klaviyo}
      initialShopify={shopify}
      initialTrellus={trellus}
      initialLoadError={initialLoadError}
      initialSuccessMessage={params.success ?? null}
      initialErrorMessage={params.error ?? null}
    />
  );
}
