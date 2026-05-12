"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import { formatStableTime, RelativeTime } from "../connections/time";

import { AgentVersionBadge } from "./agent-version-badge";
import { RunStatusDot } from "./run-status-dot";
import { TokenUsageBar } from "./token-usage-bar";
import type { AgentRun } from "./types";

/*
 * AgentRunRow — single row in the Runs table. 7-column dense Linear
 * grid:
 *
 *   ● status  | started | version | operation | duration | tokens | actor / env
 *
 * The status dot pulses on `started`; success / error use the standard
 * tones. The TokenUsageBar takes a slice in the row so the customer
 * can spot prompt-cache hits at a glance.
 */

export interface AgentRunRowProps {
  run: AgentRun;
  isActive?: boolean;
  onSelect?: (runId: string) => void;
  density?: "compact" | "default";
  className?: string;
}

export function AgentRunRow({
  run,
  isActive,
  onSelect,
  density = "default",
  className,
}: AgentRunRowProps) {
  const interactive = onSelect != null;
  const version = run.artifactId.split("@")[1] ?? run.artifactId;

  return (
    <div
      data-active={isActive || undefined}
      data-status={run.status}
      className={cx(
        "group relative isolate grid items-center gap-3 px-4",
        "grid-cols-[16px_minmax(0,76px)_minmax(0,90px)_minmax(0,80px)_minmax(0,80px)_minmax(0,1fr)_minmax(0,140px)]",
        density === "compact" ? "h-9" : "h-10",
        "border-b border-l-border-faint last:border-b-0 first:rounded-t-[4px] last:rounded-b-[4px]",
        "font-sans text-[13px] text-l-ink",
        isActive
          ? "bg-l-surface-selected before:absolute before:left-0 before:top-1 before:bottom-1 before:z-10 before:w-[2px] before:bg-ember"
          : null,
        className,
      )}
    >
      {interactive ? (
        <button
          type="button"
          aria-label={`Open run ${run.runId} (${run.status})`}
          onClick={() => onSelect?.(run.runId)}
          className={cx(
            "absolute inset-0 z-0 cursor-pointer",
            "first:rounded-t-[3px] last:rounded-b-[3px]",
            "transition-colors duration-fast",
            "hover:bg-l-surface-hover",
            "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-ember",
          )}
        />
      ) : null}

      <span className="pointer-events-none relative">
        <RunStatusDot status={run.status} />
      </span>

      <span className="pointer-events-none relative flex min-w-0 flex-col gap-[1px]">
        <span className="truncate font-sans text-[12px] tabular-nums text-l-ink-lo">
          {formatStableTime(run.startedAt)}
        </span>
        <span className="truncate font-sans text-[11px] tabular-nums text-l-ink-dim">
          <RelativeTime iso={run.startedAt} fallback="—" />
        </span>
      </span>

      <span className="pointer-events-none relative text-left">
        <AgentVersionBadge version={version} />
      </span>

      <span className="pointer-events-none relative truncate font-sans text-[12px] text-l-ink-lo">
        {run.operation}
      </span>

      <span className="pointer-events-none relative truncate text-right font-sans text-[12px] tabular-nums text-l-ink-lo">
        {run.durationMs != null ? formatMs(run.durationMs) : "—"}
      </span>

      <span className="pointer-events-none relative flex min-w-0 items-center">
        <TokenUsageBar usage={run.response?.usage} />
      </span>

      <span className="pointer-events-none relative flex min-w-0 flex-col items-end gap-[1px] truncate font-sans text-[11px] text-l-ink-dim">
        <span className="truncate">{run.trace?.userId ?? "—"}</span>
        <span className="truncate">
          {run.trace?.environment ?? run.response?.modelId ?? "—"}
        </span>
      </span>
    </div>
  );
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
