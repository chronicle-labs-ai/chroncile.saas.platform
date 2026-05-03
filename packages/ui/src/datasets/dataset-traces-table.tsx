"use client";

/*
 * DatasetTracesTable — tablecn-shaped replacement for `ListLens`.
 *
 * Owns the column model + the TanStack Table state engine (sorting,
 * column visibility) and renders the virtualized list of group heads
 * + rows + empty hints inside a real `<table>` element. The actual
 * row visuals live in `DatasetTracesTableRow`; this component is the
 * table chrome (header, virtualization, group heads, scroll-shadow).
 *
 * Architecture notes:
 *
 *   1. The TanStack table is a *state engine*, not a render engine.
 *      We don't `flexRender(cell.column.columnDef.cell, …)` — the
 *      row is a single grid-templated `<tr>` so the ember-rail /
 *      multi-select tint / focus ring all render across cells with
 *      no border seams.
 *
 *   2. Virtualization works inside `<table>`: `<tbody>` becomes
 *      `display: block; position: relative; height: totalSize`. Each
 *      `<tr>` is `position: absolute; transform: translateY(start)`.
 *      `<thead>` keeps default `display: table-header-group` so the
 *      header alignment is pure CSS-grid against the body's `<tr>`s
 *      (both share the same `grid-template-columns` track string).
 *
 *   3. Grouping stays canvas-side (the legacy `groupTracesBy` +
 *      `flatItems` shape, ported here). TanStack's
 *      `getGroupedRowModel` can't express "Unclustered" /
 *      `showEmptyGroups` / cluster-color fills cleanly, and the
 *      ListLens already had a working group-head + composition-bar
 *      UI we want to keep.
 *
 *   4. Filtering stays canvas-side too — the existing
 *      `useDataTableFilters` machinery is shared with Connections /
 *      Agents / Stream timeline, so swapping it here would break
 *      them. The table receives pre-filtered `traces`. (Migrating to
 *      TanStack `ColumnFiltersState` is tracked separately.)
 *
 *   5. The TanStack table instance is hoisted via
 *      `useDatasetTracesTable` so the canvas can:
 *        - reflect `RowSelectionState` ↔ `selectedIds`
 *        - drive header-click sort + the multi-column SortList
 *        - drive column visibility ↔ `displayProperties`
 *        - read the visible row order for j/k keyboard nav
 *      The table instance is the *single* source of truth for sort
 *      and visibility; the canvas reads/writes through callbacks.
 */

import * as React from "react";
import {
  getCoreRowModel,
  getFacetedUniqueValues,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type RowSelectionState,
  type SortingState,
  type Table,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

import { Checkbox } from "../primitives/checkbox";
import { cx } from "../utils/cx";

import { DataTableColumnHeader } from "./data-table/data-table-column-header";
import { ROW_HEIGHT_PX, type DatasetTracesRowHeight } from "./data-table/data-table-row-height-menu";
import {
  buildClusterIndex,
  DatasetTracesTableRow,
  tracesRowGridTemplate,
  type TracesRowColumnId,
} from "./dataset-traces-table-row";
import type {
  DatasetCluster,
  DatasetSnapshot,
  DatasetSplit,
  TraceStatus,
  TraceSummary,
} from "./types";

/* ── Public types ──────────────────────────────────────────────── */

export type DatasetTracesGroupBy =
  | "cluster"
  | "split"
  | "source"
  | "status"
  | "none";

/** @deprecated alias for `DatasetTracesRowHeight`. The 2-step
 *  density toggle was replaced with a 4-step row-height menu;
 *  callers passing `"dense"` / `"comfy"` are translated to
 *  `"default"` / `"comfortable"` at the boundary. */
export type DatasetTracesDensity = "dense" | "comfy";

export type { DatasetTracesRowHeight };

/** Toggleable column ids — mirrors `DatasetDisplayProperty`. The
 *  always-on columns (select / status / trace / chevron) aren't part
 *  of this set. */
export type DatasetTracesDisplayProperty =
  | "cluster"
  | "events"
  | "duration"
  | "split"
  | "traceId";

export const DATASET_TRACES_DISPLAY_PROPERTIES: readonly DatasetTracesDisplayProperty[] = [
  "cluster",
  "events",
  "duration",
  "split",
  "traceId",
];

interface UseDatasetTracesTableOptions {
  /** Pre-filtered, pre-text-searched traces (the same `filteredTraces`
   *  the legacy ListLens received). The table sorts these via
   *  TanStack's sorted row model. */
  data: readonly TraceSummary[];
  clusters: readonly DatasetCluster[];
  /** Controlled sort state — multi-column. */
  sorting: SortingState;
  onSortingChange: React.Dispatch<React.SetStateAction<SortingState>>;
  /** Controlled column visibility — pair with `onColumnVisibilityChange`. */
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: React.Dispatch<React.SetStateAction<VisibilityState>>;
  /** Controlled row selection (rowId = traceId). */
  rowSelection: RowSelectionState;
  onRowSelectionChange: React.Dispatch<React.SetStateAction<RowSelectionState>>;
}

export function useDatasetTracesTable({
  data,
  clusters,
  sorting,
  onSortingChange,
  columnVisibility,
  onColumnVisibilityChange,
  rowSelection,
  onRowSelectionChange,
}: UseDatasetTracesTableOptions): Table<TraceSummary> {
  const clusterIndex = React.useMemo(
    () => buildClusterIndex(clusters),
    [clusters],
  );

  const columns = React.useMemo<ColumnDef<TraceSummary>[]>(
    () => buildColumnDefs(clusterIndex),
    [clusterIndex],
  );

  return useReactTable({
    data: data as TraceSummary[],
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
    },
    enableRowSelection: true,
    enableMultiSort: true,
    onSortingChange: onSortingChange as React.Dispatch<React.SetStateAction<SortingState>>,
    onColumnVisibilityChange:
      onColumnVisibilityChange as React.Dispatch<React.SetStateAction<VisibilityState>>,
    onRowSelectionChange:
      onRowSelectionChange as React.Dispatch<React.SetStateAction<RowSelectionState>>,
    getRowId: (row) => row.traceId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });
}

