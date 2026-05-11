"use client";

/*
 * DatasetTracesTableRow — dense Linear-density row representing one
 * trace, mounted inside the tablecn-powered `DatasetTracesTable`.
 *
 * This is the successor to the old `TraceSummaryRow`. The row's
 * visual affordances (source-logo stack, label, cluster pill,
 * events / duration / split / traceId, ember rail, multi-select
 * rail, focus ring, failing dot, chevron, inline pickers) are
 * lifted verbatim — only the host element shape changed.
 *
 * Element shape:
 *   - The row is a real `<tr>` (matches tablecn's table semantics
 *     so screen readers get proper row navigation).
 *   - Each cell is a real `<td>`.
 *   - The `<tr>` uses `display: grid` with the same
 *     `grid-template-columns` track string the header uses, so
 *     header + body cells align without `<colgroup>` plumbing AND
 *     virtualization can absolutely-position each `<tr>` without
 *     breaking the table's auto-layout.
 *
 * Used by:
 *   - `DatasetTracesTable` (the new List lens) — translates TanStack
 *     row state into these props at the call site.
 *   - `DatasetClusterCard` (per-cluster collapsible) — passes a
 *     plain `trace` object with `density="comfy"` and no header.
 *   - The dataset detail-page Overview "Recent additions" panel.
 */

import * as React from "react";
import { ChevronRight } from "lucide-react";

import { Checkbox } from "../primitives/checkbox";
import { formatNumber, RelativeTime } from "../connections/time";
import { cx } from "../utils/cx";

import { DatasetSplitChip } from "./dataset-split-chip";
import { ClusterPicker, SplitPicker } from "./dataset-trace-pickers";
import { SourceLogoStack } from "./source-logo-stack";
import type { DatasetCluster, DatasetSplit, TraceSummary } from "./types";

export interface DatasetTracesTableRowProps {
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
  /** Whether this row is the current roving tab stop for the grid.
   *  In a roving-tabindex pattern only one row is `tabIndex={0}` at a
   *  time; siblings get `-1`. The parent computes this — typically
   *  the focused row, falling back to the first visible row when no
   *  caret is set. */
  isTabStop?: boolean;
  /** Zero-based row index in the visible grid. Used for `aria-rowindex`
   *  so the surrounding `<table>` reads correctly to assistive tech.
   *  Header is row 1, so the first data row is typically 2. */
  ariaRowIndex?: number;
  /** Whether the active eval run (in the canvas toolbar) failed
   *  on this trace. Renders a discrete red dot on the leading edge
   *  alongside the status indicator. */
  isFailing?: boolean;
  /** Click handler — when present the row becomes a button.
   *  Receives the original mouse event so the caller can branch on
   *  shift/cmd-click for range / additive multi-select. */
  onSelect?: (
    traceId: string,
    event: React.MouseEvent | React.KeyboardEvent
  ) => void;
  /** Hide the chevron affordance on the right. Defaults to false when
   *  `onSelect` is set, true otherwise. */
  hideChevron?: boolean;
  /** Row height in pixels. Driven by the canvas's RowHeightMenu;
   *  mirrors the height the virtualizer reserves for this row. */
  rowHeightPx?: number;

  /** Toggleable column visibility — driven by the canvas's TanStack
   *  column visibility state. Hidden columns drop out of the grid
   *  template so the remaining cells redistribute width naturally.
   *  The trace-label cell is always shown. */
  showCluster?: boolean;
  showEvents?: boolean;
  showDuration?: boolean;
  showSplit?: boolean;
  showTraceId?: boolean;

  /** Per-column pixel widths (resizable header pattern). When
   *  provided, override the defaults baked into `tracesRowGridTemplate`. */
  columnWidths?: Partial<Record<TracesRowColumnId, number>>;

  /** Render chips as inline pickers instead of static labels. */
  editable?: boolean;
  /** Cluster set for the picker. Required when `editable` and
   *  `cluster` is rendered. */
  clusters?: readonly DatasetCluster[];
  onUpdateCluster?: (traceId: string, next: string | null) => void;
  onUpdateSplit?: (traceId: string, next: DatasetSplit | null) => void;

  /** Show a checkbox in the leading slot. When set, clicking the
   *  checkbox calls `onMultiSelectChange`. */
  selectable?: boolean;
  onMultiSelectChange?: (
    traceId: string,
    next: boolean,
    event: React.MouseEvent
  ) => void;

  /** Optional extra leading slot rendered before the checkbox.
   *  Mostly used by the inspector queue. */
  selectSlot?: React.ReactNode;
  className?: string;

  /** When true, the row renders as a `<div>` instead of a `<tr>`.
   *  Use this when the row is mounted outside a `<table>` (e.g.
   *  the cluster card's Collapsible). Defaults to false. */
  asDiv?: boolean;
  /** Extra inline style applied to the host element. The virtualizer
   *  uses this to position rows absolutely. */
  style?: React.CSSProperties;
}

