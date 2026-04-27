"use client";

import { useState } from "react";
import type { ContainerStatus, DbInfo } from "@/lib/local-db";
import {
  ActionButton,
  Spinner,
  containerDotClass,
  type ActionState,
} from "./shared";

export function ContainerPanel({
  container,
  dbInfo,
  databaseUrl,
  dockerAvailable,
  onRefresh,
}: {
  container: ContainerStatus;
  dbInfo: DbInfo | null;
  databaseUrl: string;
  dockerAvailable: boolean;
  onRefresh: () => void;
}) {
  const [startState, setStartState] = useState<ActionState>("idle");
  const [stopState, setStopState] = useState<ActionState>("idle");
  const [resetState, setResetState] = useState<ActionState>("idle");
  const [confirmReset, setConfirmReset] = useState(false);

  const doAction = async (
    url: string,
    setter: (s: ActionState) => void,
    body?: object
  ) => {
    setter("loading");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      setter(res.ok ? "success" : "error");
    } catch {
      setter("error");
    }
    onRefresh();
    setTimeout(() => setter("idle"), 2000);
  };

  return (
    <div className="panel">
      <div className="panel__header">
        <div className="flex items-center gap-2">
          <span
            className={`status-dot ${containerDotClass(container.state)}`}
          />
          <span className="panel__title">Docker Postgres</span>
        </div>
        <span className="font-mono text-[10px] text-tertiary uppercase tracking-wider">
          {container.state}
        </span>
      </div>
      <div className="panel__content space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="label block mb-1">State</span>
            <span className="font-mono text-sm text-primary">
              {container.state}
            </span>
          </div>
          <div>
            <span className="label block mb-1">Container ID</span>
            <span className="font-mono text-sm text-primary">
              {container.containerId ?? "—"}
            </span>
          </div>
          <div>
            <span className="label block mb-1">Image</span>
            <span className="font-mono text-sm text-primary">
              {container.image ?? "—"}
            </span>
          </div>
          <div>
            <span className="label block mb-1">PG Ready</span>
            <span className="font-mono text-sm text-primary">
              {container.pgReady ? "yes" : "no"}
            </span>
          </div>
        </div>

        {dbInfo && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-border-dim">
            <div>
              <span className="label block mb-1">Tables</span>
              <span className="font-mono text-sm text-primary">
                {dbInfo.tableCount}
              </span>
            </div>
            <div>
              <span className="label block mb-1">Connections</span>
              <span className="font-mono text-sm text-primary">
                {dbInfo.activeConnections}
              </span>
            </div>
            <div className="col-span-2">
              <span className="label block mb-1">Database URL</span>
              <span className="font-mono text-[11px] text-secondary break-all">
                {databaseUrl}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-3 border-t border-border-dim">
          <ActionButton
            onClick={() => doAction("/api/local-db/start", setStartState)}
            state={startState}
            label="Start"
            loadingLabel="Starting..."
            className="btn btn--primary btn--sm"
            disabled={container.state === "running" || !dockerAvailable}
          />
          <ActionButton
            onClick={() => doAction("/api/local-db/stop", setStopState)}
            state={stopState}
            label="Stop"
            loadingLabel="Stopping..."
            className="btn btn--secondary btn--sm"
            disabled={container.state !== "running" || !dockerAvailable}
          />
          {confirmReset ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-caution">Wipe all data?</span>
              <button
                onClick={() => {
                  setConfirmReset(false);
                  doAction("/api/local-db/reset", setResetState, {
                    migrate: true,
                  });
                }}
                className="btn btn--critical btn--sm"
                disabled={resetState === "loading"}
              >
                {resetState === "loading" ? (
                  <span className="flex items-center gap-2">
                    <Spinner />
                    Resetting...
                  </span>
                ) : (
                  "Confirm Reset"
                )}
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="btn btn--secondary btn--sm"
              >
                Cancel
              </button>
            </div>
          ) : (
            <ActionButton
              onClick={() => setConfirmReset(true)}
              state={resetState}
              label="Reset"
              loadingLabel="Resetting..."
              className="btn btn--critical btn--sm"
            />
          )}
        </div>
      </div>
    </div>
  );
}