/* ── Column defs ───────────────────────────────────────────────── */

const SPLIT_RANK: Record<string, number> = {
  train: 0,
  validation: 1,
  test: 2,
  __none__: 3,
};

function buildColumnDefs(
  clusterIndex: Map<string, DatasetCluster>,
): ColumnDef<TraceSummary>[] {
  return [
    {
      id: "select",
      enableSorting: false,
      enableHiding: false,
      meta: { label: "Select" },
    },
    {
      id: "status",
      accessorFn: (row) => row.status,
      enableSorting: false,
      enableHiding: false,
      meta: { label: "Status" },
    },
    {
      id: "trace",
      accessorFn: (row) => row.label,
      enableSorting: true,
      enableHiding: false,
      sortingFn: (a, b) => a.original.label.localeCompare(b.original.label),
      meta: { label: "Trace" },
    },
    {
      id: "cluster",
      accessorFn: (row) => row.clusterId ?? null,
      enableSorting: true,
      enableHiding: true,
      sortingFn: (a, b) => {
        const al = a.original.clusterId
          ? clusterIndex.get(a.original.clusterId)?.label ?? ""
          : "";
        const bl = b.original.clusterId
          ? clusterIndex.get(b.original.clusterId)?.label ?? ""
          : "";
        return al.localeCompare(bl);
      },
      meta: { label: "Cluster" },
    },
    {
      id: "events",
      accessorFn: (row) => row.eventCount,
      enableSorting: true,
      enableHiding: true,
      sortingFn: (a, b) => a.original.eventCount - b.original.eventCount,
      meta: { label: "Events" },
    },
    {
      id: "duration",
      accessorFn: (row) => row.durationMs,
      enableSorting: true,
      enableHiding: true,
      sortingFn: (a, b) => a.original.durationMs - b.original.durationMs,
      meta: { label: "Duration" },
    },
    {
      id: "split",
      accessorFn: (row) => row.split ?? null,
      enableSorting: true,
      enableHiding: true,
      sortingFn: (a, b) => {
        const ar = SPLIT_RANK[a.original.split ?? "__none__"] ?? 99;
        const br = SPLIT_RANK[b.original.split ?? "__none__"] ?? 99;
        if (ar !== br) return ar - br;
        const at = a.original.addedAt ? new Date(a.original.addedAt).getTime() : 0;
        const bt = b.original.addedAt ? new Date(b.original.addedAt).getTime() : 0;
        return at - bt;
      },
      meta: { label: "Split" },
    },
    {
      id: "traceId",
      accessorFn: (row) => row.traceId,
      enableSorting: true,
      enableHiding: true,
      sortingFn: (a, b) => a.original.traceId.localeCompare(b.original.traceId),
      meta: { label: "ID" },
    },
    {
      id: "chevron",
      enableSorting: false,
      enableHiding: false,
      meta: { label: "" },
    },
  ];
}

