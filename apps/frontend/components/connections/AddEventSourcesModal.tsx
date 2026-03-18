"use client";

import { useEffect, useState, useCallback } from "react";
import { usePlatformApi } from "@/shared/hooks/use-platform-api";

type JsonValue =
  | number
  | string
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue | undefined };

interface PropOptionItem {
  label: string;
  value: unknown;
}

interface ConfigurableProp {
  name?: string;
  type?: string;
  label?: string;
  description?: string;
  optional?: boolean;
  remoteOptions?: boolean;
  remote_options?: boolean;
  options?: PropOptionItem[];
}

interface TriggerOption {
  key: string;
  name: string;
  description?: string;
  version: string;
  configurable_props?: ConfigurableProp[];
}

export interface DeployedTriggerPreview {
  id: string;
  deploymentId: string;
  triggerId: string;
  connectionId: string;
  status: string;
  createdAt: string;
}

interface AddEventSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  connection: {
    id: string;
    provider: string;
    pipedreamAuthId?: string | null;
    metadata?: { account_id?: string } | null;
  };
  onDeployed?: (trigger?: DeployedTriggerPreview) => void;
  source?: "post-connect" | "card";
  initialDeployedKeys?: string[];
}

function Spinner({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function PropField({
  prop,
  value,
  onChange,
  options,
  loadingOptions,
  onSearch,
}: {
  prop: ConfigurableProp;
  value: unknown;
  onChange: (value: unknown) => void;
  options: PropOptionItem[] | null;
  loadingOptions: boolean;
  onSearch?: (query: string) => void;
}) {
  const label = prop.label || prop.name || "Unknown";
  const isArray = prop.type === "string[]";
  const availableOptions = options ?? prop.options ?? [];

  if (loadingOptions) {
    return (
      <div className="space-y-1">
        <label className="text-[10px] font-mono font-medium tracking-wider uppercase text-tertiary">
          {label}
        </label>
        <div className="flex items-center gap-2 px-3 py-2 border border-border-dim rounded-sm bg-elevated text-xs text-tertiary">
          <Spinner className="w-3 h-3" /> Loading options…
        </div>
      </div>
    );
  }

  if (availableOptions.length > 0) {
    if (isArray) {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-1">
          <label className="text-[10px] font-mono font-medium tracking-wider uppercase text-tertiary">
            {label}
          </label>
          {prop.description && (
            <div className="text-[10px] text-tertiary">{prop.description}</div>
          )}
          <div className="max-h-32 overflow-y-auto border border-border-dim rounded-sm bg-surface">
            {availableOptions.map((opt) => {
              const optVal = String(opt.value);
              const checked = selected.includes(optVal);
              return (
                <label
                  key={optVal}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-hover cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      onChange(
                        checked
                          ? selected.filter((v) => v !== optVal)
                          : [...selected, optVal]
                      );
                    }}
                    className="accent-data"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <label className="text-[10px] font-mono font-medium tracking-wider uppercase text-tertiary">
          {label}
        </label>
        {prop.description && (
          <div className="text-[10px] text-tertiary">{prop.description}</div>
        )}
        {onSearch && (
          <input
            type="text"
            placeholder="Search…"
            onChange={(e) => onSearch(e.target.value)}
            className="w-full px-3 py-1.5 text-xs border border-border-dim rounded-sm bg-surface text-primary placeholder:text-tertiary focus:outline-none focus:border-data mb-1"
          />
        )}
        <select
          value={value != null ? String(value) : ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="w-full px-3 py-2 text-xs border border-border-dim rounded-sm bg-surface text-primary focus:outline-none focus:border-data"
        >
          <option value="">Select…</option>
          {availableOptions.map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (isArray) {
    return (
      <div className="space-y-1">
        <label className="text-[10px] font-mono font-medium tracking-wider uppercase text-tertiary">
          {label}
        </label>
        {prop.description && (
          <div className="text-[10px] text-tertiary">{prop.description}</div>
        )}
        <input
          type="text"
          value={Array.isArray(value) ? (value as string[]).join(", ") : (value as string) ?? ""}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
          placeholder="value1, value2, …"
          className="w-full px-3 py-2 text-xs border border-border-dim rounded-sm bg-surface text-primary placeholder:text-tertiary focus:outline-none focus:border-data"
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label className="text-[10px] font-mono font-medium tracking-wider uppercase text-tertiary">
        {label}
      </label>
      {prop.description && (
        <div className="text-[10px] text-tertiary">{prop.description}</div>
      )}
      <input
        type="text"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={`Enter ${label.toLowerCase()}`}
        className="w-full px-3 py-2 text-xs border border-border-dim rounded-sm bg-surface text-primary placeholder:text-tertiary focus:outline-none focus:border-data"
      />
    </div>
  );
}

export function AddEventSourcesModal({
  isOpen,
  onClose,
  connection,
  onDeployed,
  source = "card",
  initialDeployedKeys = [],
}: AddEventSourcesModalProps) {
  const api = usePlatformApi();
  const [triggers, setTriggers] = useState<TriggerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [deployingKey, setDeployingKey] = useState<string | null>(null);
  const [deployingAll, setDeployingAll] = useState(false);
  const [deployedKeys, setDeployedKeys] = useState<Set<string>>(() => new Set(initialDeployedKeys));
  const [error, setError] = useState<string | null>(null);
  const [configuringKey, setConfiguringKey] = useState<string | null>(null);
  const [propValues, setPropValues] = useState<Record<string, unknown>>({});
  const [remoteOptions, setRemoteOptions] = useState<Record<string, PropOptionItem[]>>({});
  const [loadingProps, setLoadingProps] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setDeployedKeys(new Set(initialDeployedKeys));
      setConfiguringKey(null);
      setPropValues({});
      setRemoteOptions({});
    }
  }, [isOpen, connection.id, initialDeployedKeys]);

  const fetchTriggers = useCallback(async () => {
    if (!connection?.provider) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.listPipedreamTriggers({ app: connection.provider, limit: 50 });
      setTriggers((data.data as TriggerOption[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load triggers");
      setTriggers([]);
    } finally {
      setLoading(false);
    }
  }, [connection?.provider, api]);

  useEffect(() => {
    if (isOpen && connection?.provider) fetchTriggers();
  }, [isOpen, connection?.provider, fetchTriggers]);

  const accountId = connection.pipedreamAuthId || connection.metadata?.account_id;

  const isSystemProp = (prop: ConfigurableProp): boolean => {
    const t = prop.type ?? "";
    return t.startsWith("$") || prop.name === "db" || prop.name === "http";
  };

  const getUnsatisfiedProps = (trigger: TriggerOption): ConfigurableProp[] => {
    return (trigger.configurable_props ?? []).filter(
      (prop) =>
        prop &&
        prop.optional === false &&
        prop.name &&
        !isSystemProp(prop) &&
        !(prop.name === connection.provider && accountId) &&
        prop.type !== "app"
    );
  };

  const canAutoDeploy = (trigger: TriggerOption): boolean =>
    getUnsatisfiedProps(trigger).length === 0;

  const fetchRemoteOptions = useCallback(
    async (trigger: TriggerOption, prop: ConfigurableProp, query?: string) => {
      if (!prop.name) return;
      const cacheKey = `${trigger.key}:${prop.name}`;

      if (!query) {
        setLoadingProps((prev) => new Set(prev).add(cacheKey));
      }

      try {
        const currentProps: Record<string, unknown> = { ...propValues };
        if (accountId) {
          currentProps[connection.provider] = { authProvisionId: accountId };
        }

        const result = await api.configurePipedreamTriggerProp({
          trigger_id: trigger.key,
          prop_name: prop.name,
          configured_props: currentProps,
          query: query || null,
        });

        const options: PropOptionItem[] = [];
        if (result.options) {
          for (const opt of result.options) {
            if ("__lv" in opt && typeof opt.__lv === "object" && opt.__lv !== null) {
              const nested = opt.__lv as PropOptionItem;
              options.push(nested);
            } else {
              options.push(opt as PropOptionItem);
            }
          }
        }
        if (result.stringOptions) {
          for (const s of result.stringOptions) {
            options.push({ label: s, value: s });
          }
        }

        setRemoteOptions((prev) => ({ ...prev, [cacheKey]: options }));
      } catch (e) {
        console.error(`Failed to fetch options for ${prop.name}:`, e);
        setRemoteOptions((prev) => ({ ...prev, [cacheKey]: [] }));
      } finally {
        setLoadingProps((prev) => {
          const next = new Set(prev);
          next.delete(cacheKey);
          return next;
        });
      }
    },
    [api, accountId, connection.provider, propValues]
  );

  const handleConfigure = (trigger: TriggerOption) => {
    if (configuringKey === trigger.key) {
      setConfiguringKey(null);
      return;
    }

    setConfiguringKey(trigger.key);
    setPropValues({});
    setRemoteOptions({});
    setError(null);

    const unsatisfied = getUnsatisfiedProps(trigger);
    for (const prop of unsatisfied) {
      const hasRemote = prop.remoteOptions || prop.remote_options;
      if (hasRemote) {
        fetchRemoteOptions(trigger, prop);
      }
    }
  };

  const handleDeployWithProps = async (trigger: TriggerOption) => {
    setDeployingKey(trigger.key);
    setError(null);
    try {
      const configuredProps: Record<string, unknown> = {};
      if (accountId) {
        configuredProps[connection.provider] = { authProvisionId: accountId };
      }
      for (const [key, val] of Object.entries(propValues)) {
        if (val !== undefined && val !== null && val !== "") {
          configuredProps[key] = val;
        }
      }

      const deployResponse = await api.deployPipedreamTrigger({
        triggerId: trigger.key,
        connectionId: connection.id,
        webhookUrl: null,
        configuredProps: Object.keys(configuredProps).length
          ? (configuredProps as unknown as JsonValue)
          : null,
      });

      const deploymentId =
        (deployResponse as { data?: { id?: string } })?.data?.id ||
        `pending-${trigger.key}-${Date.now()}`;

      const optimisticTrigger: DeployedTriggerPreview = {
        id: `optimistic-${connection.id}-${trigger.key}-${Date.now()}`,
        deploymentId,
        triggerId: trigger.key,
        connectionId: connection.id,
        status: "active",
        createdAt: new Date().toISOString(),
      };

      setDeployedKeys((prev) => new Set(prev).add(trigger.key));
      setConfiguringKey(null);
      setPropValues({});
      onDeployed?.(optimisticTrigger);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Deploy failed";
      setError(msg);
      console.error("Deploy trigger error:", e);
    } finally {
      setDeployingKey(null);
    }
  };

  const handleEnable = async (trigger: TriggerOption) => {
    if (!canAutoDeploy(trigger)) {
      handleConfigure(trigger);
      return;
    }

    setDeployingKey(trigger.key);
    try {
      const configuredProps: Record<string, unknown> = {};
      if (accountId) {
        configuredProps[connection.provider] = { authProvisionId: accountId };
      }

      const deployResponse = await api.deployPipedreamTrigger({
        triggerId: trigger.key,
        connectionId: connection.id,
        webhookUrl: null,
        configuredProps: Object.keys(configuredProps).length
          ? (configuredProps as unknown as JsonValue)
          : null,
      });

      const deploymentId =
        (deployResponse as { data?: { id?: string } })?.data?.id ||
        `pending-${trigger.key}-${Date.now()}`;

      const optimisticTrigger: DeployedTriggerPreview = {
        id: `optimistic-${connection.id}-${trigger.key}-${Date.now()}`,
        deploymentId,
        triggerId: trigger.key,
        connectionId: connection.id,
        status: "active",
        createdAt: new Date().toISOString(),
      };

      setDeployedKeys((prev) => new Set(prev).add(trigger.key));
      onDeployed?.(optimisticTrigger);
    } catch (e) {
      console.error("Deploy trigger error:", e);
    } finally {
      setDeployingKey(null);
    }
  };

  const handleEnableAll = async () => {
    const deployable = triggers.filter((t) => !deployedKeys.has(t.key) && canAutoDeploy(t));
    const skipped = triggers.filter((t) => !deployedKeys.has(t.key) && !canAutoDeploy(t));
    if (deployable.length === 0) return;
    setDeployingAll(true);
    setError(null);
    for (const trigger of deployable) {
      await handleEnable(trigger);
    }
    setDeployingAll(false);
    if (skipped.length > 0) {
      setError(`Skipped ${skipped.length} trigger${skipped.length > 1 ? "s" : ""} that require manual configuration.`);
    }
  };

  const autoDeployable = triggers.filter((t) => !deployedKeys.has(t.key) && canAutoDeploy(t));
  const undeployedCount = triggers.filter((t) => !deployedKeys.has(t.key)).length;

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
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-mono font-medium tracking-wider uppercase text-tertiary">
                Available triggers
              </div>
              {triggers.length > 0 && autoDeployable.length > 0 && (
                <button
                  type="button"
                  disabled={deployingAll || !!deployingKey}
                  onClick={handleEnableAll}
                  className="btn btn--ghost btn--sm text-xs disabled:opacity-50"
                >
                  {deployingAll ? (
                    <span className="flex items-center gap-1.5">
                      <Spinner className="w-3 h-3" /> Enabling…
                    </span>
                  ) : (
                    `Enable all (${autoDeployable.length}${undeployedCount > autoDeployable.length ? ` of ${undeployedCount}` : ""})`
                  )}
                </button>
              )}
            </div>

            {error && (
              <div className="py-2 px-3 mb-2 text-xs text-critical bg-critical-bg border border-critical-dim rounded-sm">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="w-8 h-8 text-data" />
              </div>
            ) : triggers.length === 0 ? (
              <div className="py-4 text-sm text-tertiary">No triggers available for this app.</div>
            ) : (
              <div className="max-h-[min(60vh,420px)] overflow-y-auto border border-border-dim rounded-sm">
                <div className="divide-y divide-border-dim">
                  {triggers.map((trigger) => {
                    const isDeployed = deployedKeys.has(trigger.key);
                    const isDeploying = deployingKey === trigger.key;
                    const needsManualConfig = !canAutoDeploy(trigger);
                    const unsatisfiedProps = getUnsatisfiedProps(trigger);
                    const isConfiguring = configuringKey === trigger.key;

                    return (
                      <div key={trigger.key}>
                        <div className="flex items-center justify-between px-3 py-3 hover:bg-hover transition-colors">
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
                            ) : needsManualConfig ? (
                              <button
                                type="button"
                                disabled={!!deployingKey || deployingAll}
                                onClick={() => handleConfigure(trigger)}
                                className="btn btn--ghost btn--sm text-xs disabled:opacity-50"
                              >
                                {isConfiguring ? "Cancel" : "Configure"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isDeploying || deployingAll}
                                onClick={() => handleEnable(trigger)}
                                className="btn btn--primary btn--sm disabled:opacity-50"
                              >
                                {isDeploying ? (
                                  <span className="flex items-center gap-1.5">
                                    <Spinner /> Deploying…
                                  </span>
                                ) : (
                                  "Enable"
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {isConfiguring && !isDeployed && (
                          <div className="px-3 pb-3 space-y-3 border-t border-border-dim bg-elevated/50">
                            <div className="pt-3 text-[10px] font-mono font-medium tracking-wider uppercase text-tertiary">
                              Configure required fields
                            </div>
                            {unsatisfiedProps.map((prop) => {
                              if (!prop.name) return null;
                              const cacheKey = `${trigger.key}:${prop.name}`;
                              const hasRemote = prop.remoteOptions || prop.remote_options;
                              const cachedOptions = remoteOptions[cacheKey] ?? null;
                              const isLoadingProp = loadingProps.has(cacheKey);

                              return (
                                <PropField
                                  key={prop.name}
                                  prop={prop}
                                  value={propValues[prop.name] ?? undefined}
                                  onChange={(val) =>
                                    setPropValues((prev) => ({
                                      ...prev,
                                      [prop.name!]: val,
                                    }))
                                  }
                                  options={hasRemote ? cachedOptions : null}
                                  loadingOptions={isLoadingProp}
                                  onSearch={
                                    hasRemote
                                      ? (q) => fetchRemoteOptions(trigger, prop, q)
                                      : undefined
                                  }
                                />
                              );
                            })}
                            <button
                              type="button"
                              disabled={
                                isDeploying ||
                                unsatisfiedProps.some((p) => {
                                  const val = propValues[p.name!];
                                  if (Array.isArray(val)) return val.length === 0;
                                  return val === undefined || val === null || val === "";
                                })
                              }
                              onClick={() => handleDeployWithProps(trigger)}
                              className="btn btn--primary btn--sm w-full disabled:opacity-50"
                            >
                              {isDeploying ? (
                                <span className="flex items-center justify-center gap-1.5">
                                  <Spinner /> Deploying…
                                </span>
                              ) : (
                                "Deploy trigger"
                              )}
                            </button>
                          </div>
                        )}
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
