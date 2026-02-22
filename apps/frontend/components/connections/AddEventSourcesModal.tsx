"use client";

import { useEffect, useState, useCallback } from "react";

interface TriggerOption {
  key: string;
  name: string;
  description?: string;
  version: string;
  configurable_props?: unknown[];
}

interface AddEventSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  connection: { id: string; provider: string };
  onDeployed?: () => void;
  source?: "post-connect" | "card";
  initialDeployedKeys?: string[];
}

export function AddEventSourcesModal({
  isOpen,
  onClose,
  connection,
  onDeployed,
  source = "card",
  initialDeployedKeys = [],
}: AddEventSourcesModalProps) {
  const [triggers, setTriggers] = useState<TriggerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [deployingKey, setDeployingKey] = useState<string | null>(null);
  const [deployedKeys, setDeployedKeys] = useState<Set<string>>(() => new Set(initialDeployedKeys));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDeployedKeys(new Set(initialDeployedKeys));
    }
  }, [isOpen, connection.id, initialDeployedKeys]);

  const fetchTriggers = useCallback(async () => {
    if (!connection?.provider) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/pipedream/triggers?app=${encodeURIComponent(connection.provider)}&limit=50`
      );
      if (!res.ok) throw new Error("Failed to load triggers");
      const json = await res.json();
      setTriggers(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load triggers");
      setTriggers([]);
    } finally {
      setLoading(false);
    }
  }, [connection?.provider]);

  useEffect(() => {
    if (isOpen && connection?.provider) fetchTriggers();
  }, [isOpen, connection?.provider, fetchTriggers]);

  const handleEnable = async (trigger: TriggerOption) => {
    setDeployingKey(trigger.key);
    try {
      const res = await fetch("/api/pipedream/triggers/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          triggerId: trigger.key,
          connectionId: connection.id,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Deploy failed");
      }
      setDeployedKeys((prev) => new Set(prev).add(trigger.key));
      onDeployed?.();
    } catch (e) {
      console.error("Deploy trigger error:", e);
    } finally {
      setDeployingKey(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-event-sources-title"
    >
      <div
        className="w-full max-w-lg bg-surface border border-border-dim rounded-md shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-dim bg-elevated">
          <div>
            <div
              id="add-event-sources-title"
              className="text-[10px] font-mono font-medium tracking-wider uppercase text-tertiary"
            >
              Event sources
            </div>
            <h2 className="text-base font-semibold text-primary mt-0.5">
              Enable events from {connection.provider}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-tertiary hover:text-primary transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {source === "post-connect" && (
            <div className="flex items-center gap-2 text-sm text-nominal">
              <span className="status-dot status-dot--nominal flex-shrink-0" />
              Connection successful. Choose which events to receive.
            </div>
          )}

          <div>
            <div className="text-[10px] font-mono font-medium tracking-wider uppercase text-tertiary mb-2">
              Available triggers
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <svg
                  className="w-8 h-8 text-data animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              </div>
            ) : error ? (
              <div className="py-4 text-sm text-critical">{error}</div>
            ) : triggers.length === 0 ? (
              <div className="py-4 text-sm text-tertiary">No triggers available for this app.</div>
            ) : (
              <div className="max-h-[min(60vh,420px)] overflow-y-auto border border-border-dim rounded-sm">
                <div className="divide-y divide-border-dim">
                {triggers.map((trigger) => {
                  const isDeployed = deployedKeys.has(trigger.key);
                  const isDeploying = deployingKey === trigger.key;
                  return (
                    <div
                      key={trigger.key}
                      className="flex items-center justify-between px-3 py-3 hover:bg-hover transition-colors"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="text-sm font-medium text-primary truncate">
                          {trigger.name || trigger.key}
                        </div>
                        {trigger.description && (
                          <div className="text-xs text-tertiary truncate mt-0.5">
                            {trigger.description}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        {isDeployed ? (
                          <span className="badge badge--nominal">Enabled</span>
                        ) : (
                          <button
                            type="button"
                            disabled={isDeploying}
                            onClick={() => handleEnable(trigger)}
                            className="btn btn--primary btn--sm disabled:opacity-50"
                          >
                            {isDeploying ? (
                              <span className="flex items-center gap-1.5">
                                <svg
                                  className="w-3.5 h-3.5 animate-spin"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  />
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                  />
                                </svg>
                                Deploying…
                              </span>
                            ) : (
                              "Enable"
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-border-dim">
            <button type="button" onClick={onClose} className="btn btn--ghost">
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