/** Map `DatasetTracesDisplayProperty` array → TanStack `VisibilityState`.
 *  Always-on columns get `true`; toggleable columns are `true` iff in
 *  the property set. */
export function visibilityFromDisplayProperties(
  props: readonly DatasetTracesDisplayProperty[],
): VisibilityState {
  const set = new Set(props);
  return {
    select: true,
    status: true,
    trace: true,
    cluster: set.has("cluster"),
    events: set.has("events"),
    duration: set.has("duration"),
    split: set.has("split"),
    traceId: set.has("traceId"),
    chevron: true,
  };
}

/** Reverse: TanStack `VisibilityState` → `DatasetTracesDisplayProperty[]`. */
export function displayPropertiesFromVisibility(
  vis: VisibilityState,
): readonly DatasetTracesDisplayProperty[] {
  const out: DatasetTracesDisplayProperty[] = [];
  for (const key of DATASET_TRACES_DISPLAY_PROPERTIES) {
    if (vis[key] !== false) out.push(key);
  }
  return out;
}

/** Map `selectedIds: readonly string[]` → TanStack `RowSelectionState`. */
export function rowSelectionFromIds(ids: readonly string[]): RowSelectionState {
  const out: RowSelectionState = {};
  for (const id of ids) out[id] = true;
  return out;
}

/** Reverse: extract selected row ids from a TanStack `RowSelectionState`. */
export function idsFromRowSelection(state: RowSelectionState): string[] {
  return Object.keys(state).filter((k) => state[k]);
}

/** Translate the legacy 2-step density to the new 4-step row height. */
export function densityToRowHeight(
  density: DatasetTracesDensity | DatasetTracesRowHeight,
): DatasetTracesRowHeight {
  if (density === "dense") return "default";
  if (density === "comfy") return "comfortable";
  return density;
}

/* ── Group / flat items ────────────────────────────────────────── */

interface FlatGroupItem {
  kind: "group";
  group: TraceGroup;
}
interface FlatRowItem {
  kind: "row";
  row: Row<TraceSummary>;
  groupKey: string;
}
interface FlatEmptyItem {
  kind: "empty";
  groupKey: string;
}
type FlatItem = FlatGroupItem | FlatRowItem | FlatEmptyItem;

interface TraceGroup {
  key: string;
  label: string;
  /** Solid token color for the dot (Tailwind class). */
  dot?: string;
  /** Optional inline fill (CSS variable for cluster colors). */
  fill?: string;
  rows: Row<TraceSummary>[];
}

