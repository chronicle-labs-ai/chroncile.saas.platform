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
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.(run.runId);
              }
            }
          : undefined
      }
      onClick={interactive ? () => onSelect?.(run.runId) : undefined}
      data-active={isActive || undefined}
      data-status={run.status}
      className={cx(
        "group relative grid items-center gap-3 px-4",
        "grid-cols-[16px_minmax(0,76px)_minmax(0,90px)_minmax(0,80px)_minmax(0,80px)_minmax(0,1fr)_minmax(0,140px)]",
        density === "compact" ? "h-9" : "h-10",
        "border-b border-l-border-faint last:border-b-0 first:rounded-t-[4px] last:rounded-b-[4px]",
        "font-sans text-[13px] text-l-ink",
        interactive
          ? "cursor-pointer hover:bg-l-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40"
          : null,
        isActive
          ? "bg-l-surface-selected before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[2px] before:bg-ember"
          : null,
        className,
      )}
    >
      <RunStatusDot status={run.status} />

      <span className="flex min-w-0 flex-col gap-[1px]">
        <span className="truncate font-sans text-[12px] text-l-ink-lo">
          {formatStableTime(run.startedAt)}
        </span>
        <span className="truncate font-sans text-[11px] text-l-ink-dim">
          <RelativeTime iso={run.startedAt} fallback="—" />
        </span>
      </span>

      <span className="text-left">
        <AgentVersionBadge version={version} />
      </span>

      <span className="truncate font-sans text-[12px] text-l-ink-lo">
        {run.operation}
      </span>

      <span className="truncate text-right font-sans text-[12px] text-l-ink-lo">
        {run.durationMs != null ? formatMs(run.durationMs) : "—"}
      </span>

      <span className="flex min-w-0 items-center">
        <TokenUsageBar usage={run.response?.usage} />
      </span>

      <span className="flex min-w-0 flex-col items-end gap-[1px] truncate font-sans text-[11px] text-l-ink-dim">
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