export function DatasetTracesTableRow({
  trace,
  cluster,
  isActive,
  isMultiSelected,
  isFocused,
  isTabStop,
  ariaRowIndex,
  isFailing,
  showCluster: showClusterProp,
  showEvents: showEventsProp,
  showDuration: showDurationProp,
  showSplit: showSplitProp,
  showTraceId: showTraceIdProp,
  onSelect,
  hideChevron,
  rowHeightPx,
  editable,
  clusters,
  onUpdateCluster,
  onUpdateSplit,
  selectable,
  onMultiSelectChange,
  selectSlot,
  className,
  columnWidths,
  asDiv,
  style,
}: DatasetTracesTableRowProps) {
  const showChevron = hideChevron == null ? !!onSelect : !hideChevron;
  const interactive = !!onSelect;
  const heightStyle = rowHeightPx != null ? { height: rowHeightPx } : undefined;

  const showCluster = showClusterProp !== false;
  const showEvents = showEventsProp !== false;
  const showDuration = showDurationProp !== false;
  const showSplit = showSplitProp !== false;
  const showTraceId = showTraceIdProp === true;

  const clusterEditable =
    editable && !!onUpdateCluster && !!clusters && clusters.length > 0;
  const splitEditable = editable && !!onUpdateSplit;

  const gridTemplate = tracesRowGridTemplate(
    showCluster,
    showEvents,
    showDuration,
    showSplit,
    showTraceId,
    columnWidths
  );

  /* Roving tabindex: when the parent passes `isTabStop`, only the
     active row is in the tab order. Without it (legacy callers), every
     interactive row stays tabbable. */
  const tabIndex = interactive
    ? isTabStop !== undefined
      ? isTabStop
        ? 0
        : -1
      : 0
    : undefined;

  /* Match shadcn `<TableRow>` chrome: thin bottom border, soft
     hover wash, `data-[state=selected]:bg-muted` styling. The
     ember rail (a Chronicle signature) is kept as a 2-px
     pseudo-element on the leading edge of active / multi-selected
     rows — additive to shadcn's row chrome, not a replacement.
     Hover affordance is a soft rounded inset overlay (`after:`
     pseudo-element), mirroring the datasets list view's
     pseudo-button pattern so the affordance feels card-like
     instead of cell-flush. */
  const rowClassName = cx(
    "group relative isolate grid items-center",
    /* No horizontal inset — rows / sticky header / group heads all
       run edge-to-edge so their bottom borders line up with the
       scroll container's rounded outline. Cells provide their own
       internal padding via the `Cell` base. */
    "border-b border-l-border-faint transition-[background-color,box-shadow] data-[state=selected]:bg-l-surface-selected",
    "font-sans text-[13px] text-l-ink",
    "motion-reduce:transition-none",
    /* Full-bleed hover overlay — spans the entire row so the
       affordance reads as the whole line, not an inset card. */
    "after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:bg-transparent after:transition-colors after:duration-fast motion-reduce:after:transition-none",
    interactive
      ? cx(
          "cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40",
          /* Hover state guarded by `(hover: hover)` so iOS / touch
             devices don't get a stuck wash after tap. */
          "[@media(hover:hover)]:hover:after:bg-l-surface-hover"
        )
      : null,
    isActive
      ? "bg-l-surface-selected before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[2px] before:bg-ember"
      : null,
    isMultiSelected && !isActive
      ? "bg-ember/[0.06] before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[2px] before:bg-ember/40"
      : null,
    isFocused && !isActive ? "ring-1 ring-inset ring-ember/40" : null,
    className
  );

  const sharedProps = {
    "aria-rowindex": ariaRowIndex,
    "aria-selected": (isMultiSelected || isActive ? true : undefined) as
      | true
      | undefined,
    tabIndex,
    onKeyDown: interactive
      ? (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect?.(trace.traceId, e);
          }
        }
      : undefined,
    onClick: interactive
      ? (e: React.MouseEvent) => onSelect?.(trace.traceId, e)
      : undefined,
    /* shadcn `<TableRow>` reads `data-state="selected"` to apply
       its selected-row background; we mirror the same hook so
       paste-in upstream snippets / theming "just work." */
    "data-state": (isActive || isMultiSelected ? "selected" : undefined) as
      | "selected"
      | undefined,
    "data-active": isActive || undefined,
    "data-multi-selected": isMultiSelected || undefined,
    "data-canvas-focus": isFocused || undefined,
    "data-trace-id": trace.traceId,
    "data-failing": isFailing || undefined,
    style: {
      gridTemplateColumns: gridTemplate,
      ...heightStyle,
      ...style,
    } as React.CSSProperties,
    className: rowClassName,
  };

  const cells = (
    <>
      <Cell
        asDiv={asDiv}
        onClick={(e) => e.stopPropagation()}
        className="flex items-center justify-center"
      >
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
      </Cell>

      <Cell asDiv={asDiv} className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 font-mono text-[12px] tabular-nums text-l-ink-dim">
          {formatTraceKey(trace.traceId)}
        </span>
        <span className="truncate font-medium text-l-ink">{trace.label}</span>
        {isFailing ? (
          <span
            aria-label="Failed in active eval run"
            title="Failed in active eval run"
            className="pointer-events-none size-1.5 shrink-0 rounded-pill bg-l-p-urgent"
          />
        ) : null}
        <SourceLogoStack
          sources={
            trace.sources.length > 0 ? trace.sources : [trace.primarySource]
          }
          size={12}
          radius={2}
          max={3}
          ringClassName="ring-card"
          className="shrink-0"
        />
      </Cell>

      {showCluster ? (
        <Cell asDiv={asDiv} className="min-w-0">
          {clusterEditable ? (
            <ClusterPicker
              value={trace.clusterId ?? null}
              clusters={clusters!}
              onChange={(next) => onUpdateCluster!(trace.traceId, next)}
              variant="ghost"
            />
          ) : cluster ? (
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-pill border border-l-border-faint px-2 py-1 text-l-ink-lo">
              <span
                aria-hidden
                className="size-1.5 shrink-0 rounded-pill"
                style={{ background: cluster.color }}
              />
              <span className="truncate text-[12px]">{cluster.label}</span>
            </span>
          ) : (
            /* Empty cluster: render nothing instead of an em-dash. The
               grid track holds the column width so alignment is stable.
               A faint hover-only dot keeps the slot discoverable when
               the user hovers over the row. */
            <span
              aria-hidden
              className="block size-1 rounded-pill bg-muted-foreground/0 group-hover:bg-muted-foreground/30 transition-colors"
            />
          )}
        </Cell>
      ) : null}

      {showEvents ? (
        <Cell
          asDiv={asDiv}
          className="text-right font-mono text-[12px] tabular-nums text-l-ink-dim"
        >
          {formatNumber(trace.eventCount)}
        </Cell>
      ) : null}

      {showDuration ? (
        <Cell
          asDiv={asDiv}
          className="text-right font-mono text-[12px] tabular-nums text-l-ink-dim"
        >
          {formatTraceDuration(trace.durationMs)}
        </Cell>
      ) : null}

      {showSplit ? (
        <Cell asDiv={asDiv} className="min-w-0">
          {splitEditable ? (
            <SplitPicker
              value={trace.split ?? null}
              onChange={(next) => onUpdateSplit!(trace.traceId, next)}
              variant="ghost"
            />
          ) : trace.split ? (
            <DatasetSplitChip split={trace.split} compact />
          ) : trace.addedAt ? (
            <span className="font-mono text-[11.5px] text-l-ink-dim">
              <RelativeTime iso={trace.addedAt} fallback="" />
            </span>
          ) : (
            <span aria-hidden />
          )}
        </Cell>
      ) : null}

      {showTraceId ? (
        <Cell
          asDiv={asDiv}
          className="truncate font-mono text-[11px] text-l-ink-dim"
        >
          {trace.traceId}
        </Cell>
      ) : null}

      <Cell asDiv={asDiv} className="flex justify-end text-l-ink-dim">
        {showChevron ? (
          <ChevronRight
            className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-data-[active=true]:opacity-100"
            strokeWidth={1.75}
          />
        ) : null}
      </Cell>
    </>
  );

  if (asDiv) {
    return (
      <div role="row" {...sharedProps}>
        {cells}
      </div>
    );
  }

  return <tr {...sharedProps}>{cells}</tr>;
}