function groupRows(
  rows: Row<TraceSummary>[],
  groupBy: DatasetTracesGroupBy,
  clusterIndex: Map<string, DatasetCluster>,
  snapshot: DatasetSnapshot,
  showEmptyGroups: boolean,
): TraceGroup[] {
  if (groupBy === "none") {
    return [{ key: "all", label: "", rows: [...rows] }];
  }

  const buckets = new Map<string, TraceGroup>();
  const order: TraceGroup[] = [];

  const ensure = (key: string, init: () => Omit<TraceGroup, "rows">): TraceGroup => {
    let existing = buckets.get(key);
    if (existing) return existing;
    existing = { ...init(), rows: [] } as TraceGroup;
    buckets.set(key, existing);
    order.push(existing);
    return existing;
  };

  if (showEmptyGroups) {
    if (groupBy === "cluster") {
      for (const cluster of snapshot.clusters) {
        ensure(cluster.id, () => ({
          key: cluster.id,
          label: cluster.label,
          fill: cluster.color,
        }));
      }
      ensure("__none__", () => ({
        key: "__none__",
        label: "Unclustered",
        dot: "bg-muted-foreground",
      }));
    } else if (groupBy === "split") {
      ensure("train", () => ({ key: "train", label: "Train", dot: "bg-event-violet" }));
      ensure("validation", () => ({
        key: "validation",
        label: "Validation",
        dot: "bg-event-teal",
      }));
      ensure("test", () => ({ key: "test", label: "Test", dot: "bg-event-amber" }));
      ensure("__unassigned__", () => ({
        key: "__unassigned__",
        label: "Unassigned",
        dot: "bg-muted-foreground",
      }));
    } else if (groupBy === "source") {
      const sources = new Set<string>();
      for (const t of snapshot.traces) {
        if (t.primarySource) sources.add(t.primarySource);
      }
      for (const source of Array.from(sources).sort()) {
        ensure(source, () => ({ key: source, label: source, dot: "bg-event-teal" }));
      }
    } else if (groupBy === "status") {
      ensure("ok", () => ({ key: "ok", label: "OK", dot: "bg-l-status-done" }));
      ensure("warn", () => ({
        key: "warn",
        label: "Warn",
        dot: "bg-l-status-inprogress",
      }));
      ensure("error", () => ({
        key: "error",
        label: "Error",
        dot: "bg-l-p-urgent",
      }));
    }
  }

  for (const row of rows) {
    const trace = row.original;
    if (groupBy === "cluster") {
      const id = trace.clusterId ?? "__none__";
      const cluster = trace.clusterId
        ? clusterIndex.get(trace.clusterId) ?? null
        : null;
      ensure(id, () => ({
        key: id,
        label: cluster?.label ?? "Unclustered",
        fill: cluster?.color,
        dot: cluster ? undefined : "bg-muted-foreground",
      })).rows.push(row);
      continue;
    }
    if (groupBy === "split") {
      const id = trace.split ?? "__unassigned__";
      ensure(id, () => ({
        key: id,
        label:
          trace.split === "train"
            ? "Train"
            : trace.split === "validation"
              ? "Validation"
              : trace.split === "test"
                ? "Test"
                : "Unassigned",
        dot:
          trace.split === "train"
            ? "bg-event-violet"
            : trace.split === "validation"
              ? "bg-event-teal"
              : trace.split === "test"
                ? "bg-event-amber"
                : "bg-muted-foreground",
      })).rows.push(row);
      continue;
    }
    if (groupBy === "source") {
      const id = trace.primarySource;
      ensure(id, () => ({
        key: id,
        label: id,
        dot: "bg-event-teal",
      })).rows.push(row);
      continue;
    }
    /* status */
    const id = trace.status;
    ensure(id, () => ({
      key: id,
      label:
        trace.status === "ok"
          ? "OK"
          : trace.status === "warn"
            ? "Warn"
            : "Error",
      dot:
        trace.status === "ok"
          ? "bg-l-status-done"
          : trace.status === "warn"
            ? "bg-l-status-inprogress"
            : "bg-l-p-urgent",
    })).rows.push(row);
  }

  if (!showEmptyGroups) {
    return order.filter((g) => g.rows.length > 0);
  }
  return order;
}

/* ── Group head + breakdown bar ────────────────────────────────── */

interface GroupBreakdownSegment {
  key: string;
  label: string;
  pct: number;
  bg: string;
}

interface GroupBreakdown {
  total: number;
  segments: GroupBreakdownSegment[];
}

function computeGroupBreakdown(
  group: TraceGroup,
  groupBy: DatasetTracesGroupBy,
): GroupBreakdown | null {
  const total = group.rows.length;
  if (total <= 1) return null;

  if (groupBy === "cluster" || groupBy === "source" || groupBy === "none") {
    const counts: Record<TraceStatus, number> = { ok: 0, warn: 0, error: 0 };
    for (const r of group.rows) counts[r.original.status] += 1;
    const segs: GroupBreakdownSegment[] = [];
    if (counts.ok > 0)
      segs.push({
        key: "ok",
        label: "OK",
        pct: (counts.ok / total) * 100,
        bg: "bg-l-status-done",
      });
    if (counts.warn > 0)
      segs.push({
        key: "warn",
        label: "Warn",
        pct: (counts.warn / total) * 100,
        bg: "bg-l-status-inprogress",
      });
    if (counts.error > 0)
      segs.push({
        key: "error",
        label: "Error",
        pct: (counts.error / total) * 100,
        bg: "bg-l-p-urgent",
      });
    return { total, segments: segs };
  }

  if (groupBy === "split" || groupBy === "status") {
    const counts: Record<DatasetSplit | "__none__", number> = {
      train: 0,
      validation: 0,
      test: 0,
      __none__: 0,
    };
    for (const r of group.rows) {
      counts[r.original.split ?? "__none__"] += 1;
    }
    const segs: GroupBreakdownSegment[] = [];
    if (counts.train > 0)
      segs.push({
        key: "train",
        label: "Train",
        pct: (counts.train / total) * 100,
        bg: "bg-event-violet",
      });
    if (counts.validation > 0)
      segs.push({
        key: "validation",
        label: "Validation",
        pct: (counts.validation / total) * 100,
        bg: "bg-event-teal",
      });
    if (counts.test > 0)
      segs.push({
        key: "test",
        label: "Test",
        pct: (counts.test / total) * 100,
        bg: "bg-event-amber",
      });
    if (counts.__none__ > 0)
      segs.push({
        key: "__none__",
        label: "Unassigned",
        pct: (counts.__none__ / total) * 100,
        bg: "bg-muted-foreground",
      });
    return { total, segments: segs };
  }

  return null;
}

