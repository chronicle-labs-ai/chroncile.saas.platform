"use client";

import Nango, { type ConnectUIEvent } from "@nangohq/frontend";
import { startTransition, useEffect, useMemo, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import type { NangoProviderSummary } from "platform-api";
import type { ConnectionListResponse } from "shared/generated";
import { ConfirmModal } from "ui";
import { usePlatformApi } from "@/shared/hooks/use-platform-api";

type ConnectionData = ConnectionListResponse["connections"][number];

type ConnectionMetadata = {
  account_name?: string;
  workspace_name?: string;
  region?: string;
  connected_at?: string;
  connection_id?: string;
};

interface ConnectionsClientProps {
  initialProviders: NangoProviderSummary[];
  initialConnections: ConnectionData[];
  initialLoadError?: string | null;
}

const BACKFILL_PROVIDERS = new Set(["intercom", "slack", "front"]);

function formatConnectedAt(connectedAt?: string | null) {
  if (!connectedAt) return null;
  const date = new Date(connectedAt);
  if (Number.isNaN(date.getTime())) return connectedAt;
  return date.toLocaleString();
}

function getConnectionMetadata(connection: ConnectionData | null | undefined) {
  return (connection?.metadata as ConnectionMetadata | null | undefined) ?? null;
}

function getConnectionId(connection: ConnectionData | null | undefined) {
  const metadata = getConnectionMetadata(connection);
  return metadata?.connection_id || connection?.nangoConnectionId || "pending";
}

function getConnectionLabel(connection: ConnectionData | null | undefined) {
  const metadata = getConnectionMetadata(connection);
  return (
    metadata?.account_name ||
    metadata?.workspace_name ||
    "Connected workspace"
  );
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
  initialLoadError,
}: ConnectionsClientProps) {
  const api = usePlatformApi();
  const router = useRouter();

  const [providers, setProviders] = useState(initialProviders);
  const [connections, setConnections] = useState(initialConnections);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialLoadError ?? null);
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
    setError(initialLoadError ?? null);
  }, [initialLoadError]);

  const refreshData = async () => {
    const [providersResult, connectionsResult] = await Promise.allSettled([
      api.listNangoProviders(),
      api.listNangoConnections(),
    ]);

    if (providersResult.status === "fulfilled") {
      setProviders(providersResult.value.providers);
      setError(null);
    }

    if (connectionsResult.status === "fulfilled") {
      setConnections(connectionsResult.value.connections);
    } else if (providersResult.status === "fulfilled") {
      const fallbackConnections = providersResult.value.providers
        .flatMap((provider) => (provider.connection ? [provider.connection] : []));
      setConnections(fallbackConnections);
    }

    if (providersResult.status === "rejected") {
      throw providersResult.reason;
    }

    startTransition(() => router.refresh());
  };

  const providerOrder = useMemo(
    () =>
      new Map(providers.map((provider, index) => [provider.provider, index])),
    [providers],
  );

  const connectionsByProvider = useMemo(
    () => new Map(connections.map((connection) => [connection.provider, connection])),
    [connections],
  );

  const providersWithConnections = useMemo(
    () =>
      providers.map((provider) => ({
        ...provider,
        connection:
          connectionsByProvider.get(provider.provider) || provider.connection || null,
      })),
    [providers, connectionsByProvider],
  );

  const activeConnections = useMemo(
    () =>
      [...connections]
        .filter((connection) => connection.status === "active")
        .sort(
          (left, right) =>
            (providerOrder.get(left.provider) ?? Number.MAX_SAFE_INTEGER) -
            (providerOrder.get(right.provider) ?? Number.MAX_SAFE_INTEGER),
        ),
    [connections, providerOrder],
  );

  const activeConnectionsCount = activeConnections.length;

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
                  : "Failed to save the connection locally.",
              );
            } finally {
              setBusyProvider(null);
            }
          }

          if (event?.type === "close") {
            setBusyProvider(null);
          }

          if (event?.type === "error") {
            setError(event.payload?.errorMessage || "Failed to connect provider.");
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
          : "Failed to start connect flow.",
      );
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
        syncError instanceof Error ? syncError.message : "Failed to trigger sync.",
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
        response.message || `${provider.displayName} backfill sync triggered.`,
      );
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Failed to trigger backfill sync.",
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
        response.message || `${providerToDisconnect.displayName} disconnected.`,
      );
      setProviderToDisconnect(null);
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Failed to disconnect provider.",
      );
    } finally {
      setBusyProvider(null);
      setIsDisconnecting(false);
    }
  };

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
            <span className="font-mono tabular-nums">{activeConnectionsCount}</span>{" "}
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
          <span className="panel__title">Available Integrations</span>
          <span className="badge badge--neutral">Nango</span>
        </div>

        {providersWithConnections.length === 0 ? (
          <div className="p-4">
            <div className="rounded-sm border border-border-dim bg-elevated p-4 text-sm text-secondary">
              {error
                ? "Unable to load integrations from Nango in this environment."
                : "No integrations are available in this environment yet."}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
            {providersWithConnections.map((provider) => {
              const connection = provider.connection;
              const metadata = getConnectionMetadata(connection);
              const isBusy = busyProvider === provider.provider;
              const supportsBackfill = BACKFILL_PROVIDERS.has(provider.provider);
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
                              {formatConnectedAt(metadata?.connected_at) || "Unknown"}
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
                (item) => item.provider === connection.provider,
              );
              const displayName =
                provider?.displayName || formatProviderName(connection.provider);

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
                          · <span className="font-mono">{getConnectionId(connection)}</span>
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
                      <span className="badge badge--neutral">{metadata.region}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
