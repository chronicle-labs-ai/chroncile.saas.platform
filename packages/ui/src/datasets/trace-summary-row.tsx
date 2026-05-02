"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";

import { CompanyLogo } from "../icons";
import { Status } from "../primitives/status";
import { formatNumber, RelativeTime } from "../connections/time";
import { cx } from "../utils/cx";

import { clusterColor } from "./cluster-color";
import { DatasetSplitChip } from "./dataset-split-chip";
import type { DatasetCluster, TraceStatus, TraceSummary } from "./types";

/*
 * TraceSummaryRow — dense Linear-density row representing one trace.
 *
 * Used by:
 *   - The Traces tab (table-style list with grouping by cluster).
 *   - The Clusters tab (inside expanded `DatasetClusterCard`s).
 *   - The dataset detail-page Overview "Recent additions" panel.
 *
 * Presentational + uncontrolled-friendly: selection state lives at
 * the boundary (the parent passes `isActive`).
 */

export interface TraceSummaryRowProps {
  trace: TraceSummary;
  /** Optional cluster lookup so we can show the cluster dot + label
   *  inline. When omitted, the cluster column is suppressed. */
  cluster?: DatasetCluster | null;
  /** Tone the row when it's the current selection. */
  isActive?: boolean;
  /** Click handler — when present the row becomes a button. */
  onSelect?: (traceId: string) => void;
  /** Hide the chevron affordance on the right. Defaults to false when
   *  `onSelect` is set, true otherwise. */
  hideChevron?: boolean;
  /** Density variant — `dense` is the table row (32px), `comfy` is the
   *  cluster-card row (36px). */
  density?: "dense" | "comfy";
  /** Optional checkbox slot rendered before the source logo (used by
   *  bulk-remove flows in the Traces tab). */
  selectSlot?: React.ReactNode;
  className?: string;
}

const STATUS_KIND: Record<TraceStatus, React.ComponentProps<typeof Status>["kind"]> = {
  ok: "done",
  warn: "inprogress",
  error: "todo",
};

const STATUS_RING: Record<TraceStatus, string> = {
  ok: "ring-l-status-done/30",
  warn: "ring-l-status-inprogress/40",
  error: "ring-l-p-urgent/40",
};

export function TraceSummaryRow({
  trace,
  cluster,
  isActive,
  onSelect,
  hideChevron,
  density = "dense",
  selectSlot,
  className,
}: TraceSummaryRowProps) {
  const showChevron = hideChevron == null ? !!onSelect : !hideChevron;
  const interactive = !!onSelect;
  const heightClass = density === "dense" ? "h-8" : "h-9";

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.(trace.traceId);
              }
            }
          : undefined
      }
      onClick={interactive ? () => onSelect?.(trace.traceId) : undefined}
      data-active={isActive || undefined}
      data-status={trace.status}
      className={cx(
        "group relative grid items-center gap-2 px-2",
        "grid-cols-[16px_18px_minmax(0,1.5fr)_minmax(0,0.7fr)_64px_64px_60px_16px]",
        heightClass,
        "border-b border-l-border-faint last:border-b-0",
        "font-sans text-[12.5px] text-l-ink",
        interactive
          ? "cursor-pointer hover:bg-l-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40"
          : null,
        isActive
          ? "bg-l-surface-selected before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[2px] before:bg-ember"
          : null,
        className,
      )}
    >
      <div onClick={(e) => e.stopPropagation()}>{selectSlot}</div>

      <Status
        kind={STATUS_KIND[trace.status]}
        size={12}
        className={cx("ring-1", STATUS_RING[trace.status])}
        ariaLabel={`status: ${trace.status}`}
      />

      <div className="flex min-w-0 items-center gap-2">
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] border border-l-border-faint bg-l-surface-input"
          aria-hidden
        >
          <CompanyLogo
            name={trace.primarySource}
            size={12}
            radius={2}
            fallbackBackground="transparent"
            fallbackColor="var(--l-ink-dim)"
          />
        </span>
        <span className="truncate text-l-ink">{trace.label}</span>
        <span className="truncate font-mono text-[10px] text-l-ink-dim">
          {trace.traceId}
        </span>
      </div>

      {cluster ? (
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-pill"
            style={{ background: cluster.color }}
          />
          <span className="truncate text-[11.5px] text-l-ink-lo">
            {cluster.label}
          </span>
        </span>
      ) : (
        <span className="font-mono text-[10px] text-l-ink-dim">—</span>
      )}

      <span className="text-right font-mono text-[11px] text-l-ink-lo">
        {formatNumber(trace.eventCount)}
      </span>

      <span className="text-right font-mono text-[11px] text-l-ink-lo">
        {formatDuration(trace.durationMs)}
      </span>

      <span className="font-mono text-[11px] text-l-ink-dim">
        {trace.split ? (
          <DatasetSplitChip split={trace.split} compact />
        ) : trace.addedAt ? (
          <RelativeTime iso={trace.addedAt} fallback="—" />
        ) : (
          "—"
        )}
      </span>

      <span className="flex justify-end text-l-ink-dim">
        {showChevron ? (
          <ChevronRight
            className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-data-[active=true]:opacity-100"
            strokeWidth={1.75}
          />
        ) : null}
      </span>
    </div>
  );
}

/** Compact wall-clock duration for table rows. */
function formatDuration(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1_000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.round(ms / 3_600_000)}h`;
}

/** Lookup helper for grouping a trace list by cluster. */
export function buildClusterIndex(
  clusters: readonly DatasetCluster[],
): Map<string, DatasetCluster> {
  return new Map(clusters.map((c) => [c.id, c]));
}

export { formatDuration as formatTraceDuration };