interface GroupHeadProps {
  label: string;
  count: number;
  dot?: string;
  fill?: string;
  breakdown: GroupBreakdown | null;
  colSpan: number;
}

function GroupHead({ label, count, dot, fill, breakdown, colSpan }: GroupHeadProps) {
  return (
    <td
      colSpan={colSpan}
      className="flex h-7 items-center gap-2 border-b border-border bg-muted/30 px-2 align-middle"
    >
      <span
        aria-hidden
        className={cx("size-1.5 shrink-0 rounded-pill", dot)}
        style={fill ? { background: fill } : undefined}
      />
      <span className="truncate text-sm font-medium text-foreground">
        {label || "All"}
      </span>
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {count}
      </span>
      {breakdown && breakdown.segments.length > 0 ? (
        <span
          aria-hidden
          className="ml-auto flex h-1.5 w-[80px] overflow-hidden rounded-pill bg-muted"
        >
          {breakdown.segments.map((s) => (
            <span
              key={s.key}
              className={cx("h-full", s.bg)}
              style={{ width: `${s.pct}%` }}
            />
          ))}
        </span>
      ) : null}
    </td>
  );
}

function EmptyGroupHint({ colSpan }: { colSpan: number }) {
  return (
    <td
      colSpan={colSpan}
      className="block px-2 py-2 align-middle text-sm text-muted-foreground"
    >
      No traces in this group.
    </td>
  );
}

/* ── Header ────────────────────────────────────────────────────── */

interface ListHeaderProps {
  table: Table<TraceSummary>;
  showCluster: boolean;
  showEvents: boolean;
  showDuration: boolean;
  showSplit: boolean;
  showTraceId: boolean;
  selectAllState: "none" | "indeterminate" | "all";
  onSelectAllVisible: (next: boolean) => void;
  columnWidths: Partial<Record<TracesRowColumnId, number>>;
  onResize: (id: TracesRowColumnId, next: number | null) => void;
  scrolled: boolean;
}

function ListHeader({
  table,
  showCluster,
  showEvents,
  showDuration,
  showSplit,
  showTraceId,
  selectAllState,
  onSelectAllVisible,
  columnWidths,
  onResize,
  scrolled,
}: ListHeaderProps) {
  const checked: boolean | "indeterminate" =
    selectAllState === "all"
      ? true
      : selectAllState === "indeterminate"
        ? "indeterminate"
        : false;

  const sorting = table.getState().sorting;
  const sortCount = sorting.length;

  return (
    <tr
      style={{
        gridTemplateColumns: tracesRowGridTemplate(
          showCluster,
          showEvents,
          showDuration,
          showSplit,
          showTraceId,
          columnWidths,
        ),
      }}
      className={cx(
        "sticky top-0 z-20 grid items-center h-10 bg-card",
        /* Match the body row inset so column boundaries align. */
        "px-3",
        "transition-shadow duration-fast ease-out motion-reduce:transition-none",
        scrolled
          ? "shadow-[0_1px_0_0_var(--border),0_4px_8px_-6px_rgba(0,0,0,0.45)]"
          : null,
      )}
    >
      <th
        scope="col"
        className="flex h-10 items-center justify-center px-2 align-middle text-muted-foreground"
      >
        <Checkbox
          size="sm"
          checked={checked}
          aria-label={
            selectAllState === "all"
              ? "Deselect all visible traces"
              : "Select all visible traces"
          }
          onClick={(e) => {
            e.stopPropagation();
            onSelectAllVisible(selectAllState !== "all");
          }}
          onChange={() => undefined}
        />
      </th>
      <th scope="col" aria-hidden className="h-10" />

      <SortHeaderCell
        table={table}
        columnId="trace"
        label="Trace"
        sortCount={sortCount}
        onResize={onResize}
      />
      {showCluster ? (
        <SortHeaderCell
          table={table}
          columnId="cluster"
          label="Cluster"
          sortCount={sortCount}
          onResize={onResize}
        />
      ) : null}
      {showEvents ? (
        <SortHeaderCell
          table={table}
          columnId="events"
          label="Events"
          align="right"
          sortCount={sortCount}
          onResize={onResize}
        />
      ) : null}
      {showDuration ? (
        <SortHeaderCell
          table={table}
          columnId="duration"
          label="Duration"
          align="right"
          sortCount={sortCount}
          onResize={onResize}
        />
      ) : null}
      {showSplit ? (
        <SortHeaderCell
          table={table}
          columnId="split"
          label="Split"
          sortCount={sortCount}
          onResize={onResize}
        />
      ) : null}
      {showTraceId ? (
        <SortHeaderCell
          table={table}
          columnId="traceId"
          label="ID"
          sortCount={sortCount}
          onResize={onResize}
        />
      ) : null}

      <th scope="col" aria-hidden className="h-10" />
    </tr>
  );
}

