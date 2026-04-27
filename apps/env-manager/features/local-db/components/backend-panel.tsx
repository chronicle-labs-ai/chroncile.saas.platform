"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/shared/fetcher";
import { ActionButton, Spinner, type ActionState } from "./shared";

export function BackendPanel({
  backendPid,
  backendHealthy,
  databaseUrl,
  onRefresh,
}: {
  backendPid: number | null;
  backendHealthy: boolean;
  databaseUrl: string;
  onRefresh: () => void;
}) {
  const [restartState, setRestartState] = useState<ActionState>("idle");
  const [showLogs, setShowLogs] = useState(false);
  const [restartError, setRestartError] = useState<string | null>(null);

  const shouldPollLogs = showLogs || restartState === "loading";
  const { data: logsData } = useSWR<{ logs: string }>(
    shouldPollLogs ? "/api/local-db/backend-logs" : null,
    fetcher,
    { refreshInterval: restartState === "loading" ? 2_000 : 5_000 }
  );

  const doRestart = async () => {
    setRestartState("loading");
    setRestartError(null);
    setShowLogs(true);
    try {
      const res = await fetch("/api/local-db/restart-backend", {
        method: "POST",
      });
      const data = await res.json();
      setRestartState(data.success ? "success" : "error");
      if (!data.success) setRestartError(data.error ?? "Restart failed");
    } catch {
      setRestartState("error");
      setRestartError("Request failed");
    }
    onRefresh();
    setTimeout(() => setRestartState("idle"), 5000);
  };

  return (
    <div className="panel">
      <div className="panel__header">
        <div className="flex items-center gap-2">
          <span
            className={`status-dot ${backendHealthy ? "status-dot--nominal" : "status-dot--critical"}`}
          />
          <span className="panel__title">Backend Process</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="btn btn--ghost btn--sm font-mono text-[10px]"
          >
            {showLogs ? "Hide Logs" : "Show Logs"}
          </button>
          <span className="font-mono text-[10px] text-tertiary uppercase tracking-wider">
            {backendHealthy
              ? "healthy"
              : backendPid
                ? "unhealthy"
                : "not running"}
          </span>
        </div>
      </div>
      <div className="panel__content space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <span className="label block mb-1">PID</span>
            <span className="font-mono text-sm text-primary">
              {backendPid ?? "—"}
            </span>
          </div>
          <div>
            <span className="label block mb-1">Health</span>
            <span
              className={`font-mono text-sm ${backendHealthy ? "text-nominal" : "text-critical"}`}
            >
              {backendHealthy ? "ok" : "down"}
            </span>
          </div>
          <div>
            <span className="label block mb-1">Database URL</span>
            <span className="font-mono text-[11px] text-secondary break-all">
              {databaseUrl}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-3 border-t border-border-dim">
          <ActionButton
            onClick={doRestart}
            state={restartState}
            label="Restart Backend"
            loadingLabel="Restarting..."
            className="btn btn--secondary btn--sm"
          />
          {restartState === "loading" && (
            <span className="text-xs text-tertiary">
              Compiling Rust — this may take 60-120s
            </span>
          )}
          {restartState === "success" && (
            <span className="text-xs text-nominal font-mono">
              Restarted successfully
            </span>
          )}
          {restartState === "error" && (
            <span className="text-xs text-critical font-mono">
              {restartError ?? "Restart failed"}
            </span>
          )}
        </div>

        {showLogs && (
          <div className="pt-3 border-t border-border-dim">
            <div className="flex items-center justify-between mb-2">
              <span className="label">Backend Logs</span>
              {restartState === "loading" && (
                <span className="flex items-center gap-1.5 text-[10px] text-tertiary font-mono">
                  <Spinner /> live
                </span>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto bg-[var(--bg-sunken)] rounded">
              <pre className="px-3 py-2 text-[11px] font-mono text-secondary whitespace-pre-wrap break-all leading-relaxed">
                {logsData?.logs ||
                  "No logs yet. Restart the backend to see output here."}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
