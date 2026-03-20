"use client";

import Nango, { type ConnectUIEvent } from "@nangohq/frontend";
import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import type { NangoProviderSummary } from "platform-api";
import { usePlatformApi } from "@/shared/hooks/use-platform-api";

interface ConnectionsNangoClientProps {
  initialProviders: NangoProviderSummary[];
}

function formatConnectedAt(connectedAt?: string | null) {
  if (!connectedAt) return null;
  const date = new Date(connectedAt);
  if (Number.isNaN(date.getTime())) return connectedAt;
  return date.toLocaleString();
}

export function ConnectionsNangoClient({
  initialProviders,
}: ConnectionsNangoClientProps) {
  const api = usePlatformApi();
  const router = useRouter();
  const [providers, setProviders] = useState(initialProviders);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshProviders = async () => {
    const response = await api.listNangoProviders();
    setProviders(response.providers);
    startTransition(() => router.refresh());
  };

  const handleConnect = async (provider: NangoProviderSummary) => {
    setBusyProvider(provider.provider);
    setError(null);
    setMessage(null);

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
              await refreshProviders();
              setMessage(`${provider.displayName} connected.`);
            } catch (syncError) {
              const nextError =
                syncError instanceof Error
                  ? syncError.message
                  : "Failed to save the connection locally.";
              setError(nextError);
            } finally {
              setBusyProvider(null);
            }
          }

          if (event?.type === "close") {
            setBusyProvider(null);
          }

          if (event?.type === "error") {
            setError(event?.payload?.errorMessage || "Failed to connect provider.");
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
    setError(null);
    setMessage(null);
    try {
      const response = await api.triggerNangoSync({
        provider: provider.provider,
        syncMode: "incremental",
      });
      await refreshProviders();
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
    setError(null);
    setMessage(null);
    try {
      const response = await api.triggerNangoSync({
        provider: provider.provider,
        syncMode: "full_refresh_and_clear_cache",
        requestedSyncName: provider.syncName,
      });
      await refreshProviders();
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

  const handleDisconnect = async (provider: NangoProviderSummary) => {
    setBusyProvider(provider.provider);
    setError(null);
    setMessage(null);
    try {
      const response = await api.disconnectNango({ provider: provider.provider });
      await refreshProviders();
      setMessage(response.message || `${provider.displayName} disconnected.`);
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Failed to disconnect provider.",
      );
    } finally {
      setBusyProvider(null);
    }
  };

  return (
    <div className="space-y-4">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {providers.map((provider) => {
          const connection = provider.connection;
          const metadata = connection?.metadata as
            | { connected_at?: string; connection_id?: string }
            | null
            | undefined;
          const isBusy = busyProvider === provider.provider;

          return (
            <section
              key={provider.provider}
              className="rounded-md border border-border-dim bg-surface p-5"
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
                  <p className="text-sm text-secondary">{provider.description}</p>
                </div>
                <span
                  className={`rounded-sm px-2 py-1 text-xs ${
                    connection
                      ? "bg-emerald-500/10 text-emerald-200"
                      : "bg-elevated text-secondary"
                  }`}
                >
                  {connection ? "Connected" : "Not connected"}
                </span>
              </div>

              <dl className="mt-4 space-y-2 text-sm text-secondary">
                <div className="flex justify-between gap-4">
                  <dt>Provider key</dt>
                  <dd className="font-mono text-primary">{provider.integrationId}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Sync</dt>
                  <dd className="font-mono text-primary">{provider.syncName}</dd>
                </div>
                {connection && (
                  <>
                    <div className="flex justify-between gap-4">
                      <dt>Connection ID</dt>
                      <dd className="font-mono text-primary">
                        {metadata?.connection_id || connection.pipedreamAuthId || "pending"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>Connected at</dt>
                      <dd className="text-primary">
                        {formatConnectedAt(metadata?.connected_at) || "Unknown"}
                      </dd>
                    </div>
                  </>
                )}
              </dl>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleConnect(provider)}
                  disabled={isBusy}
                  className="inline-flex items-center rounded-sm bg-primary px-3 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {connection ? "Reconnect" : "Connect"}
                </button>
                <button
                  type="button"
                  onClick={() => handleSync(provider)}
                  disabled={!connection || isBusy}
                  className="inline-flex items-center rounded-sm border border-border-dim px-3 py-2 text-sm text-secondary transition hover:bg-hover hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Run Sync
                </button>
                {["intercom", "slack", "front"].includes(provider.provider) && (
                  <button
                    type="button"
                    onClick={() => handleBackfill(provider)}
                    disabled={!connection || isBusy}
                    className="inline-flex items-center rounded-sm border border-border-dim px-3 py-2 text-sm text-secondary transition hover:bg-hover hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Run Backfill
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDisconnect(provider)}
                  disabled={!connection || isBusy}
                  className="inline-flex items-center rounded-sm border border-border-dim px-3 py-2 text-sm text-secondary transition hover:bg-hover hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Disconnect
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