interface SortHeaderCellProps {
  table: Table<TraceSummary>;
  columnId: TracesRowColumnId;
  label: string;
  align?: "left" | "right";
  sortCount: number;
  onResize: (id: TracesRowColumnId, next: number | null) => void;
}

function SortHeaderCell({
  table,
  columnId,
  label,
  align = "left",
  sortCount,
  onResize: _onResize,
}: SortHeaderCellProps) {
  const column = table.getColumn(columnId);
  const sorting = table.getState().sorting;
  const sortIndex = sorting.findIndex((s) => s.id === columnId);
  const ariaSort: React.AriaAttributes["aria-sort"] =
    sortIndex >= 0
      ? sorting[sortIndex]?.desc
        ? "descending"
        : "ascending"
      : "none";

  if (!column) return <th scope="col" aria-hidden />;

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={cx(
        "relative flex h-10 min-w-0 items-center px-2 align-middle text-left text-sm font-medium text-muted-foreground",
        align === "right" ? "justify-end" : "justify-start",
      )}
    >
      <DataTableColumnHeader
        column={column}
        label={label}
        sortIndex={sortIndex >= 0 ? sortIndex : undefined}
        sortCount={sortCount}
        align={align}
      />
    </th>
  );
}

/* ── DatasetTracesTable ────────────────────────────────────────── */

export interface DatasetTracesTableProps {
  table: Table<TraceSummary>;
  snapshot: DatasetSnapshot;
  groupBy: DatasetTracesGroupBy;
  /** Row height — accepts the new 4-step `DatasetTracesRowHeight` or
   *  the legacy `"dense" | "comfy"` density names (translated at the
   *  boundary). */
  rowHeight: DatasetTracesRowHeight | DatasetTracesDensity;
  showEmptyGroups: boolean;
  selectedTraceId?: string | null;
  focusedTraceId?: string | null;
  failingTraceIdSet?: ReadonlySet<string>;
  onRowClick: (
    traceId: string,
    event: React.MouseEvent | React.KeyboardEvent,
  ) => void;
  onCheckboxChange: (
    traceId: string,
    next: boolean,
    event: React.MouseEvent,
  ) => void;
  selectAllState: "none" | "indeterminate" | "all";
  onSelectAllVisible: (next: boolean) => void;
  canEdit?: boolean;
  onUpdateCluster?: (traceId: string, next: string | null) => void;
  onUpdateSplit?: (traceId: string, next: DatasetSplit | null) => void;
  onUpdateStatus?: (traceId: string, next: TraceStatus) => void;
  /** Total count of traces in the snapshot (pre-filter). Drives the
   *  tablecn-style footer strip — `{filtered} of {total} rows`. When
   *  omitted the footer falls back to the filtered count alone. */
  totalCount?: number;
  /** Optional empty placeholder when `table.getRowModel().rows` is
   *  empty after filter+sort. Defaults to a chron-styled empty hint. */
  emptyPlaceholder?: React.ReactNode;
  /** Hide the footer strip. Defaults to false (footer rendered). */
  hideFooter?: boolean;
  className?: string;
}

