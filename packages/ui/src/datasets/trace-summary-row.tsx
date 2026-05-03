"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";

import { CompanyLogo } from "../icons";
import { Status } from "../primitives/status";
import { Checkbox } from "../primitives/checkbox";
import { formatNumber, RelativeTime } from "../connections/time";
import { cx } from "../utils/cx";

import { DatasetSplitChip } from "./dataset-split-chip";
import {
  ClusterPicker,
  SplitPicker,
  StatusPicker,
} from "./dataset-trace-pickers";
import type {
  DatasetCluster,
  DatasetSplit,
  TraceStatus,
  TraceSummary,
} from "./types";

/*
 * TraceSummaryRow — dense Linear-density row representing one trace.
 *
 * Used by:
 *   - The Traces tab (table-style list with grouping by cluster).
 *   - The Clusters tab (inside expanded `DatasetClusterCard`s).
 *   - The dataset detail-page Overview "Recent additions" panel.
 *
 * Presentational + uncontrolled-friendly: selection state lives at
 * the boundary (the parent passes `isActive` for the inspector
 * focus, `isMultiSelected` for the multi-select state).
 *
 * Two mutation modes:
 *   - `editable=false` (default) — chips are read-only labels.
 *   - `editable=true` — cluster / status / split render as inline
 *     pickers wired through `onUpdateCluster` / `onUpdateStatus` /
 *     `onUpdateSplit` callbacks. The row's parent is responsible for
 *     deciding whether the change applies to one trace or to the
 *     whole multi-select.
 */

export interface TraceSummaryRowProps {
  trace: TraceSummary;
  /** Optional cluster lookup so we can show the cluster dot + label
   *  inline. When omitted, the cluster column is suppressed. */
  cluster?: DatasetCluster | null;
  /** Tone the row when it's the inspector's current selection. */
  isActive?: boolean;
  /** Whether this row is part of a multi-row selection. */
  isMultiSelected?: boolean;
  /** Whether this row is the keyboard-focused row. Drives the
   *  `data-canvas-focus` attribute the canvas's `scrollIntoView`
   *  uses to find the row in the DOM. */
  isFocused?: boolean;
  /** Whether the active eval run (in the canvas's left rail) failed
   *  on this trace. Renders a discrete red dot on the leading edge
   *  alongside the status indicator. */
  isFailing?: boolean;
  /** Click handler — when present the row becomes a button.
   *  Receives the original mouse event so the caller can branch on
   *  shift/cmd-click for range / additive multi-select. */
  onSelect?: (
    traceId: string,
    event: React.MouseEvent | React.KeyboardEvent,
  ) => void;
  /** Hide the chevron affordance on the right. Defaults to false when
   *  `onSelect` is set, true otherwise. */
  hideChevron?: boolean;
  /** Density variant — `dense` is the table row (32px), `comfy` is the
   *  cluster-card row (36px). */
  density?: "dense" | "comfy";

  /** Toggleable column visibility — driven by the canvas's Display
   *  popover. Hidden columns drop out of the grid template so the
   *  remaining cells redistribute width naturally. Status + the
   *  trace-label cell are always shown. */
  showCluster?: boolean;
  showEvents?: boolean;
  showDuration?: boolean;
  showSplit?: boolean;
  showTraceId?: boolean;

  /** Render chips as inline pickers instead of static labels. */
  editable?: boolean;
  /** Cluster set for the picker. Required when `editable` and
   *  `cluster` is rendered. */
  clusters?: readonly DatasetCluster[];
  onUpdateCluster?: (traceId: string, next: string | null) => void;
  onUpdateSplit?: (traceId: string, next: DatasetSplit | null) => void;
  onUpdateStatus?: (traceId: string, next: TraceStatus) => void;

  /** Show a checkbox in the leading slot. When set, clicking the
   *  checkbox calls `onMultiSelectChange`. */
  selectable?: boolean;
  onMultiSelectChange?: (
    traceId: string,
    next: boolean,
    event: React.MouseEvent,
  ) => void;

