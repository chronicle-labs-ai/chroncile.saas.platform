"use client";

import { useState, useEffect, useCallback } from "react";
import { Skeleton } from "ui";
import { usePlatformApi } from "@/shared/hooks/use-platform-api";
import type { AgentEndpointResponse } from "shared/generated";

const AUTH_TYPES = [
  { value: "none", label: "None" },
  { value: "api_key", label: "API Key" },
  { value: "bearer", label: "Bearer" },
  { value: "basic", label: "Basic" },
] as const;

export function AgentEndpointPanel() {
  const api = usePlatformApi();
  const [config, setConfig] = useState<AgentEndpointResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [endpointUrl, setEndpointUrl] = useState("");
  const [authType, setAuthType] = useState<string>("none");
  const [authHeaderName, setAuthHeaderName] = useState("X-API-Key");
  const [apiKey, setApiKey] = useState("");
  const [bearerToken, setBearerToken] = useState("");
  const [basicUsername, setBasicUsername] = useState("");
  const [basicPassword, setBasicPassword] = useState("");
  const [customHeaders, setCustomHeaders] = useState<Array<{ name: string; value: string }>>([]);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await api.getAgentEndpoint();
      setConfig(data);
      setEndpointUrl(data.config?.endpointUrl ?? "");
      setAuthType(data.config?.authType ?? "none");
      setAuthHeaderName(data.config?.authHeaderName ?? "X-API-Key");
      setBasicUsername(data.config?.basicUsername ?? "");
      setApiKey("");
      setBearerToken("");
      setBasicPassword("");
      setCustomHeaders([]);
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed to load" });
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.updateAgentEndpoint({
        endpointUrl: endpointUrl.trim() || null,
        authType: authType || null,
        authHeaderName: authType === "api_key" ? authHeaderName : null,
        basicUsername: authType === "basic" ? basicUsername : null,
      });
      setMessage({ type: "success", text: "Agent endpoint saved" });
      setApiKey("");
      setBearerToken("");
      setBasicPassword("");
      await fetchConfig();
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/agent-endpoint/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        setMessage({ type: "success", text: "Connection successful" });
      } else {
        setMessage({ type: "error", text: data.error ?? "Connection failed" });
      }
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Test failed" });
    } finally {
      setTesting(false);
    }
  };

  const addCustomHeader = () => setCustomHeaders((prev) => [...prev, { name: "", value: "" }]);
  const removeCustomHeader = (i: number) =>
    setCustomHeaders((prev) => prev.filter((_, idx) => idx !== i));
  const updateCustomHeader = (i: number, field: "name" | "value", value: string) =>
    setCustomHeaders((prev) =>
      prev.map((h, idx) => (idx === i ? { ...h, [field]: value } : h))
    );

  if (loading) {
    return (
      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">Agent endpoint</span>
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="p-4 space-y-4">
          <div>
            <Skeleton className="h-3 w-24 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-3 w-28 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-16" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel__header">
        <span className="panel__title">Agent endpoint</span>
        <span className={config?.config ? "badge badge--nominal" : "badge badge--neutral"}>
          {config?.config ? "Configured" : "Not set"}
        </span>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs text-tertiary tracking-wide uppercase mb-2">
            Endpoint URL
          </label>
          <input
            type="url"
            value={endpointUrl}
            onChange={(e) => setEndpointUrl(e.target.value)}
            className="w-full px-3 py-2 bg-elevated border border-border-default text-sm text-secondary focus:outline-none focus:border-data font-mono"
            placeholder="https://your-agent.example.com/invoke"
          />
        </div>

        <div>
          <label className="block text-xs text-tertiary tracking-wide uppercase mb-2">
            Authorization
          </label>
          <select
            value={authType}
            onChange={(e) => setAuthType(e.target.value)}
            className="w-full px-3 py-2 bg-elevated border border-border-default text-sm text-secondary focus:outline-none focus:border-data"
          >
            {AUTH_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {authType === "api_key" && (
          <>
            <div>
              <label className="block text-xs text-tertiary tracking-wide uppercase mb-2">
                Header name
              </label>
              <input
                type="text"
                value={authHeaderName}
                onChange={(e) => setAuthHeaderName(e.target.value)}
                className="w-full px-3 py-2 bg-elevated border border-border-default text-sm text-secondary focus:outline-none focus:border-data"
                placeholder="X-API-Key"
              />
            </div>
            <div>
              <label className="block text-xs text-tertiary tracking-wide uppercase mb-2">
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3 py-2 bg-elevated border border-border-default text-sm text-secondary focus:outline-none focus:border-data"
                placeholder={config?.config ? "••••••••" : ""}
              />
            </div>
          </>
        )}

        {authType === "bearer" && (
          <div>
            <label className="block text-xs text-tertiary tracking-wide uppercase mb-2">
              Token
            </label>
            <input
              type="password"
              value={bearerToken}
              onChange={(e) => setBearerToken(e.target.value)}
              className="w-full px-3 py-2 bg-elevated border border-border-default text-sm text-secondary focus:outline-none focus:border-data"
              placeholder={config?.config ? "••••••••" : ""}
            />
          </div>
        )}

        {authType === "basic" && (
          <>
            <div>
              <label className="block text-xs text-tertiary tracking-wide uppercase mb-2">
                Username
              </label>
              <input
                type="text"
                value={basicUsername}
                onChange={(e) => setBasicUsername(e.target.value)}
                className="w-full px-3 py-2 bg-elevated border border-border-default text-sm text-secondary focus:outline-none focus:border-data"
              />
            </div>
            <div>
              <label className="block text-xs text-tertiary tracking-wide uppercase mb-2">
                Password
              </label>
              <input
                type="password"
                value={basicPassword}
                onChange={(e) => setBasicPassword(e.target.value)}
                className="w-full px-3 py-2 bg-elevated border border-border-default text-sm text-secondary focus:outline-none focus:border-data"
                placeholder={config?.config ? "••••••••" : ""}
              />
            </div>
          </>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs text-tertiary tracking-wide uppercase">
              Custom headers (optional)
            </label>
            <button
              type="button"
              onClick={addCustomHeader}
              className="text-xs text-data hover:underline"
            >
              Add header
            </button>
          </div>
          <div className="space-y-2">
            {customHeaders.map((h, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={h.name}
                  onChange={(e) => updateCustomHeader(i, "name", e.target.value)}
                  className="flex-1 px-3 py-2 bg-elevated border border-border-default text-sm text-secondary focus:outline-none focus:border-data"
                  placeholder="Header name"
                />
                <input
                  type="text"
                  value={h.value}
                  onChange={(e) => updateCustomHeader(i, "value", e.target.value)}
                  className="flex-1 px-3 py-2 bg-elevated border border-border-default text-sm text-secondary focus:outline-none focus:border-data"
                  placeholder="Value"
                />
                <button
                  type="button"
                  onClick={() => removeCustomHeader(i)}
                  className="px-2 text-tertiary hover:text-critical"
                  aria-label="Remove header"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {message && (
          <p
            className={`text-sm ${
              message.type === "success" ? "text-nominal" : "text-critical"
            }`}
          >
            {message.text}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="btn btn--secondary"
          >
            {testing ? "Testing…" : "Test connection"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn btn--primary"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