export function DatasetTracesTable({
  table,
  snapshot,
  groupBy,
  rowHeight: rowHeightProp,
  showEmptyGroups,
  selectedTraceId,
  focusedTraceId,
  failingTraceIdSet,
  onRowClick,
  onCheckboxChange,
  selectAllState,
  onSelectAllVisible,
  canEdit,
  onUpdateCluster,
  onUpdateSplit,
  onUpdateStatus,
  totalCount,
  emptyPlaceholder,
  hideFooter,
  className,
}: DatasetTracesTableProps) {
  const rowHeightKey = densityToRowHeight(rowHeightProp);
  const rowHeight = ROW_HEIGHT_PX[rowHeightKey];

  const clusterIndex = React.useMemo(
    () => buildClusterIndex(snapshot.clusters),
    [snapshot.clusters],
  );

  const visibility = table.getState().columnVisibility;
  const showCluster = visibility.cluster !== false;
  const showEvents = visibility.events !== false;
  const showDuration = visibility.duration !== false;
  const showSplit = visibility.split !== false;
  const showTraceId = visibility.traceId === true;
  /* When grouping by cluster, suppress the per-row cluster column so
     it doesn't echo the group head. */
  const showClusterColumn = showCluster && groupBy !== "cluster";

  const sortedRows = table.getRowModel().rows;

  const grouped = React.useMemo(
    () =>
      groupRows(
        sortedRows,
        groupBy,
        clusterIndex,
        snapshot,
        showEmptyGroups,
      ),
    [sortedRows, groupBy, clusterIndex, snapshot, showEmptyGroups],
  );

  const flatItems = React.useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = [];
    for (const group of grouped) {
      if (groupBy !== "none") {
        items.push({ kind: "group", group });
      }
      if (group.rows.length === 0) {
        items.push({ kind: "empty", groupKey: group.key });
        continue;
      }
      for (const row of group.rows) {
        items.push({ kind: "row", row, groupKey: group.key });
      }
    }
    return items;
  }, [grouped, groupBy]);

  /* Roving tabindex: focused row when set, otherwise the first
     visible data row. */
  const tabStopId = React.useMemo<string | null>(() => {
    if (focusedTraceId) return focusedTraceId;
    for (const item of flatItems) {
      if (item.kind === "row") return item.row.original.traceId;
    }
    return null;
  }, [focusedTraceId, flatItems]);

  /* Local-only column widths (resizable header). Resets on remount. */
  const [columnWidths, setColumnWidths] = React.useState<
    Partial<Record<TracesRowColumnId, number>>
  >({});

  const handleResize = React.useCallback(
    (id: TracesRowColumnId, next: number | null) => {
      setColumnWidths((prev) => {
        if (next === null) {
          if (prev[id] === undefined) return prev;
          const copy = { ...prev };
          delete copy[id];
          return copy;
        }
        return { ...prev, [id]: next };
      });
    },
    [],
  );

  /* Sticky-header scroll feedback. A 1px sentinel at the top of the
     card; when it leaves the viewport we toggle the soft drop-shadow. */
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root) return;
    const obs = new IntersectionObserver(
      ([entry]) => setScrolled(entry ? !entry.isIntersecting : false),
      { root, threshold: 0 },
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, []);

  const groupHeadHeight = 28;
  const emptyHintHeight = 32;

  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const item = flatItems[index];
      if (!item) return rowHeight;
      if (item.kind === "group") return groupHeadHeight;
      if (item.kind === "empty") return emptyHintHeight;
      return rowHeight;
    },
    overscan: 8,
    getItemKey: (index) => {
      const item = flatItems[index];
      if (!item) return index;
      if (item.kind === "group") return `g:${item.group.key}`;
      if (item.kind === "empty") return `e:${item.groupKey}`;
      return `r:${item.row.original.traceId}`;
    },
  });

  /* Drive scroll position through the virtualizer when the keyboard
     caret moves to a row outside the virtualized window. */
  React.useEffect(() => {
    if (!focusedTraceId) return;
    const idx = flatItems.findIndex(
      (it) => it.kind === "row" && it.row.original.traceId === focusedTraceId,
    );
    if (idx >= 0) virtualizer.scrollToIndex(idx, { align: "auto" });
  }, [focusedTraceId, flatItems, virtualizer]);

  const colCount =
    4 /* select + status + trace + chevron */ +
    (showClusterColumn ? 1 : 0) +
    (showEvents ? 1 : 0) +
    (showDuration ? 1 : 0) +
    (showSplit ? 1 : 0) +
    (showTraceId ? 1 : 0);

  if (sortedRows.length === 0 && !showEmptyGroups) {
    return (
      <>
        {emptyPlaceholder ?? (
          <div className="flex flex-1 min-h-0 items-center justify-center px-4 py-12 font-mono text-[11px] text-muted-foreground">
            No traces match the current filters.
          </div>
        )}
      </>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const totalDataRows = flatItems.reduce(
    (acc, it) => (it.kind === "row" ? acc + 1 : acc),
    0,
  );
  const filteredCount = sortedRows.length;
  const selectedCount = table.getFilteredSelectedRowModel().rows.length;

  return (
    <div
      className={cx(
        "flex flex-1 min-h-0 flex-col gap-2.5 p-4",
        className,
      )}
    >
      <div
        ref={scrollRef}
        className="chron-scrollbar-hidden flex-1 min-h-0 overflow-auto rounded-md border border-border"
      >
        {/* Sentinel must be first so its visibility tracks scrollTop=0. */}
        <div ref={sentinelRef} aria-hidden className="h-px" />
        <table
          className="w-full caption-bottom text-sm"
          aria-rowcount={totalDataRows + 1}
          aria-colcount={colCount}
        >
          <thead className="block [&_tr]:border-b">
            <ListHeader
              table={table}
              showCluster={showClusterColumn}
              showEvents={showEvents}
              showDuration={showDuration}
              showSplit={showSplit}
              showTraceId={showTraceId}
              selectAllState={selectAllState}
              onSelectAllVisible={onSelectAllVisible}
              columnWidths={columnWidths}
              onResize={handleResize}
              scrolled={scrolled}
            />
          </thead>
          <tbody
            className="block relative [&_tr:last-child]:border-0"
            style={{ height: totalSize }}
          >
            {virtualItems.map((virtualItem) => {
              const item = flatItems[virtualItem.index];
              if (!item) return null;

              const wrapperStyle: React.CSSProperties = {
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${virtualItem.start}px)`,
              };

              if (item.kind === "group") {
                return (
                  <tr
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    style={wrapperStyle}
                    /* Match the data-row `px-3` so the group head's
                       leading dot lines up with the row content area. */
                    className="block px-3"
                  >
                    <GroupHead
                      label={item.group.label}
                      count={item.group.rows.length}
                      dot={item.group.dot}
                      fill={item.group.fill}
                      breakdown={computeGroupBreakdown(item.group, groupBy)}
                      colSpan={colCount}
                    />
                  </tr>
                );
              }

              if (item.kind === "empty") {
                return (
                  <tr
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    style={wrapperStyle}
                    className="block px-3"
                  >
                    <EmptyGroupHint colSpan={colCount} />
                  </tr>
                );
              }

              const trace = item.row.original;
              return (
                <DatasetTracesTableRow
                  key={virtualItem.key}
                  trace={trace}
                  cluster={
                    !showClusterColumn
                      ? null
                      : trace.clusterId
                        ? clusterIndex.get(trace.clusterId) ?? null
                        : null
                  }
                  rowHeightPx={rowHeight}
                  showCluster={showClusterColumn}
                  showEvents={showEvents}
                  showDuration={showDuration}
                  showSplit={showSplit}
                  showTraceId={showTraceId}
                  columnWidths={columnWidths}
                  isActive={trace.traceId === selectedTraceId}
                  isMultiSelected={item.row.getIsSelected()}
                  isFocused={trace.traceId === focusedTraceId}
                  isTabStop={trace.traceId === tabStopId}
                  ariaRowIndex={virtualItem.index + 2 /* header is row 1 */}
                  isFailing={failingTraceIdSet?.has(trace.traceId) ?? false}
                  onSelect={onRowClick}
                  selectable
                  onMultiSelectChange={onCheckboxChange}
                  editable={canEdit}
                  clusters={canEdit ? snapshot.clusters : undefined}
                  onUpdateCluster={canEdit ? onUpdateCluster : undefined}
                  onUpdateSplit={canEdit ? onUpdateSplit : undefined}
                  onUpdateStatus={canEdit ? onUpdateStatus : undefined}
                  style={wrapperStyle}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {hideFooter ? null : (
        <DataTableFooter
          selectedCount={selectedCount}
          filteredCount={filteredCount}
          totalCount={totalCount ?? snapshot.traces.length}
        />
      )}
    </div>
  );
}

interface DataTableFooterProps {
  selectedCount: number;
  filteredCount: number;
  totalCount: number;
}

/** Tablecn-style footer strip: `{n} of {m} row(s) selected.` on the
 *  left, total/filtered count on the right. We don't paginate (the
 *  table virtualizes), so the page-size + page-nav controls are
 *  intentionally omitted — the row count IS the navigation hint. */
function DataTableFooter({
  selectedCount,
  filteredCount,
  totalCount,
}: DataTableFooterProps) {
  const isFiltered = filteredCount !== totalCount;
  return (
    <div className="flex items-center justify-between gap-4 px-2 text-sm text-muted-foreground">
      <span aria-live="polite">
        {selectedCount} of {filteredCount} row(s) selected.
      </span>
      <span className="font-mono text-xs tabular-nums">
        {isFiltered ? (
          <>
            {filteredCount} of {totalCount} rows
          </>
        ) : (
          <>{totalCount} rows</>
        )}
      </span>
    </div>
  );
}