  /** Optional extra leading slot rendered before the checkbox /
   *  status indicator. Mostly used by the inspector queue. */
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
  isMultiSelected,
  isFocused,
  isFailing,
  showCluster: showClusterProp,
  showEvents: showEventsProp,
  showDuration: showDurationProp,
  showSplit: showSplitProp,
  showTraceId: showTraceIdProp,
  onSelect,
  hideChevron,
  density = "dense",
  editable,
  clusters,
  onUpdateCluster,
  onUpdateSplit,
  onUpdateStatus,
  selectable,
  onMultiSelectChange,
  selectSlot,
  className,
}: TraceSummaryRowProps) {
  const showChevron = hideChevron == null ? !!onSelect : !hideChevron;
  const interactive = !!onSelect;
  const heightClass = density === "dense" ? "h-8" : "h-9";

  /* Column visibility — defaults preserve the legacy layout when
     callers don't pass anything. */
  const showCluster = showClusterProp !== false;
  const showEvents = showEventsProp !== false;
  const showDuration = showDurationProp !== false;
  const showSplit = showSplitProp !== false;
  const showTraceId = showTraceIdProp !== false;

  const clusterEditable =
    editable && !!onUpdateCluster && !!clusters && clusters.length > 0;
  const splitEditable = editable && !!onUpdateSplit;
  const statusEditable = editable && !!onUpdateStatus;

  const gridTemplate = traceRowGridTemplate(
    showCluster,
    showEvents,
    showDuration,
    showSplit,
  );

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.(trace.traceId, e);
              }
            }
          : undefined
      }
      onClick={interactive ? (e) => onSelect?.(trace.traceId, e) : undefined}
      data-active={isActive || undefined}
      data-multi-selected={isMultiSelected || undefined}
      data-canvas-focus={isFocused || undefined}
      data-trace-id={trace.traceId}
      data-status={trace.status}
      data-failing={isFailing || undefined}
      style={{ gridTemplateColumns: gridTemplate }}
      className={cx(
        "group relative grid items-center gap-2 px-2",
        heightClass,
        "border-b border-l-border-faint last:border-b-0",
        "font-sans text-[12.5px] text-l-ink",
        "transition-colors duration-fast ease-out motion-reduce:transition-none",
        interactive
          ? "cursor-pointer hover:bg-l-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40"
          : null,
        isActive
          ? "bg-l-surface-selected before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[2px] before:bg-ember"
          : null,
        isMultiSelected && !isActive ? "bg-ember/[0.06]" : null,
        isFocused && !isActive
          ? "ring-1 ring-inset ring-ember/40"
          : null,
        className,
      )}
    >
      <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center">
        {selectable ? (
          <Checkbox
            size="sm"
            checked={!!isMultiSelected}
            aria-label={`Select trace ${trace.label}`}
            onChange={(_next) => undefined}
            /* Use a click handler — Radix' onCheckedChange doesn't
               carry the event, but we need shift-click semantics. */
            onClick={(e) => {
              e.stopPropagation();
              onMultiSelectChange?.(trace.traceId, !isMultiSelected, e);
            }}
          />
        ) : (
          selectSlot
        )}
      </div>

      <div className="relative flex items-center justify-center">
        {statusEditable ? (
          <StatusPicker
            value={trace.status}
            onChange={(next) => onUpdateStatus!(trace.traceId, next)}
            variant="dot"
          />
        ) : (
          <Status
            kind={STATUS_KIND[trace.status]}
            size={12}
            className={cx("ring-1", STATUS_RING[trace.status])}
            ariaLabel={`status: ${trace.status}`}
          />
        )}
        {isFailing ? (
          <span
            aria-label="Failed in active eval run"
            title="Failed in active eval run"
            className="pointer-events-none absolute -right-0.5 -top-0.5 size-1.5 rounded-pill bg-l-p-urgent ring-1 ring-l-surface-raised"
          />
        ) : null}
      </div>

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
        {showTraceId ? (
          <span className="truncate font-mono text-[10px] text-l-ink-dim">
            {trace.traceId}
          </span>
        ) : null}
      </div>

      {showCluster ? (
        clusterEditable ? (
          <ClusterPicker
            value={trace.clusterId ?? null}
            clusters={clusters!}
            onChange={(next) => onUpdateCluster!(trace.traceId, next)}
            variant="ghost"
          />
        ) : cluster ? (
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
        )
      ) : null}

      {showEvents ? (
        <span className="text-right font-mono text-[11px] tabular-nums text-l-ink-lo">
          {formatNumber(trace.eventCount)}
        </span>
      ) : null}

      {showDuration ? (
        <span className="text-right font-mono text-[11px] tabular-nums text-l-ink-lo">
          {formatDuration(trace.durationMs)}
        </span>
      ) : null}

      {showSplit ? (
        splitEditable ? (
          <SplitPicker
            value={trace.split ?? null}
            onChange={(next) => onUpdateSplit!(trace.traceId, next)}
            variant="ghost"
          />
        ) : (
          <span className="font-mono text-[11px] text-l-ink-dim">
            {trace.split ? (
              <DatasetSplitChip split={trace.split} compact />
            ) : trace.addedAt ? (
              <RelativeTime iso={trace.addedAt} fallback="—" />
            ) : (
              "—"
            )}
          </span>
        )
      ) : null}

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

/** Inline `grid-template-columns` for the trace row + matching list
 *  header. Inline-style instead of a Tailwind class so toggling
 *  columns at runtime is JIT-safe. */
export function traceRowGridTemplate(
  showCluster: boolean,
  showEvents: boolean,
  showDuration: boolean,
  showSplit: boolean,
): string {
  const cols: string[] = ["16px", "18px", "minmax(0,1.5fr)"];
  if (showCluster) cols.push("minmax(0,0.7fr)");
  if (showEvents) cols.push("64px");
  if (showDuration) cols.push("64px");
  if (showSplit) cols.push("72px");
  cols.push("16px");
  return cols.join(" ");
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