interface CellProps extends React.HTMLAttributes<HTMLElement> {
  asDiv?: boolean;
}

/** Mirrors shadcn `<TableCell>`'s base — `px-3 align-middle`. The
 *  caller's `className` is appended so per-column overrides
 *  (`text-right`, `min-w-0`, etc.) still win without losing the
 *  base padding. The 12 px horizontal inset gives content room to
 *  breathe inside an edge-to-edge row (which otherwise has no row
 *  inset of its own — the borders run flush with the scroll
 *  container so each row reads as one connected band). */
function Cell({ asDiv, className, children, ...rest }: CellProps) {
  const merged = cx("px-3 align-middle", className);
  if (asDiv) {
    return (
      <div role="cell" className={merged} {...rest}>
        {children}
      </div>
    );
  }
  return (
    <td
      className={merged}
      {...(rest as React.TdHTMLAttributes<HTMLTableCellElement>)}
    >
      {children}
    </td>
  );
}

/* ── Column model ───────────────────────────────────────────────── */

/** Stable identifiers for each grid track. The ordering of this list
 *  is the visual column order; toggling visibility just hides a track
 *  but keeps the row-template / header in sync. */
export type TracesRowColumnId =
  | "select"
  | "trace"
  | "cluster"
  | "events"
  | "duration"
  | "split"
  | "traceId"
  | "chevron";

