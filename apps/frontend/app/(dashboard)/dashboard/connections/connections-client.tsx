"use client";

import Nango, { type ConnectUIEvent } from "@nangohq/frontend";
import {
  startTransition,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
} from "react";
import { useRouter } from "next/navigation";
import type {
  IntercomIntegrationResponse,
  KlaviyoIntegrationResponse,
  NangoProviderSummary,
  ShopifyIntegrationResponse,
  TrellusIntegrationResponse,
} from "platform-api";
import type { ConnectionListResponse } from "shared/generated";
import { ConfirmModal, CopyButton, Modal } from "ui";
import { usePlatformApi } from "@/shared/hooks/use-platform-api";

type ConnectionData = ConnectionListResponse["connections"][number];

type ConnectionMetadata = {
  account_name?: string;
  workspace_name?: string;
  region?: string;
  connected_at?: string;
  connection_id?: string;
  last_received_at?: string;
  event_count?: number;
};

interface ConnectionsClientProps {
  initialProviders: NangoProviderSummary[];
  initialConnections: ConnectionData[];
  initialIntercom: IntercomIntegrationResponse | null;
  initialKlaviyo: KlaviyoIntegrationResponse | null;
  initialShopify: ShopifyIntegrationResponse | null;
  initialTrellus: TrellusIntegrationResponse | null;
  initialLoadError?: string | null;
  initialSuccessMessage?: string | null;
  initialErrorMessage?: string | null;
}

const BACKFILL_PROVIDERS = new Set(["slack", "front"]);
const TRELLUS_FIELDS = [
  "session_id",
  "timestamp",
  "duration",
  "direction",
  "is_inbound",
  "call_status",
  "rep_id",
  "rep_name",
  "rep_number",
  "contact_id",
  "contact_name",
  "target_number",
  "custom_id",
  "disposition",
  "sentiment",
  "purpose",
  "summary",
  "audio_url",
  "transcript",
  "transcript_link",
  "contact_title",
  "company_name",
  "platform_url",
];

function formatConnectedAt(connectedAt?: string | null) {
  if (!connectedAt) return null;
  const date = new Date(connectedAt);
  if (Number.isNaN(date.getTime())) return connectedAt;
  return date.toLocaleString();
}

function getConnectionMetadata(connection: ConnectionData | null | undefined) {
  return (
    (connection?.metadata as ConnectionMetadata | null | undefined) ?? null
  );
}

function getConnectionId(connection: ConnectionData | null | undefined) {
  const metadata = getConnectionMetadata(connection);
  return metadata?.connection_id || connection?.nangoConnectionId || "pending";
}

function getConnectionLabel(connection: ConnectionData | null | undefined) {
  const metadata = getConnectionMetadata(connection);
  return (
    metadata?.account_name || metadata?.workspace_name || "Connected workspace"
  );
}

function getTrellusStatus(trellus: TrellusIntegrationResponse | null) {
  if (!trellus?.connection)
    return { label: "Not configured", badge: "badge--neutral" };
  if (
    trellus.setupStatus === "active" ||
    trellus.connection.status === "active"
  ) {
    return { label: "Active", badge: "badge--nominal" };
  }
  if (
    trellus.setupStatus === "error" ||
    trellus.connection.status === "error"
  ) {
    return { label: "Error", badge: "badge--critical" };
  }
  return { label: "Awaiting test event", badge: "badge--caution" };
}

function getIntercomStatus(intercom: IntercomIntegrationResponse | null) {
  if (!intercom?.isAvailable) {
    return { label: "Unavailable", badge: "badge--critical" };
  }
  if (!intercom.connection) {
    return { label: "Not configured", badge: "badge--neutral" };
  }
  return { label: "Active", badge: "badge--nominal" };
}

function getKlaviyoStatus(klaviyo: KlaviyoIntegrationResponse | null) {
  if (!klaviyo?.isAvailable) {
    return { label: "Unavailable", badge: "badge--critical" };
  }
  if (!klaviyo.connection) {
    return { label: "Not configured", badge: "badge--neutral" };
  }
  return { label: "Active", badge: "badge--nominal" };
}

function getShopifyStatus(shopify: ShopifyIntegrationResponse | null) {
  if (!shopify?.isAvailable) {
    return { label: "Unavailable", badge: "badge--critical" };
  }
  if (!shopify.connection) {
    return { label: "Not configured", badge: "badge--neutral" };
  }
  return { label: "Active", badge: "badge--nominal" };
}

function getTrellusLastReceived(trellus: TrellusIntegrationResponse | null) {
  return formatConnectedAt(trellus?.lastReceivedAt) || "No events received yet";
}

function getKlaviyoLastReceived(klaviyo: KlaviyoIntegrationResponse | null) {
  return formatConnectedAt(klaviyo?.lastReceivedAt) || "No events received yet";
}

function getShopifyLastReceived(shopify: ShopifyIntegrationResponse | null) {
  return formatConnectedAt(shopify?.lastReceivedAt) || "No events received yet";
}