interface TracesRowColumnDef {
  id: TracesRowColumnId;
  /** Default `grid-template-columns` track value when the column is
   *  visible. Numeric pixel widths are resizable; `minmax(0,Xfr)` is
   *  fluid (and not resizable). */
  defaultTrack: string;
  /** Default fixed width in px. Used when a numeric override is in
   *  play (resize). For fluid columns this is a minimum hint. */
  defaultPx: number;
  /** Whether the user can drag the right edge of this column. */
  resizable: boolean;
  /** Min/max pixel width during a resize drag. */
  minPx?: number;
  maxPx?: number;
}

export const TRACES_ROW_COLUMNS: readonly TracesRowColumnDef[] = [
  { id: "select", defaultTrack: "16px", defaultPx: 16, resizable: false },
  {
    id: "trace",
    defaultTrack: "minmax(180px,1.6fr)",
    defaultPx: 320,
    resizable: true,
    minPx: 180,
    maxPx: 720,
  },
  {
    id: "cluster",
    defaultTrack: "minmax(120px,0.8fr)",
    defaultPx: 180,
    resizable: true,
    minPx: 120,
    maxPx: 360,
  },
  {
    id: "events",
    defaultTrack: "64px",
    defaultPx: 64,
    resizable: true,
    minPx: 56,
    maxPx: 120,
  },
  {
    id: "duration",
    defaultTrack: "64px",
    defaultPx: 64,
    resizable: true,
    minPx: 56,
    maxPx: 120,
  },
  {
    id: "split",
    defaultTrack: "88px",
    defaultPx: 88,
    resizable: true,
    minPx: 72,
    maxPx: 200,
  },
  {
    id: "traceId",
    defaultTrack: "120px",
    defaultPx: 120,
    resizable: true,
    minPx: 80,
    maxPx: 320,
  },
  { id: "chevron", defaultTrack: "16px", defaultPx: 16, resizable: false },
];

const COLUMN_BY_ID: ReadonlyMap<TracesRowColumnId, TracesRowColumnDef> =
  new Map(TRACES_ROW_COLUMNS.map((c) => [c.id, c]));

/** Inline `grid-template-columns` for the trace row + matching list
 *  header. Inline-style instead of a Tailwind class so toggling
 *  columns at runtime is JIT-safe. */
export function tracesRowGridTemplate(
  showCluster: boolean,
  showEvents: boolean,
  showDuration: boolean,
  showSplit: boolean,
  showTraceId: boolean = false,
  widths?: Partial<Record<TracesRowColumnId, number>>
): string {
  const visibility: Record<TracesRowColumnId, boolean> = {
    select: true,
    trace: true,
    cluster: showCluster,
    events: showEvents,
    duration: showDuration,
    split: showSplit,
    traceId: showTraceId,
    chevron: true,
  };
  const tracks: string[] = [];
  for (const col of TRACES_ROW_COLUMNS) {
    if (!visibility[col.id]) continue;
    const override = widths?.[col.id];
    if (override !== undefined && Number.isFinite(override)) {
      tracks.push(`${Math.round(override)}px`);
    } else {
      tracks.push(col.defaultTrack);
    }
  }
  return tracks.join(" ");
}

/** Lookup helper for resize handlers — returns the column definition
 *  by id (min/max bounds, resizable flag). */
export function getTracesRowColumn(
  id: TracesRowColumnId
): TracesRowColumnDef | undefined {
  return COLUMN_BY_ID.get(id);
}

/** Compact wall-clock duration for table rows. */
export function formatTraceDuration(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1_000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.round(ms / 3_600_000)}h`;
}

function formatTraceKey(traceId: string): string {
  const explicit = traceId.match(/(?:trace[_-])?([a-z]+)?[_-]?(\d+)$/i);
  if (explicit?.[2]) {
    return `TR-${explicit[2].padStart(3, "0")}`;
  }
  let hash = 0;
  for (let i = 0; i < traceId.length; i += 1) {
    hash = (hash * 31 + traceId.charCodeAt(i)) % 997;
  }
  return `TR-${String(hash + 1).padStart(3, "0")}`;
}

/** Lookup helper for grouping a trace list by cluster. */
export function buildClusterIndex(
  clusters: readonly DatasetCluster[]
): Map<string, DatasetCluster> {
  return new Map(clusters.map((c) => [c.id, c]));
}