function formatProviderName(provider: string) {
  return provider
    .split(/[-_]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getProviderInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function closeProviderMenu(event: MouseEvent<HTMLButtonElement>) {
  const details = event.currentTarget.closest("details");
  if (details instanceof HTMLDetailsElement) {
    details.removeAttribute("open");
  }
}

export function ConnectionsClient({
  initialProviders,
  initialConnections,
  initialIntercom,
  initialKlaviyo,
  initialShopify,
  initialTrellus,
  initialLoadError,
  initialSuccessMessage,
  initialErrorMessage,
}: ConnectionsClientProps) {
  const api = usePlatformApi();
  const router = useRouter();

  const [providers, setProviders] = useState(initialProviders);
  const [connections, setConnections] = useState(initialConnections);
  const [intercom, setIntercom] = useState<IntercomIntegrationResponse | null>(
    initialIntercom
  );
  const [klaviyo, setKlaviyo] = useState<KlaviyoIntegrationResponse | null>(
    initialKlaviyo
  );
  const [shopify, setShopify] = useState<ShopifyIntegrationResponse | null>(
    initialShopify
  );
  const [trellus, setTrellus] = useState<TrellusIntegrationResponse | null>(
    initialTrellus
  );
  const [trellusSecret, setTrellusSecret] = useState<string | null>(
    initialTrellus?.headerValue ?? null
  );
  const [isIntercomDisconnectOpen, setIsIntercomDisconnectOpen] =
    useState(false);
  const [isIntercomBusy, setIsIntercomBusy] = useState(false);
  const [isKlaviyoDisconnectOpen, setIsKlaviyoDisconnectOpen] = useState(false);
  const [isKlaviyoBusy, setIsKlaviyoBusy] = useState(false);
  const [isShopifyDisconnectOpen, setIsShopifyDisconnectOpen] = useState(false);
  const [isShopifyBusy, setIsShopifyBusy] = useState(false);
  const [isShopifyModalOpen, setIsShopifyModalOpen] = useState(false);
  const [shopifyShopDomain, setShopifyShopDomain] = useState(
    initialShopify?.shopDomain ?? ""
  );
  const [isTrellusModalOpen, setIsTrellusModalOpen] = useState(false);
  const [isTrellusDisconnectOpen, setIsTrellusDisconnectOpen] = useState(false);
  const [isTrellusBusy, setIsTrellusBusy] = useState(false);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(
    initialSuccessMessage ?? null
  );
  const [error, setError] = useState<string | null>(
    initialErrorMessage ?? initialLoadError ?? null
  );
  const [providerToDisconnect, setProviderToDisconnect] =
    useState<NangoProviderSummary | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  useEffect(() => {
    setProviders(initialProviders);
  }, [initialProviders]);

  useEffect(() => {
    setConnections(initialConnections);
  }, [initialConnections]);

  useEffect(() => {
    setIntercom(initialIntercom);
  }, [initialIntercom]);

  useEffect(() => {
    setKlaviyo(initialKlaviyo);
  }, [initialKlaviyo]);

  useEffect(() => {
    setShopify(initialShopify);
    setShopifyShopDomain(initialShopify?.shopDomain ?? "");
  }, [initialShopify]);

  useEffect(() => {
    setTrellus(initialTrellus);
    setTrellusSecret(initialTrellus?.headerValue ?? null);
  }, [initialTrellus]);

  useEffect(() => {
    setMessage(initialSuccessMessage ?? null);
  }, [initialSuccessMessage]);

  useEffect(() => {
    setError(initialErrorMessage ?? initialLoadError ?? null);
  }, [initialErrorMessage, initialLoadError]);

  const isTrellusAwaitingTestEvent =
    !!trellus?.connection &&
    trellus.setupStatus === "awaiting_test_event" &&
    trellus.connection.status !== "active";

  useEffect(() => {
    if (!isTrellusAwaitingTestEvent) return;

    let isCancelled = false;
    let isRefreshing = false;

    const refreshTrellusStatus = async () => {
      if (isRefreshing) return;
      isRefreshing = true;

      try {
        const response = await api.getTrellusIntegration();
        if (!isCancelled) {
          setTrellus(response);
        }
      } catch {
        // Ignore transient polling failures while waiting for the first event.
      } finally {
        isRefreshing = false;
      }
    };

    void refreshTrellusStatus();
    const intervalId = window.setInterval(() => {
      void refreshTrellusStatus();
    }, 5000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    api,
    isTrellusAwaitingTestEvent,
    trellus?.connection?.id,
    trellus?.connection?.status,
    trellus?.setupStatus,
  ]);

  const refreshData = async () => {
    const [
      providersResult,
      connectionsResult,
      intercomResult,
      klaviyoResult,
      shopifyResult,
      trellusResult,
    ] = await Promise.allSettled([
      api.listNangoProviders(),
      api.listNangoConnections(),
      api.getIntercomIntegration(),
      api.getKlaviyoIntegration(),
      api.getShopifyIntegration(),
      api.getTrellusIntegration(),
    ]);

    if (providersResult.status === "fulfilled") {
      setProviders(providersResult.value.providers);
      setError(null);
    }

    if (connectionsResult.status === "fulfilled") {
      setConnections(connectionsResult.value.connections);
    } else if (providersResult.status === "fulfilled") {
      const fallbackConnections = providersResult.value.providers.flatMap(
        (provider) => (provider.connection ? [provider.connection] : [])
      );
      setConnections(fallbackConnections);
    }

    if (intercomResult.status === "fulfilled") {
      setIntercom(intercomResult.value);
    }

    if (klaviyoResult.status === "fulfilled") {
      setKlaviyo(klaviyoResult.value);
    }

    if (shopifyResult.status === "fulfilled") {
      setShopify(shopifyResult.value);
    }

    if (trellusResult.status === "fulfilled") {
      setTrellus(trellusResult.value);
    }

    if (providersResult.status === "rejected") {
      throw providersResult.reason;
    }

    startTransition(() => router.refresh());
  };

  const providerOrder = useMemo(
    () =>
      new Map(providers.map((provider, index) => [provider.provider, index])),
    [providers]
  );

  const connectionsByProvider = useMemo(
    () =>
      new Map(
        connections.map((connection) => [connection.provider, connection])
      ),
    [connections]
  );

  const providersWithConnections = useMemo(
    () =>
      providers.map((provider) => ({
        ...provider,
        connection:
          connectionsByProvider.get(provider.provider) ||
          provider.connection ||
          null,
      })),
    [providers, connectionsByProvider]
  );

  const activeConnections = useMemo(
    () =>
      [...connections]
        .filter((connection) => connection.status === "active")
        .sort(
          (left, right) =>
            (providerOrder.get(left.provider) ?? Number.MAX_SAFE_INTEGER) -
            (providerOrder.get(right.provider) ?? Number.MAX_SAFE_INTEGER)
        ),
    [connections, providerOrder]
  );

  const activeTrellusConnection =
    trellus?.connection && trellus.connection.status === "active"
      ? trellus.connection
      : null;
  const activeIntercomConnection =
    intercom?.connection && intercom.connection.status === "active"
      ? intercom.connection
      : null;
  const activeKlaviyoConnection =
    klaviyo?.connection && klaviyo.connection.status === "active"
      ? klaviyo.connection
      : null;
  const activeShopifyConnection =
    shopify?.connection && shopify.connection.status === "active"
      ? shopify.connection
      : null;
  const activeConnectionsCount =
    activeConnections.length +
    (activeIntercomConnection ? 1 : 0) +
    (activeKlaviyoConnection ? 1 : 0) +
    (activeShopifyConnection ? 1 : 0) +
    (activeTrellusConnection ? 1 : 0);

  const resetFeedback = () => {
    setMessage(null);
    setError(null);
  };

  const handleConnect = async (provider: NangoProviderSummary) => {
    setBusyProvider(provider.provider);
    resetFeedback();

    try {
      const session = await api.createNangoConnectSession({
        provider: provider.provider,
      });

      const nango = new Nango();
      const connect = nango.openConnectUI({
        lang: "en",
        onEvent: async (event: ConnectUIEvent) => {
          if (event?.type === "connect") {
            try {
              await api.syncNangoConnection({
                provider: provider.provider,
                connectionId: event.payload.connectionId,
                providerConfigKey: event.payload.providerConfigKey,
              });
              await refreshData();
              setMessage(`${provider.displayName} connected.`);
            } catch (syncError) {
              setError(
                syncError instanceof Error
                  ? syncError.message
                  : "Failed to save the connection locally."
              );
            } finally {
              setBusyProvider(null);
            }
          }

          if (event?.type === "close") {
            setBusyProvider(null);
          }

          if (event?.type === "error") {
            setError(
              event.payload?.errorMessage || "Failed to connect provider."
            );
            setBusyProvider(null);
          }
        },
      });

      connect.setSessionToken(session.sessionToken);
    } catch (sessionError) {
      setBusyProvider(null);
      setError(
        sessionError instanceof Error
          ? sessionError.message
          : "Failed to start connect flow."
      );
    }
  };

  const handleAuthorizeIntercom = async () => {
    if (!intercom?.isAvailable) {
      setError(
        "Intercom direct integration is not configured in this environment."
      );
      return;
    }

    setIsIntercomBusy(true);
    resetFeedback();

    try {
      const response = await api.authorizeIntercom();
      window.location.assign(response.authorizeUrl);
    } catch (authorizeError) {
      setError(
        authorizeError instanceof Error
          ? authorizeError.message
          : "Failed to start the Intercom connect flow."
      );
      setIsIntercomBusy(false);
    }
  };

  const handleDisconnectIntercom = async () => {
    setIsIntercomBusy(true);
    resetFeedback();

    try {
      const response = await api.disconnectIntercom();
      setIntercom(response);
      setIsIntercomDisconnectOpen(false);
      setMessage("Intercom disconnected.");
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Failed to disconnect Intercom."
      );
    } finally {
      setIsIntercomBusy(false);
    }
  };

  const handleAuthorizeKlaviyo = async () => {
    if (!klaviyo?.isAvailable) {
      setError(
        "Klaviyo direct integration is not configured in this environment."
      );
      return;
    }

    setIsKlaviyoBusy(true);
    resetFeedback();

    try {
      const response = await api.authorizeKlaviyo();
      window.location.assign(response.authorizeUrl);
    } catch (authorizeError) {
      setError(
        authorizeError instanceof Error
          ? authorizeError.message
          : "Failed to start the Klaviyo connect flow."
      );
      setIsKlaviyoBusy(false);
    }
  };

  const handleDisconnectKlaviyo = async () => {
    setIsKlaviyoBusy(true);
    resetFeedback();

    try {
      const response = await api.disconnectKlaviyo();
      setKlaviyo(response);
      setIsKlaviyoDisconnectOpen(false);
      setMessage("Klaviyo disconnected.");
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Failed to disconnect Klaviyo."
      );
    } finally {
      setIsKlaviyoBusy(false);
    }
  };

  const openShopifyModal = () => {
    if (!shopify?.isAvailable) {
      setError(
        "Shopify direct integration is not configured in this environment."
      );
      return;
    }

    setShopifyShopDomain(shopify.shopDomain ?? "");
    setIsShopifyModalOpen(true);
    resetFeedback();
  };

  const handleAuthorizeShopify = async () => {
    if (!shopify?.isAvailable) {
      setError(
        "Shopify direct integration is not configured in this environment."
      );
      return;
    }

    if (!shopifyShopDomain.trim()) {
      setError("Enter the Shopify store domain before continuing.");
      return;
    }

    setIsShopifyBusy(true);
    resetFeedback();

    try {
      const response = await api.authorizeShopify({
        shopDomain: shopifyShopDomain.trim(),
      });
      window.location.assign(response.authorizeUrl);
    } catch (authorizeError) {
      setError(
        authorizeError instanceof Error
          ? authorizeError.message
          : "Failed to start the Shopify connect flow."
      );
      setIsShopifyBusy(false);
    }
  };

  const handleDisconnectShopify = async () => {
    setIsShopifyBusy(true);
    resetFeedback();

    try {
      const response = await api.disconnectShopify();
      setShopify(response);
      setIsShopifyDisconnectOpen(false);
      setMessage("Shopify disconnected.");
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Failed to disconnect Shopify."
      );
    } finally {
      setIsShopifyBusy(false);
    }
  };

  const handleSync = async (provider: NangoProviderSummary) => {
    setBusyProvider(provider.provider);
    resetFeedback();

    try {
      const response = await api.triggerNangoSync({
        provider: provider.provider,
        syncMode: "incremental",
      });
      await refreshData();
      setMessage(response.message || `${provider.displayName} sync triggered.`);
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Failed to trigger sync."
      );
    } finally {
      setBusyProvider(null);
    }
  };

  const handleBackfill = async (provider: NangoProviderSummary) => {
    setBusyProvider(provider.provider);
    resetFeedback();

    try {
      const response = await api.triggerNangoSync({
        provider: provider.provider,
        syncMode: "full_refresh_and_clear_cache",
        requestedSyncName: provider.syncName,
      });
      await refreshData();
      setMessage(
        response.message || `${provider.displayName} backfill sync triggered.`
      );
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Failed to trigger backfill sync."
      );
    } finally {
      setBusyProvider(null);
    }
  };

  const handleDisconnect = async () => {
    if (!providerToDisconnect) return;

    setBusyProvider(providerToDisconnect.provider);
    setIsDisconnecting(true);
    resetFeedback();

    try {
      const response = await api.disconnectNango({
        provider: providerToDisconnect.provider,
      });
      await refreshData();
      setMessage(
        response.message || `${providerToDisconnect.displayName} disconnected.`
      );
      setProviderToDisconnect(null);
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Failed to disconnect provider."
      );
    } finally {
      setBusyProvider(null);
      setIsDisconnecting(false);
    }
  };

  const handleConfigureTrellus = async () => {
    resetFeedback();

    if (trellus?.connection) {
      setTrellusSecret(null);
      setIsTrellusModalOpen(true);
      return;
    }

    setIsTrellusBusy(true);
    try {
      const response = await api.setupTrellusIntegration();
      setTrellus(response);
      setTrellusSecret(response.headerValue ?? null);
      setIsTrellusModalOpen(true);
    } catch (setupError) {
      setError(
        setupError instanceof Error
          ? setupError.message
          : "Failed to configure Trellus."
      );
    } finally {
      setIsTrellusBusy(false);
    }
  };

  const handleRotateTrellusSecret = async () => {
    setIsTrellusBusy(true);
    resetFeedback();

    try {
      const response = await api.rotateTrellusSecret();
      setTrellus(response);
      setTrellusSecret(response.headerValue ?? null);
      setIsTrellusModalOpen(true);
      setMessage(
        "Trellus webhook secret rotated. Update the header in Trellus."
      );
    } catch (rotateError) {
      setError(
        rotateError instanceof Error
          ? rotateError.message
          : "Failed to rotate Trellus secret."
      );
    } finally {
      setIsTrellusBusy(false);
    }
  };

  const handleDisconnectTrellus = async () => {
    setIsTrellusBusy(true);
    resetFeedback();

    try {
      const response = await api.disconnectTrellus();
      setTrellus(response);
      setTrellusSecret(null);
      setIsTrellusDisconnectOpen(false);
      setIsTrellusModalOpen(false);
      setMessage("Trellus disconnected.");
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Failed to disconnect Trellus."
      );
    } finally {
      setIsTrellusBusy(false);
    }
  };

  const intercomStatus = getIntercomStatus(intercom);
  const klaviyoStatus = getKlaviyoStatus(klaviyo);
  const shopifyStatus = getShopifyStatus(shopify);
  const trellusStatus = getTrellusStatus(trellus);

  return (
    <div className="space-y-6">
      {(message || error) && (
        <div
          className={`rounded-sm border px-4 py-3 text-sm ${
            error
              ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {error ?? message}
        </div>
      )}

      <ConfirmModal
        isOpen={!!providerToDisconnect}
        onClose={() => {
          if (isDisconnecting) return;
          setProviderToDisconnect(null);
        }}
        onConfirm={handleDisconnect}
        title="Disconnect Integration"
        message={
          providerToDisconnect
            ? `Are you sure you want to disconnect ${providerToDisconnect.displayName}? This will stop future syncs, but your existing events will remain.`
            : ""
        }
        confirmText="Disconnect"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDisconnecting}
      />

      <ConfirmModal
        isOpen={isIntercomDisconnectOpen}
        onClose={() => {
          if (isIntercomBusy) return;
          setIsIntercomDisconnectOpen(false);
        }}
        onConfirm={handleDisconnectIntercom}
        title="Disconnect Intercom"
        message="Are you sure you want to disconnect Intercom? Chronicle will stop ingesting new Intercom webhook events for this workspace, but your existing events will remain."
        confirmText="Disconnect"
        cancelText="Cancel"
        variant="danger"
        isLoading={isIntercomBusy}
      />

      <ConfirmModal
        isOpen={isTrellusDisconnectOpen}
        onClose={() => {
          if (isTrellusBusy) return;
          setIsTrellusDisconnectOpen(false);
        }}
        onConfirm={handleDisconnectTrellus}
        title="Disconnect Trellus"
        message="Are you sure you want to disconnect Trellus? Chronicle will stop accepting future webhook events for the current endpoint, but existing events will remain."
        confirmText="Disconnect"
        cancelText="Cancel"
        variant="danger"
        isLoading={isTrellusBusy}
      />

      <ConfirmModal
        isOpen={isKlaviyoDisconnectOpen}
        onClose={() => {
          if (isKlaviyoBusy) return;
          setIsKlaviyoDisconnectOpen(false);
        }}
        onConfirm={handleDisconnectKlaviyo}
        title="Disconnect Klaviyo"
        message="Are you sure you want to disconnect Klaviyo? Chronicle will remove the managed webhook subscription for this account and stop ingesting new Klaviyo events, but your existing events will remain."
        confirmText="Disconnect"
        cancelText="Cancel"
        variant="danger"
        isLoading={isKlaviyoBusy}
      />

      <ConfirmModal
        isOpen={isShopifyDisconnectOpen}
        onClose={() => {
          if (isShopifyBusy) return;
          setIsShopifyDisconnectOpen(false);
        }}
        onConfirm={handleDisconnectShopify}
        title="Disconnect Shopify"
        message="Are you sure you want to disconnect Shopify? Chronicle will remove the managed webhook subscriptions for this store and stop ingesting new Shopify events, but your existing events will remain."
        confirmText="Disconnect"
        cancelText="Cancel"
        variant="danger"
        isLoading={isShopifyBusy}
      />

      <Modal
        isOpen={isTrellusModalOpen}
        onClose={() => setIsTrellusModalOpen(false)}
        title="Configure Trellus Webhook"
        variant="dark"
        actions={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleRotateTrellusSecret}
              disabled={isTrellusBusy || !trellus?.connection}
              className="btn btn--secondary disabled:cursor-not-allowed disabled:opacity-60"
            >
              Rotate Secret
            </button>
            <button
              type="button"
              onClick={() => setIsTrellusModalOpen(false)}
              className="btn btn--primary"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="rounded-sm border border-data-dim bg-data-bg p-3 text-sm text-data">
            Configure this in Trellus under Webhooks. Chronicle will mark the
            connection active after the first valid test event arrives.
          </div>

          <div className="space-y-3">
            <div>
              <div className="label mb-1">Webhook URL</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all border border-border-dim bg-base px-3 py-2 font-mono text-xs text-primary">
                  {trellus?.webhookUrl ||
                    "Create the connection to generate a URL"}
                </code>
                <CopyButton text={trellus?.webhookUrl || ""} />
              </div>
            </div>

            <div>
              <div className="label mb-1">Header Name</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all border border-border-dim bg-base px-3 py-2 font-mono text-xs text-primary">
                  {trellus?.headerName || "x-chronicle-webhook-secret"}
                </code>
                <CopyButton
                  text={trellus?.headerName || "x-chronicle-webhook-secret"}
                />
              </div>
            </div>

            <div>
              <div className="label mb-1">Header Value</div>
              {trellusSecret ? (
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all border border-border-dim bg-base px-3 py-2 font-mono text-xs text-primary">
                    {trellusSecret}
                  </code>
                  <CopyButton text={trellusSecret} />
                </div>
              ) : (
                <div className="rounded-sm border border-border-dim bg-elevated p-3 text-xs text-tertiary">
                  Secret values are only shown when created or rotated. Rotate
                  the secret if you need to copy it again.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-sm border border-border-dim bg-elevated p-3">
            <div className="mb-2 text-sm font-medium text-primary">
              Trellus setup
            </div>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-secondary">
              <li>Create or open a Trellus webhook named Chronicle.</li>
              <li>Set HTTP Method to POST and paste the webhook URL.</li>
              <li>Leave When to Fire as Always fire (no filter).</li>
              <li>Add the custom header name and value above.</li>
              <li>
                Keep the default payload mapping, save, then use Test Webhook.
              </li>
            </ol>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-primary">
              Expected fields
            </div>
            <div className="flex max-h-28 flex-wrap gap-2 overflow-auto rounded-sm border border-border-dim bg-base p-3">
              {TRELLUS_FIELDS.map((field) => (
                <span key={field} className="badge badge--neutral font-mono">
                  {field}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isShopifyModalOpen}
        onClose={() => {
          if (isShopifyBusy) return;
          setIsShopifyModalOpen(false);
        }}
        title="Connect Shopify"
        variant="dark"
        actions={
          <>
            <button
              type="button"
              onClick={() => setIsShopifyModalOpen(false)}
              disabled={isShopifyBusy}
              className="btn btn--secondary disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAuthorizeShopify}
              disabled={isShopifyBusy || !shopifyShopDomain.trim()}
              className="btn btn--primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isShopifyBusy ? "Connecting..." : "Continue"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-sm border border-data-dim bg-data-bg p-3 text-sm text-data">
            Enter the store domain, for example <code>store.myshopify.com</code>
            . Chronicle will handle OAuth and provision the webhook
            subscriptions automatically.
          </div>
          <div className="space-y-2">
            <label htmlFor="shopify-shop-domain" className="label">
              Store Domain
            </label>
            <input
              id="shopify-shop-domain"
              type="text"
              value={shopifyShopDomain}
              onChange={(event) => setShopifyShopDomain(event.target.value)}
              placeholder="store.myshopify.com"
              className="input w-full"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        </div>
      </Modal>

      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-tertiary">
            Integration Management
          </div>
          <h1 className="text-2xl font-semibold text-primary">Connections</h1>
        </div>
        <div className="flex items-center gap-2 border border-border-dim bg-elevated px-3 py-1.5">
          <div
            className={`status-dot ${
              activeConnectionsCount > 0
                ? "status-dot--nominal"
                : "status-dot--offline"
            }`}
          />
          <span className="text-sm text-secondary">
            <span className="font-mono tabular-nums">
              {activeConnectionsCount}
            </span>{" "}
            active
          </span>
        </div>
      </div>

      <div className="panel">
        <div
          className={`flex items-center justify-between border-b px-4 py-3 ${
            activeConnectionsCount > 0
              ? "border-nominal-dim bg-nominal-bg"
              : "border-data-dim bg-data-bg"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`status-dot ${
                activeConnectionsCount > 0
                  ? "status-dot--nominal status-dot--pulse"
                  : "status-dot--data"
              }`}
            />
            <span
              className={`text-sm font-medium ${
                activeConnectionsCount > 0 ? "text-nominal" : "text-data"
              }`}
            >
              {activeConnectionsCount > 0
                ? "Integrations Operational"
                : "Awaiting Connections"}
            </span>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">Direct Integrations</span>
          <span className="badge badge--neutral">OAuth + Webhook</span>
        </div>
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
          {intercom && (
            <section className="flex h-full flex-col rounded-md border border-border-dim bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-medium text-primary">
                      {intercom.displayName}
                    </h2>
                    <span className="rounded-sm border border-border-dim px-2 py-0.5 text-[11px] uppercase tracking-[0.18em] text-tertiary">
                      Direct
                    </span>
                  </div>
                  <p className="text-sm text-secondary">
                    {intercom.description}
                  </p>
                </div>
                <span className={`badge ${intercomStatus.badge}`}>
                  {intercomStatus.label}
                </span>
              </div>

              <div className="mt-4 flex-1">
                {intercom.connection ? (
                  <div className="space-y-3">
                    <div className="rounded-sm border border-border-dim bg-elevated p-3">
                      <div className="label">Workspace</div>
                      <div className="mt-1 text-sm text-primary">
                        {intercom.workspaceName ||
                          getConnectionLabel(intercom.connection)}
                      </div>
                      <div className="mt-1 text-xs text-tertiary">
                        Chronicle manages the webhook delivery for this Intercom
                        workspace.
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-sm border border-border-dim bg-background/60 p-3">
                        <div className="label">Connected At</div>
                        <div className="mt-1 text-sm text-primary">
                          {formatConnectedAt(intercom.connectedAt) || "Unknown"}
                        </div>
                      </div>
                      <div className="rounded-sm border border-border-dim bg-background/60 p-3">
                        <div className="label">Last Webhook</div>
                        <div className="mt-1 text-sm text-primary">
                          {formatConnectedAt(intercom.lastReceivedAt) ||
                            "No events received yet"}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-sm border border-border-dim bg-elevated p-3 text-sm text-secondary">
                    {intercom.isAvailable
                      ? "Connect Intercom via OAuth. Chronicle will manage the app-level webhook automatically, so the workspace owner does not need to paste any endpoint manually."
                      : "Intercom direct is not configured in this environment yet. Add the Intercom OAuth credentials to enable this connection."}
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleAuthorizeIntercom}
                    disabled={isIntercomBusy || !intercom.isAvailable}
                    className="btn btn--primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {intercom.connection ? "Reconnect" : "Connect Intercom"}
                  </button>
                  {intercom.connection && (
                    <button
                      type="button"
                      onClick={() => setIsIntercomDisconnectOpen(true)}
                      disabled={isIntercomBusy}
                      className="btn btn--secondary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
                {intercom.connection && intercom.workspaceRegion && (
                  <span className="badge badge--neutral">
                    {intercom.workspaceRegion}
                  </span>
                )}
              </div>
            </section>
          )}

          {klaviyo && (
            <section className="flex h-full flex-col rounded-md border border-border-dim bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-medium text-primary">
                      {klaviyo.displayName}
                    </h2>
                    <span className="rounded-sm border border-border-dim px-2 py-0.5 text-[11px] uppercase tracking-[0.18em] text-tertiary">
                      Direct
                    </span>
                  </div>
                  <p className="text-sm text-secondary">
                    {klaviyo.description}
                  </p>
                </div>
                <span className={`badge ${klaviyoStatus.badge}`}>
                  {klaviyoStatus.label}
                </span>
              </div>

              <div className="mt-4 flex-1">
                {klaviyo.connection ? (
                  <div className="space-y-3">
                    <div className="rounded-sm border border-border-dim bg-elevated p-3">
                      <div className="label">Account</div>
                      <div className="mt-1 text-sm text-primary">
                        {klaviyo.accountName ||
                          klaviyo.accountId ||
                          "Connected account"}
                      </div>
                      <div className="mt-1 text-xs text-tertiary">
                        Chronicle manages the Klaviyo system webhook
                        automatically for this account.
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-sm border border-border-dim bg-background/60 p-3">
                        <div className="label">Connected At</div>
                        <div className="mt-1 text-sm text-primary">
                          {formatConnectedAt(klaviyo.connectedAt) || "Unknown"}
                        </div>
                      </div>
                      <div className="rounded-sm border border-border-dim bg-background/60 p-3">
                        <div className="label">Last Webhook</div>
                        <div className="mt-1 text-sm text-primary">
                          {getKlaviyoLastReceived(klaviyo)}
                        </div>
                      </div>
                      <div className="rounded-sm border border-border-dim bg-background/60 p-3">
                        <div className="label">Subscribed Topics</div>
                        <div className="mt-1 font-mono text-sm text-primary">
                          {klaviyo.subscribedTopicCount ?? 0}
                        </div>
                      </div>
                      <div className="rounded-sm border border-border-dim bg-background/60 p-3">
                        <div className="label">Events</div>
                        <div className="mt-1 font-mono text-sm text-primary">
                          {klaviyo.eventCount ?? 0}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-sm border border-border-dim bg-elevated p-3 text-sm text-secondary">
                    {klaviyo.isAvailable
                      ? "Connect Klaviyo via OAuth. Chronicle will provision and manage the system webhook automatically, so the account owner does not need to paste any endpoint manually."
                      : "Klaviyo direct is not configured in this environment yet. Add the Klaviyo OAuth credentials to enable this connection."}
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleAuthorizeKlaviyo}
                    disabled={isKlaviyoBusy || !klaviyo.isAvailable}
                    className="btn btn--primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {klaviyo.connection ? "Reconnect" : "Connect Klaviyo"}
                  </button>
                  {klaviyo.connection && (
                    <button
                      type="button"
                      onClick={() => setIsKlaviyoDisconnectOpen(true)}
                      disabled={isKlaviyoBusy}
                      className="btn btn--secondary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
                {klaviyo.accountId && (
                  <span className="badge badge--neutral font-mono">
                    {klaviyo.accountId}
                  </span>
                )}
              </div>
            </section>
          )}

          {shopify && (
            <section className="flex h-full flex-col rounded-md border border-border-dim bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-medium text-primary">
                      {shopify.displayName}
                    </h2>
                    <span className="rounded-sm border border-border-dim px-2 py-0.5 text-[11px] uppercase tracking-[0.18em] text-tertiary">
                      Direct
                    </span>
                  </div>
                  <p className="text-sm text-secondary">
                    {shopify.description}
                  </p>
                </div>
                <span className={`badge ${shopifyStatus.badge}`}>
                  {shopifyStatus.label}
                </span>
              </div>

              <div className="mt-4 flex-1">
                {shopify.connection ? (
                  <div className="space-y-3">
                    <div className="rounded-sm border border-border-dim bg-elevated p-3">
                      <div className="label">Store</div>
                      <div className="mt-1 text-sm text-primary">
                        {shopify.shopName ||
                          shopify.shopDomain ||
                          "Connected store"}
                      </div>
                      <div className="mt-1 text-xs text-tertiary">
                        Chronicle manages the Shopify webhook subscriptions
                        automatically for this store.
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-sm border border-border-dim bg-background/60 p-3">
                        <div className="label">Connected At</div>
                        <div className="mt-1 text-sm text-primary">
                          {formatConnectedAt(shopify.connectedAt) || "Unknown"}
                        </div>
                      </div>
                      <div className="rounded-sm border border-border-dim bg-background/60 p-3">
                        <div className="label">Last Webhook</div>
                        <div className="mt-1 text-sm text-primary">
                          {getShopifyLastReceived(shopify)}
                        </div>
                      </div>
                      <div className="rounded-sm border border-border-dim bg-background/60 p-3">
                        <div className="label">Subscribed Topics</div>
                        <div className="mt-1 font-mono text-sm text-primary">
                          {shopify.subscribedTopicCount ?? 0}
                        </div>
                      </div>
                      <div className="rounded-sm border border-border-dim bg-background/60 p-3">
                        <div className="label">Events</div>
                        <div className="mt-1 font-mono text-sm text-primary">
                          {shopify.eventCount ?? 0}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-sm border border-border-dim bg-elevated p-3 text-sm text-secondary">
                    {shopify.isAvailable
                      ? "Connect a Shopify store via OAuth. Chronicle will create and manage the webhook subscriptions automatically, so the merchant does not need to paste any endpoint manually."
                      : "Shopify direct is not configured in this environment yet. Add the Shopify OAuth credentials to enable this connection."}
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={openShopifyModal}
                    disabled={isShopifyBusy || !shopify.isAvailable}
                    className="btn btn--primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {shopify.connection ? "Reconnect" : "Connect Shopify"}
                  </button>
                  {shopify.connection && (
                    <button
                      type="button"
                      onClick={() => setIsShopifyDisconnectOpen(true)}
                      disabled={isShopifyBusy}
                      className="btn btn--secondary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
                {shopify.shopDomain && (
                  <span className="badge badge--neutral font-mono">
                    {shopify.shopDomain}
                  </span>
                )}
              </div>
            </section>
          )}

          {trellus && (
            <section className="flex h-full flex-col rounded-md border border-border-dim bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-medium text-primary">
                      {trellus.displayName}
                    </h2>
                    <span className="rounded-sm border border-border-dim px-2 py-0.5 text-[11px] uppercase tracking-[0.18em] text-tertiary">
                      Direct
                    </span>
                  </div>
                  <p className="text-sm text-secondary">
                    {trellus.description}
                  </p>
                </div>
                <span className={`badge ${trellusStatus.badge}`}>
                  {trellusStatus.label}
                </span>
              </div>

              <div className="mt-4 flex-1">
                {trellus.connection ? (
                  <div className="space-y-3">
                    <div className="rounded-sm border border-border-dim bg-elevated p-3">
                      <div className="label">Webhook Status</div>
                      <div className="mt-1 text-sm text-primary">
                        {trellusStatus.label}
                      </div>
                      <div className="mt-1 text-xs text-tertiary">
                        Last received: {getTrellusLastReceived(trellus)}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-sm border border-border-dim bg-background/60 p-3">
                        <div className="label">Events</div>
                        <div className="mt-1 font-mono text-sm text-primary">
                          {trellus.eventCount ?? 0}
                        </div>
                      </div>
                      <div className="rounded-sm border border-border-dim bg-background/60 p-3">
                        <div className="label">Connection ID</div>
                        <div className="mt-1 truncate font-mono text-xs text-primary">
                          {trellus.connection.id}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-sm border border-border-dim bg-elevated p-3 text-sm text-secondary">
                    Configure a direct Trellus webhook to receive call events.
                    Trellus does not support API backfills, so events begin
                    flowing after setup.
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleConfigureTrellus}
                    disabled={isTrellusBusy}
                    className="btn btn--primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {trellus.connection ? "View Setup" : "Configure Webhook"}
                  </button>
                  {trellus.connection && (
                    <button
                      type="button"
                      onClick={handleRotateTrellusSecret}
                      disabled={isTrellusBusy}
                      className="btn btn--secondary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Rotate Secret
                    </button>
                  )}
                </div>

                {trellus.connection && (
                  <details className="relative">
                    <summary className="btn btn--ghost btn--sm cursor-pointer list-none disabled:cursor-not-allowed [&::-webkit-details-marker]:hidden">
                      Manage
                    </summary>
                    <div className="absolute right-0 top-full z-10 mt-2 min-w-[148px] rounded-sm border border-border-default bg-elevated p-1 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
                      <button
                        type="button"
                        onClick={(event) => {
                          closeProviderMenu(event);
                          setIsTrellusDisconnectOpen(true);
                        }}
                        disabled={isTrellusBusy}
                        className="flex w-full items-center rounded-sm px-3 py-2 text-left text-sm text-[var(--critical)] transition hover:bg-[var(--critical-bg)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Disconnect
                      </button>
                    </div>
                  </details>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">Nango Integrations</span>
          <span className="badge badge--neutral">Sync + Backfill</span>
        </div>

        {providersWithConnections.length === 0 ? (
          <div className="p-4">
            <div className="rounded-sm border border-border-dim bg-elevated p-4 text-sm text-secondary">
              {error
                ? "Unable to load Nango integrations in this environment."
                : "No Nango integrations are available in this environment yet."}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
            {providersWithConnections.map((provider) => {
              const connection = provider.connection;
              const metadata = getConnectionMetadata(connection);
              const isBusy = busyProvider === provider.provider;
              const supportsBackfill = BACKFILL_PROVIDERS.has(
                provider.provider
              );
              const connectionLabel = connection
                ? getConnectionLabel(connection)
                : null;

              return (
                <section
                  key={provider.provider}
                  className="flex h-full flex-col rounded-md border border-border-dim bg-surface p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-medium text-primary">
                          {provider.displayName}
                        </h2>
                        <span className="rounded-sm border border-border-dim px-2 py-0.5 text-[11px] uppercase tracking-[0.18em] text-tertiary">
                          Nango
                        </span>
                      </div>
                      <p className="text-sm text-secondary">
                        {provider.description}
                      </p>
                    </div>
                    <span
                      className={`badge ${connection ? "badge--nominal" : "badge--neutral"}`}
                    >
                      {connection ? "Connected" : "Not connected"}
                    </span>
                  </div>

                  <div className="mt-4 flex-1">
                    {connection ? (
                      <div className="space-y-3">
                        <div className="rounded-sm border border-border-dim bg-elevated p-3">
                          <div className="label">Workspace</div>
                          <div className="mt-1 text-sm text-primary">
                            {connectionLabel}
                          </div>
                          <div className="mt-1 text-xs text-tertiary">
                            {provider.displayName} is ready for manual syncs.
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="rounded-sm border border-border-dim bg-background/60 p-3">
                            <div className="label">Connected At</div>
                            <div className="mt-1 text-sm text-primary">
                              {formatConnectedAt(metadata?.connected_at) ||
                                "Unknown"}
                            </div>
                          </div>
                          <div className="rounded-sm border border-border-dim bg-background/60 p-3">
                            <div className="label">Connection ID</div>
                            <div className="mt-1 truncate font-mono text-xs text-primary">
                              {getConnectionId(connection)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-sm border border-border-dim bg-elevated p-3 text-sm text-secondary">
                        Connect this provider to start syncing new activity
                        {supportsBackfill
                          ? " and run a historical backfill."
                          : "."}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      {!connection && (
                        <button
                          type="button"
                          onClick={() => handleConnect(provider)}
                          disabled={isBusy}
                          className="btn btn--primary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Connect
                        </button>
                      )}
                      {connection && supportsBackfill && (
                        <button
                          type="button"
                          onClick={() => handleBackfill(provider)}
                          disabled={isBusy}
                          className="btn btn--primary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Run Backfill
                        </button>
                      )}
                      {connection && (
                        <button
                          type="button"
                          onClick={() => handleSync(provider)}
                          disabled={isBusy}
                          className={`btn ${supportsBackfill ? "btn--secondary" : "btn--primary"} disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          Sync Now
                        </button>
                      )}
                    </div>

                    {connection && (
                      <details className="relative">
                        <summary className="btn btn--ghost btn--sm cursor-pointer list-none disabled:cursor-not-allowed [&::-webkit-details-marker]:hidden">
                          Manage
                        </summary>
                        <div className="absolute right-0 top-full z-10 mt-2 min-w-[148px] rounded-sm border border-border-default bg-elevated p-1 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
                          <button
                            type="button"
                            onClick={(event) => {
                              closeProviderMenu(event);
                              void handleConnect(provider);
                            }}
                            disabled={isBusy}
                            className="flex w-full items-center rounded-sm px-3 py-2 text-left text-sm text-secondary transition hover:bg-hover hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Reconnect
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              closeProviderMenu(event);
                              setProviderToDisconnect(provider);
                            }}
                            disabled={isBusy}
                            className="flex w-full items-center rounded-sm px-3 py-2 text-left text-sm text-[var(--critical)] transition hover:bg-[var(--critical-bg)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Disconnect
                          </button>
                        </div>
                      </details>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {activeConnectionsCount > 0 && (
        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">Active Connections</span>
            <span className="badge badge--nominal">
              {activeConnectionsCount} Online
            </span>
          </div>
          <div className="divide-y divide-border-dim">
            {activeConnections.map((connection) => {
              const metadata = getConnectionMetadata(connection);
              const provider = providers.find(
                (item) => item.provider === connection.provider
              );
              const displayName =
                provider?.displayName ||
                formatProviderName(connection.provider);

              return (
                <div
                  key={connection.id}
                  className="flex items-center justify-between px-4 py-4 transition-colors hover:bg-hover"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center border border-nominal bg-nominal-bg">
                      <span className="text-sm font-bold text-nominal">
                        {getProviderInitials(displayName)}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-primary">
                          {displayName}
                        </span>
                        <span className="badge badge--nominal">Active</span>
                      </div>
                      <div className="mt-0.5 text-xs text-tertiary">
                        {getConnectionLabel(connection)}
                        <span className="ml-2">
                          ·{" "}
                          <span className="font-mono">
                            {getConnectionId(connection)}
                          </span>
                        </span>
                        {metadata?.connected_at && (
                          <span className="ml-2">
                            · {formatConnectedAt(metadata.connected_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {metadata?.region && (
                      <span className="badge badge--neutral">
                        {metadata.region}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {activeIntercomConnection && (
              <div className="flex items-center justify-between px-4 py-4 transition-colors hover:bg-hover">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center border border-nominal bg-nominal-bg">
                    <span className="text-sm font-bold text-nominal">IC</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-primary">
                        Intercom
                      </span>
                      <span className="badge badge--nominal">Active</span>
                      <span className="badge badge--neutral">Direct</span>
                    </div>
                    <div className="mt-0.5 text-xs text-tertiary">
                      {intercom?.workspaceName ||
                        getConnectionLabel(activeIntercomConnection)}
                      <span className="ml-2">
                        ·{" "}
                        {formatConnectedAt(intercom?.lastReceivedAt) ||
                          "Awaiting first webhook"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {intercom?.workspaceRegion && (
                    <span className="badge badge--neutral">
                      {intercom.workspaceRegion}
                    </span>
                  )}
                  <span className="badge badge--neutral">
                    {intercom?.eventCount ?? 0} events
                  </span>
                </div>
              </div>
            )}
            {activeKlaviyoConnection && (
              <div className="flex items-start gap-3 rounded-sm border border-border-dim bg-elevated p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-border-dim bg-background text-sm font-semibold text-primary">
                  KL
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-primary">
                        Klaviyo
                      </div>
                      <div className="mt-1 text-xs text-tertiary">
                        {klaviyo?.accountName ||
                          klaviyo?.accountId ||
                          getConnectionLabel(activeKlaviyoConnection)}
                      </div>
                    </div>
                    <span className="badge badge--nominal">Live</span>
                  </div>
                  <div className="mt-2 text-xs text-secondary">
                    {getKlaviyoLastReceived(klaviyo)}
                    {klaviyo?.subscribedTopicCount ? (
                      <>
                        {" "}
                        ·{" "}
                        <span className="font-mono">
                          {klaviyo.subscribedTopicCount}
                        </span>{" "}
                        topics
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
            {activeTrellusConnection && (
              <div className="flex items-center justify-between px-4 py-4 transition-colors hover:bg-hover">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center border border-nominal bg-nominal-bg">
                    <span className="text-sm font-bold text-nominal">TR</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-primary">
                        Trellus.ai
                      </span>
                      <span className="badge badge--nominal">Active</span>
                      <span className="badge badge--neutral">Webhook</span>
                    </div>
                    <div className="mt-0.5 text-xs text-tertiary">
                      {getTrellusLastReceived(trellus)}
                      <span className="ml-2">
                        ·{" "}
                        <span className="font-mono">
                          {activeTrellusConnection.id}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
                <span className="badge badge--neutral">
                  {trellus?.eventCount ?? 0} events
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
