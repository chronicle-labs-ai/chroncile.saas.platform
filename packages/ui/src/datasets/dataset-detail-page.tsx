"use client";

import * as React from "react";
import {
  Check,
  Layers,
  List as ListIcon,
  Network,
  PieChart,
  Pencil,
  Plus,
  SlidersHorizontal,
  Timer,
  Trash2,
  X,
} from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import { Input } from "../primitives/input";
import { Kbd } from "../primitives/kbd";
import { Tooltip } from "../primitives/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/popover";
import {
  StreamTimelineViewer,
  type StreamPlaybackState,
  type StreamTimelineGroupBy,
} from "../stream-timeline";
import {
  useDataTableFilters,
  type ColumnConfig,
  type FilterState,
} from "../product/filters";
import { formatNumber } from "../connections/time";

import { DatasetFilterRail } from "./dataset-filter-rail";

import { DATASET_PURPOSE_META } from "./purpose-meta";
import { DatasetActionsMenu } from "./dataset-actions-menu";
import {
  DatasetCoverageLens,
  type CoverageBucketSelection,
} from "./dataset-coverage-lens";
import { DatasetEmpty } from "./dataset-empty";
import { DatasetGraphView } from "./dataset-graph-view";
import { defaultDatasetTraceColumns } from "./dataset-trace-columns";
import {
  ClearSelectionButton,
  ClusterPicker,
  SplitPicker,
} from "./dataset-trace-pickers";
import { DatasetTraceDetailDrawer } from "./dataset-trace-detail-drawer";
import {
  useDatasetCanvasKeyboard,
  type DatasetCanvasHandlers,
} from "./dataset-canvas-keyboard";
import { DatasetCommandPalette } from "./dataset-command-palette";
import { DatasetShortcutSheet } from "./dataset-shortcut-sheet";
import {
  DatasetTracesTable,
  useDatasetTracesTable,
  visibilityFromDisplayProperties,
  displayPropertiesFromVisibility,
  rowSelectionFromIds,
  idsFromRowSelection,
  densityToRowHeight,
} from "./dataset-traces-table";
import {
  DataTableSortList,
  type DatasetTracesRowHeight,
} from "./data-table";
import type {
  OnChangeFn,
  RowSelectionState,
  SortingState,
  Table as TanStackTable,
  VisibilityState,
} from "@tanstack/react-table";
import type {
  AddTraceToDatasetHandler,
  DatasetMembershipsResolver,
} from "../stream-timeline/types";
import type {
  CreateSavedViewHandler,
  Dataset,
  DatasetCluster,
  DatasetEvalRun,
  DatasetSavedView,
  DatasetSnapshot,
  DatasetSplit,
  DeleteSavedViewHandler,
  RemoveTraceFromDatasetHandler,
  TraceSummary,
  UpdateDatasetHandler,
  UpdateSavedViewHandler,
  UpdateTracesHandler,
} from "./types";

/*
 * DatasetDetailPage — unified dataset canvas.
 *
 * Phase-1 of the Linear-like reorganization (`dataset-ux-proposal`
 * canvas). The five tabs (Overview / Traces / Clusters / Graph /
 * Timeline) collapse into one mounted surface with a lens picker:
 *
 *   List · Cluster · Graph · Timeline · Coverage
 *
 * Every lens reads from the same filtered trace list, the same
 * selection, and the same group-by / density. Switching lenses
 * swaps only the inner renderer — toolbar, filter rail, selection,
 * and inspector all carry across without remount, mirroring the
 * `StreamTimelineViewer`'s built-in detail panel pattern.
 *
 * The page is presentational w.r.t. dataset mutations — every CRUD
 * action goes through the supplied handlers. State is uncontrolled
 * by default but every dimension (lens, filters, group-by, density)
 * exposes a controlled prop pair so consumers can mirror state into
 * the URL (Next.js `useSearchParams`, etc.).
 */

/* ── Types ────────────────────────────────────────────────── */

export type DatasetDetailLens = "list" | "graph" | "timeline" | "coverage";

export const DATASET_DETAIL_LENSES: readonly DatasetDetailLens[] = [
  "list",
  "graph",
  "timeline",
  "coverage",
];

/** Backward-compat alias — the old API named these "tabs". */
export type DatasetDetailTab = DatasetDetailLens;
export const DATASET_DETAIL_TABS = DATASET_DETAIL_LENSES;

export type DatasetGroupBy = "cluster" | "split" | "source" | "none";
export type DatasetDensity = "dense" | "comfy";

/**
 * Sort axis for the List lens. Mirrors Linear's "Ordering" dropdown
 * in the Display popover. Each value is rendered as an option in the
 * popover and applied at the canvas level so the same order flows
 * through grouping, keyboard nav, and shift-range selection.
 */
export type DatasetOrdering =
  | "addedAtDesc"
  | "addedAtAsc"
  | "startedAtDesc"
  | "startedAtAsc"
  | "durationDesc"
  | "eventCountDesc"
  | "labelAsc";

/**
 * Trace columns the user can show or hide via the Display popover's
 * "Display properties" section. Status + the trace-label cell are
 * always shown — they're how a builder identifies a row. The rest
 * are toggleable.
 */
export type DatasetDisplayProperty =
  | "cluster"
  | "events"
  | "duration"
  | "split"
  | "traceId";

export const DATASET_DISPLAY_PROPERTIES: readonly DatasetDisplayProperty[] = [
  "cluster",
  "events",
  "duration",
  "split",
  "traceId",
];

const DEFAULT_DISPLAY_PROPERTIES: readonly DatasetDisplayProperty[] = [
  "cluster",
  "events",
  "duration",
  "split",
];

const LENS_META: Record<
  DatasetDetailLens,
  {
    label: string;
    kbd: string;
    Icon: React.ComponentType<{
      className?: string;
      strokeWidth?: number;
      "aria-hidden"?: true;
    }>;
  }
> = {
  list: { label: "List", kbd: "⌥1", Icon: ListIcon },
  graph: { label: "Graph", kbd: "⌥2", Icon: Network },
  timeline: { label: "Timeline", kbd: "⌥3", Icon: Timer },
  coverage: { label: "Coverage", kbd: "⌥4", Icon: PieChart },
};

export interface DatasetDetailPageProps {
  snapshot: DatasetSnapshot;

  /* ── Parent chrome ─────────────────────────────────────── */
  /** @deprecated — Breadcrumb removed from the detail header. */
  workspaceLabel?: string;
  /** @deprecated — Breadcrumb removed from the detail header. */
  sectionLabel?: string;
  /** Return to the parent collection. */
  onBack?: () => void;

  /* ── Lens (replaces the old `tab` prop) ─────────────────── */
  lens?: DatasetDetailLens;
  defaultLens?: DatasetDetailLens;
  onLensChange?: (lens: DatasetDetailLens) => void;
  /** @deprecated — use `lens`. Forwarded for migration. */
  tab?: DatasetDetailLens;
  /** @deprecated — use `defaultLens`. Forwarded for migration. */
  defaultTab?: DatasetDetailLens;
  /** @deprecated — use `onLensChange`. Forwarded for migration. */
  onTabChange?: (lens: DatasetDetailLens) => void;

  /* ── Display controls ───────────────────────────────────── */
  /** Group-by axis for the List lens. Defaults to `cluster` so the
   *  list mirrors the cluster structure (same role the standalone
   *  Cluster lens used to play, just inside one canvas). */
  groupBy?: DatasetGroupBy;
  defaultGroupBy?: DatasetGroupBy;
  onGroupByChange?: (next: DatasetGroupBy) => void;

  /** Sort axis for the List lens. */
  ordering?: DatasetOrdering;
  defaultOrdering?: DatasetOrdering;
  onOrderingChange?: (next: DatasetOrdering) => void;

  /** When true, empty groups appear in the List lens (matches
   *  Linear's "Show empty groups" toggle). Defaults to false so
   *  filtered views stay tight. */
  showEmptyGroups?: boolean;
  defaultShowEmptyGroups?: boolean;
  onShowEmptyGroupsChange?: (next: boolean) => void;

  /** Visible row columns in the List lens. Status + label are
   *  always shown; the rest are togglable through the Display
   *  popover's "Display properties" chip wrap. */
  displayProperties?: readonly DatasetDisplayProperty[];
  defaultDisplayProperties?: readonly DatasetDisplayProperty[];
  onDisplayPropertiesChange?: (next: readonly DatasetDisplayProperty[]) => void;

  /** Row density. Defaults to `dense`. */
  density?: DatasetDensity;
  defaultDensity?: DatasetDensity;
  onDensityChange?: (next: DatasetDensity) => void;

  /* ── Filter rail ────────────────────────────────────────── */
  /** Override the default filter columns. */
  filterColumns?: ColumnConfig<TraceSummary>[];
  /** Controlled filter state. Pair with `onFiltersChange`. */
  filters?: FilterState[];
  onFiltersChange?: (next: FilterState[]) => void;

  /* ── Selection ──────────────────────────────────────────── */
  selectedTraceId?: string | null;
  onSelectTrace?: (traceId: string | null) => void;

  /* ── Multi-select ───────────────────────────────────────── */
  /** Controlled multi-select. Pair with `onSelectedTraceIdsChange`. */
  selectedTraceIds?: readonly string[];
  defaultSelectedTraceIds?: readonly string[];
  onSelectedTraceIdsChange?: (next: readonly string[]) => void;

  /* ── CRUD passthrough ──────────────────────────────────── */
  onUpdateDataset?: UpdateDatasetHandler;
  onEditDataset?: (id: string) => void;
  onDeleteDataset?: (id: string) => void;
  onDuplicateDataset?: (id: string) => void;

  /* ── Bulk + inline trace mutations ─────────────────────── */
  /** Inline + bulk trace mutation. Drives the row chip pickers AND
   *  the batch-actions strip. When omitted, chips render as
   *  read-only labels. */
  onUpdateTraces?: UpdateTracesHandler;
  /** Bulk remove. When omitted, the batch strip's Remove button is
   *  hidden. Single-trace remove still flows through the inspector
   *  drawer. */
  onRemoveTraces?: RemoveTraceFromDatasetHandler;

  /* ── Saved views ────────────────────────────────────────── */
  /** Persisted views to render as compact Linear-style view chips. */
  savedViews?: readonly DatasetSavedView[];
  /** Currently-applied view id (controlled). */
  activeViewId?: string | null;
  defaultActiveViewId?: string | null;
  onActiveViewChange?: (next: string | null) => void;
  /** Save current canvas state as a new view. */
  onCreateSavedView?: CreateSavedViewHandler;
  /** Update an existing saved view. */
  onUpdateSavedView?: UpdateSavedViewHandler;
  /** Delete a saved view. */
  onDeleteSavedView?: DeleteSavedViewHandler;

  /* ── Eval runs ──────────────────────────────────────────── */
  /** Recent eval runs scoped to this dataset, surfaced as compact chips. */
  evalRuns?: readonly DatasetEvalRun[];
  activeEvalRunId?: string | null;
  defaultActiveEvalRunId?: string | null;
  onActiveEvalRunChange?: (next: string | null) => void;

  /* ── Add to dataset ────────────────────────────────────── */
  datasetsForAdd?: readonly Dataset[];
  onAddTraceToDataset?: AddTraceToDatasetHandler;
  getDatasetMembershipsForTrace?: DatasetMembershipsResolver;

  /* ── Render slot overrides ─────────────────────────────── */
  renderGraph?: (snapshot: DatasetSnapshot) => React.ReactNode;
  renderTimeline?: (snapshot: DatasetSnapshot) => React.ReactNode;

  className?: string;
}

/* ── Component ───────────────────────────────────────────── */

export function DatasetDetailPage({
  snapshot,
  workspaceLabel: _workspaceLabel,
  sectionLabel: _sectionLabel,
  onBack,
  lens: lensProp,
  defaultLens,
  onLensChange,
  tab,
  defaultTab,
  onTabChange,
  groupBy: groupByProp,
  defaultGroupBy = "cluster",
  onGroupByChange,
  ordering: orderingProp,
  defaultOrdering = "addedAtDesc",
  onOrderingChange,
  showEmptyGroups: showEmptyGroupsProp,
  defaultShowEmptyGroups = false,
  onShowEmptyGroupsChange,
  displayProperties: displayPropertiesProp,
  defaultDisplayProperties = DEFAULT_DISPLAY_PROPERTIES,
  onDisplayPropertiesChange,
  density: densityProp,
  defaultDensity = "comfy",
  onDensityChange,
  filterColumns: filterColumnsProp,
  filters: filtersProp,
  onFiltersChange,
  selectedTraceId,
  onSelectTrace,
  selectedTraceIds: selectedTraceIdsProp,
  defaultSelectedTraceIds,
  onSelectedTraceIdsChange,
  onUpdateDataset,
  onEditDataset,
  onDeleteDataset,
  onDuplicateDataset,
  onUpdateTraces,
  onRemoveTraces,
  savedViews,
  activeViewId: activeViewIdProp,
  defaultActiveViewId,
  onActiveViewChange,
  onCreateSavedView,
  onUpdateSavedView,
  onDeleteSavedView,
  evalRuns,
  activeEvalRunId: activeEvalRunIdProp,
  defaultActiveEvalRunId,
  onActiveEvalRunChange,
  datasetsForAdd,
  onAddTraceToDataset,
  getDatasetMembershipsForTrace,
  renderGraph,
  renderTimeline,
  className,
}: DatasetDetailPageProps) {
  /* ── Lens state (controlled or uncontrolled) ─────────── */
  const [lensState, setLensState] = React.useState<DatasetDetailLens>(
    lensProp ?? tab ?? defaultLens ?? defaultTab ?? "list"
  );
  const lens = lensProp ?? tab ?? lensState;
  const setLens = React.useCallback(
    (next: DatasetDetailLens) => {
      setLensState(next);
      onLensChange?.(next);
      onTabChange?.(next);
    },
    [onLensChange, onTabChange]
  );

  /* ── Group-by + density (controlled or uncontrolled) ── */
  const [groupByState, setGroupByState] =
    React.useState<DatasetGroupBy>(defaultGroupBy);
  const groupBy = groupByProp ?? groupByState;
  const setGroupBy = (next: DatasetGroupBy) => {
    setGroupByState(next);
    onGroupByChange?.(next);
  };

  const [orderingState, setOrderingState] =
    React.useState<DatasetOrdering>(defaultOrdering);
  const ordering = orderingProp ?? orderingState;
  const setOrdering = (next: DatasetOrdering) => {
    setOrderingState(next);
    onOrderingChange?.(next);
  };

  const [showEmptyGroupsState, setShowEmptyGroupsState] =
    React.useState<boolean>(defaultShowEmptyGroups);
  const showEmptyGroups = showEmptyGroupsProp ?? showEmptyGroupsState;
  const setShowEmptyGroups = (next: boolean) => {
    setShowEmptyGroupsState(next);
    onShowEmptyGroupsChange?.(next);
  };

  const [displayPropertiesState, setDisplayPropertiesState] = React.useState<
    readonly DatasetDisplayProperty[]
  >(defaultDisplayProperties);
  const displayProperties = displayPropertiesProp ?? displayPropertiesState;
  const setDisplayProperties = React.useCallback(
    (next: readonly DatasetDisplayProperty[]) => {
      setDisplayPropertiesState(next);
      onDisplayPropertiesChange?.(next);
    },
    [onDisplayPropertiesChange]
  );
  const toggleDisplayProperty = (key: DatasetDisplayProperty) => {
    const set = new Set(displayProperties);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    setDisplayProperties(DATASET_DISPLAY_PROPERTIES.filter((k) => set.has(k)));
  };

  const [densityState, setDensityState] =
    React.useState<DatasetDensity>(defaultDensity);
  const density = densityProp ?? densityState;
  const setDensity = (next: DatasetDensity) => {
    setDensityState(next);
    onDensityChange?.(next);
  };

  /* New 4-step row height (compact / default / comfortable / spacious),
     mounted alongside the legacy 2-step `density` for back-compat. The
     row-height menu writes here directly; `density` initial value is
     translated via `densityToRowHeight` so the canvas starts at the
     right size when it's seeded from the legacy prop. */
  const [rowHeight, setRowHeight] = React.useState<DatasetTracesRowHeight>(() =>
    densityToRowHeight(densityProp ?? defaultDensity)
  );

  /* User preference for the right-side inspector drawer. When `false`
     the drawer never mounts — even with an active selection — so the
     table can use the full width. Selecting a trace doesn't auto-open
     it; the user opts in via the toolbar's panel-toggle pill. */
  const [inspectorOpen, setInspectorOpen] = React.useState(true);

  /* Inspector drawer width (resizable via the splitter on its left
     edge). Kept on the canvas so a drag survives re-renders of the
     drawer. The bounds match the drawer's own min/max defaults. */
  const [inspectorWidth, setInspectorWidth] = React.useState(320);

  /* ── Filter rail wiring ──────────────────────────────── */
  const filterColumns = React.useMemo(
    () => filterColumnsProp ?? defaultDatasetTraceColumns(snapshot),
    [filterColumnsProp, snapshot]
  );
  /* Local filter state — used when the consumer is uncontrolled.
     The filter store reads from the controlled prop when present;
     otherwise from this local state. Splitting state out (instead
     of letting `useDataTableFilters` own it internally) lets the
     "Apply saved view" path replace the entire filter list with
     one call. */
  const [internalFilters, setInternalFilters] = React.useState<FilterState[]>(
    []
  );
  const filtersResolved = filtersProp ?? internalFilters;
  const setFilters = React.useCallback(
    (
      next:
        | readonly FilterState[]
        | ((prev: readonly FilterState[]) => readonly FilterState[])
    ) => {
      const resolved =
        typeof next === "function" ? next(filtersResolved) : next;
      const arr = [...resolved];
      if (filtersProp === undefined) {
        setInternalFilters(arr);
      }
      onFiltersChange?.(arr);
    },
    [filtersResolved, filtersProp, onFiltersChange]
  );
  const filterStore = useDataTableFilters<TraceSummary>({
    columns: filterColumns,
    filters: filtersResolved,
    onFiltersChange: (next) => setFilters(next),
  });

  /* Free-text search is a separate, lighter affordance from the
     filter rail (which is for structured columns). It composes with
     filters via AND. */
  const [search, setSearch] = React.useState("");

  const filteredTraces = React.useMemo<TraceSummary[]>(() => {
    const q = search.trim().toLowerCase();
    let result: readonly TraceSummary[] = snapshot.traces;
    if (filterStore.filters.length > 0) {
      result = result.filter(filterStore.predicate);
    }
    if (q) {
      result = result.filter((trace) => {
        const haystack = `${trace.label} ${trace.traceId} ${trace.primarySource}`;
        return haystack.toLowerCase().includes(q);
      });
    }
    /* Apply ordering. The List lens, group-counter, and shift-range
       selection all walk the same `filteredTraces` array, so sorting
       once here keeps every consumer in lockstep. */
    return sortTraces(result as readonly TraceSummary[], ordering);
  }, [
    snapshot.traces,
    filterStore.filters.length,
    filterStore.predicate,
    search,
    ordering,
  ]);

  /* ── Multi-select state ──────────────────────────────── */

  const [selectedIdsState, setSelectedIdsState] = React.useState<
    readonly string[]
  >(defaultSelectedTraceIds ?? []);
  const selectedIds = selectedTraceIdsProp ?? selectedIdsState;
  /* Latest selectedIds in a ref so callbacks can resolve functional
     updates without firing parent callbacks from inside a React state
     updater. */
  const selectedIdsRef = React.useRef(selectedIds);
  React.useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  const setSelectedIds = React.useCallback(
    (
      next: readonly string[] | ((prev: readonly string[]) => readonly string[])
    ) => {
      const resolved =
        typeof next === "function" ? next(selectedIdsRef.current) : next;
      selectedIdsRef.current = resolved;
      setSelectedIdsState(resolved);
      onSelectedTraceIdsChange?.(resolved);
    },
    [onSelectedTraceIdsChange]
  );

  const selectedIdSet = React.useMemo(
    () => new Set(selectedIds),
    [selectedIds]
  );

  const selectedTrace = React.useMemo(
    () =>
      selectedTraceId
        ? (snapshot.traces.find((trace) => trace.traceId === selectedTraceId) ??
          null)
        : null,
    [selectedTraceId, snapshot.traces]
  );

  /* Anchor for shift-range selection. Defaults to the most-recently
     toggled trace; falls back to the inspector selection. */
  const anchorRef = React.useRef<string | null>(selectedTraceId ?? null);

  /* ── TanStack table state ─────────────────────────────────
     The list lens is now driven by `useDatasetTracesTable` (a thin
     wrapper around TanStack's `useReactTable`). We keep the canvas's
     existing canonical state (`selectedIds`, `displayProperties`,
     `ordering`) and translate to TanStack's state shapes
     (`RowSelectionState`, `VisibilityState`, `SortingState`) at the
     boundary. Updates flow back through the existing setters so saved
     views, multi-select fan-out, and the bulk strip don't have to
     re-learn anything. */
  const [sortingState, setSortingState] = React.useState<SortingState>(() =>
    orderingToSortingState(orderingProp ?? defaultOrdering)
  );

  const columnVisibility = React.useMemo<VisibilityState>(
    () => visibilityFromDisplayProperties(displayProperties),
    [displayProperties]
  );
  const handleColumnVisibilityChange = React.useCallback<
    OnChangeFn<VisibilityState>
  >(
    (updater) => {
      const current = visibilityFromDisplayProperties(displayProperties);
      const next = typeof updater === "function" ? updater(current) : updater;
      setDisplayProperties(displayPropertiesFromVisibility(next));
    },
    [displayProperties, setDisplayProperties]
  );

  const rowSelection = React.useMemo<RowSelectionState>(
    () => rowSelectionFromIds(selectedIds),
    [selectedIds]
  );
  const handleRowSelectionChange = React.useCallback<
    OnChangeFn<RowSelectionState>
  >(
    (updater) => {
      const current = rowSelectionFromIds(selectedIdsRef.current);
      const next = typeof updater === "function" ? updater(current) : updater;
      setSelectedIds(idsFromRowSelection(next));
    },
    [setSelectedIds]
  );

  /* Drop selection state for any traces no longer in the dataset
     (e.g. after a remove) so the batch strip never references stale
     ids. */
  React.useEffect(() => {
    if (selectedIds.length === 0) return;
    const present = new Set(snapshot.traces.map((t) => t.traceId));
    const next = selectedIds.filter((id) => present.has(id));
    if (next.length !== selectedIds.length) {
      setSelectedIds(next);
    }
  }, [snapshot.traces, selectedIds, setSelectedIds]);

  const clearSelection = React.useCallback(() => {
    setSelectedIds([]);
    anchorRef.current = null;
  }, [setSelectedIds]);

  /* Aggregate values across the multi-selection — drives the batch
     strip's chip state ("mixed" when traces disagree). */
  const selectionAggregate = React.useMemo(() => {
    if (selectedIds.length === 0) return null;
    const traces = snapshot.traces.filter((t) => selectedIdSet.has(t.traceId));
    if (traces.length === 0) return null;
    const agg = (extractor: (t: TraceSummary) => string | null | undefined) => {
      const vals = new Set<string | null>();
      for (const t of traces) {
        vals.add(extractor(t) ?? null);
        if (vals.size > 1) break;
      }
      return vals.size > 1 ? "mixed" : (Array.from(vals)[0] ?? null);
    };
    return {
      count: traces.length,
      cluster: agg((t) => t.clusterId) as string | null | "mixed",
      split: agg((t) => t.split) as DatasetSplit | null | "mixed",
    };
  }, [selectedIds, selectedIdSet, snapshot.traces]);

  /* ── Inline + bulk update wiring ─────────────────────── */

  /* Smart-target: if the row being mutated is part of the current
     multi-select AND the selection has more than one row, the
     mutation applies to the entire selection. Otherwise it applies
     to that single trace. Mirrors Linear / Notion / Figma behavior. */
  const resolveMutationTargets = React.useCallback(
    (traceId: string): readonly string[] => {
      if (selectedIdSet.has(traceId) && selectedIds.length > 1) {
        return selectedIds;
      }
      return [traceId];
    },
    [selectedIds, selectedIdSet]
  );

  const updateClusterFor = React.useCallback(
    (traceId: string, next: string | null) => {
      onUpdateTraces?.({
        datasetId: snapshot.dataset.id,
        traceIds: resolveMutationTargets(traceId),
        patch: { clusterId: next },
      });
    },
    [onUpdateTraces, resolveMutationTargets, snapshot.dataset.id]
  );
  const updateSplitFor = React.useCallback(
    (traceId: string, next: DatasetSplit | null) => {
      onUpdateTraces?.({
        datasetId: snapshot.dataset.id,
        traceIds: resolveMutationTargets(traceId),
        patch: { split: next },
      });
    },
    [onUpdateTraces, resolveMutationTargets, snapshot.dataset.id]
  );

  /* ── Multi-select interaction handlers ───────────────── */

  /* TanStack table instance — single source of truth for sort,
     column visibility, and row-selection state-as-derived. The state
     pipes are wired above; here we just assemble the table so the
     list lens, the multi-column SortList, and `visibleRowOrder`
     (used by the canvas keymap + shift-range selection) all read
     from one place. The pre-`sortingState` order of `filteredTraces`
     is the legacy `ordering`-driven sort; user-driven multi-column
     sort overrides on top. */
  const tracesTable = useDatasetTracesTable({
    data: filteredTraces,
    clusters: snapshot.clusters,
    sorting: sortingState,
    onSortingChange: setSortingState,
    columnVisibility,
    onColumnVisibilityChange: handleColumnVisibilityChange,
    rowSelection,
    onRowSelectionChange: handleRowSelectionChange,
  });

  /** Resolve the visible (filtered + sorted) row order — used to
   *  resolve a shift-click range AND drive j/k caret nav through
   *  `useDatasetCanvasKeyboard`. Reads from TanStack's row model so
   *  multi-column header sort flows through the keymap. */
  const tableRows = tracesTable.getRowModel().rows;
  const visibleRowOrder = React.useMemo(
    () => tableRows.map((r) => r.original.traceId),
    [tableRows]
  );

  const handleRowClick = React.useCallback(
    (traceId: string, event: React.MouseEvent | React.KeyboardEvent) => {
      const isShift = event.shiftKey;
      const isMeta = event.metaKey || event.ctrlKey;

      if (isShift && anchorRef.current && anchorRef.current !== traceId) {
        const i = visibleRowOrder.indexOf(anchorRef.current);
        const j = visibleRowOrder.indexOf(traceId);
        if (i !== -1 && j !== -1) {
          const [start, end] = i < j ? [i, j] : [j, i];
          const range = visibleRowOrder.slice(start, end + 1);
          setSelectedIds((prev) => {
            const merged = new Set(prev);
            for (const id of range) merged.add(id);
            return Array.from(merged);
          });
          return;
        }
      }

      if (isMeta) {
        anchorRef.current = traceId;
        setSelectedIds((prev) => {
          const set = new Set(prev);
          if (set.has(traceId)) set.delete(traceId);
          else set.add(traceId);
          return Array.from(set);
        });
        return;
      }

      /* Plain click — clear multi-select, focus inspector. */
      anchorRef.current = traceId;
      setSelectedIds([]);
      onSelectTrace?.(traceId);
    },
    [onSelectTrace, setSelectedIds, visibleRowOrder]
  );

  const handleCheckboxChange = React.useCallback(
    (traceId: string, next: boolean, _event: React.MouseEvent) => {
      anchorRef.current = traceId;
      setSelectedIds((prev) => {
        const set = new Set(prev);
        if (next) set.add(traceId);
        else set.delete(traceId);
        return Array.from(set);
      });
    },
    [setSelectedIds]
  );

  const handleSelectAllVisible = React.useCallback(
    (next: boolean) => {
      if (next) {
        setSelectedIds(visibleRowOrder);
      } else {
        setSelectedIds([]);
        anchorRef.current = null;
      }
    },
    [setSelectedIds, visibleRowOrder]
  );

  const visibleSelectedCount = React.useMemo(
    () =>
      visibleRowOrder.reduce(
        (acc, id) => (selectedIdSet.has(id) ? acc + 1 : acc),
        0
      ),
    [visibleRowOrder, selectedIdSet]
  );

  const selectAllState: "none" | "indeterminate" | "all" =
    visibleRowOrder.length === 0
      ? "none"
      : visibleSelectedCount === 0
        ? "none"
        : visibleSelectedCount === visibleRowOrder.length
          ? "all"
          : "indeterminate";

  /* ── Keyboard layer state ──────────────────────────── */

  /* `focusedTraceId` is the J/K caret. Defaults to the inspector's
     selected trace when one exists; otherwise null until the user
     presses J. */
  const [focusedTraceIdState, setFocusedTraceId] = React.useState<
    string | null
  >(selectedTraceId ?? null);
  const focusedTraceId = focusedTraceIdState;

  /* Drop focus when the trace falls out of the visible window — the
     user filtered or removed it. */
  React.useEffect(() => {
    if (!focusedTraceId) return;
    if (!visibleRowOrder.includes(focusedTraceId)) {
      setFocusedTraceId(null);
    }
  }, [focusedTraceId, visibleRowOrder]);

  /* ScrollIntoView whenever focus moves. Querying by `data-trace-id`
     keeps this hook from caring about row refs across grouping +
     virtualization. `block: "nearest"` avoids the abrupt re-center
     people hate when stepping with J/K. */
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!focusedTraceId) return;
    const root = contentRef.current ?? document;
    const el = root.querySelector<HTMLElement>(
      `[data-trace-id="${cssEscape(focusedTraceId)}"]`
    );
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [focusedTraceId]);

  const searchInputRef = React.useRef<HTMLInputElement | null>(null);

  const moveFocus = React.useCallback(
    (delta: 1 | -1) => {
      if (visibleRowOrder.length === 0) return;
      const currentIndex = focusedTraceId
        ? visibleRowOrder.indexOf(focusedTraceId)
        : -1;
      const nextIndex =
        currentIndex < 0
          ? delta > 0
            ? 0
            : visibleRowOrder.length - 1
          : Math.max(
              0,
              Math.min(visibleRowOrder.length - 1, currentIndex + delta)
            );
      setFocusedTraceId(visibleRowOrder[nextIndex] ?? null);
    },
    [focusedTraceId, visibleRowOrder]
  );

  const cycleLens = React.useCallback(() => {
    const i = DATASET_DETAIL_LENSES.indexOf(lens);
    const next = DATASET_DETAIL_LENSES[(i + 1) % DATASET_DETAIL_LENSES.length];
    if (next) setLens(next);
  }, [lens, setLens]);

  /* ── Sheet + palette ───────────────────────────────── */
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  const dispatchBulkRemove = React.useCallback(async () => {
    if (!onRemoveTraces) return;
    const targetIds =
      selectedIds.length > 0
        ? selectedIds
        : focusedTraceId
          ? [focusedTraceId]
          : [];
    if (targetIds.length === 0) return;
    for (const traceId of targetIds) {
      await onRemoveTraces({
        datasetId: snapshot.dataset.id,
        traceId,
      });
    }
    clearSelection();
    setFocusedTraceId(null);
  }, [
    onRemoveTraces,
    selectedIds,
    focusedTraceId,
    snapshot.dataset.id,
    clearSelection,
  ]);

  const keyboardHandlers = React.useMemo<DatasetCanvasHandlers>(
    () => ({
      "focus.next": () => moveFocus(1),
      "focus.prev": () => moveFocus(-1),
      "focus.open": () => {
        if (focusedTraceId && onSelectTrace) onSelectTrace(focusedTraceId);
      },
      "focus.close": () => {
        if (paletteOpen || sheetOpen) return;
        if (selectedTraceId && onSelectTrace) {
          onSelectTrace(null);
          return;
        }
        if (selectedIds.length > 0) {
          clearSelection();
          return;
        }
        setFocusedTraceId(null);
      },
      "focus.search": () => searchInputRef.current?.focus(),
      "select.toggle": () => {
        if (!focusedTraceId) return;
        setSelectedIds((prev) => {
          const set = new Set(prev);
          if (set.has(focusedTraceId)) set.delete(focusedTraceId);
          else set.add(focusedTraceId);
          return Array.from(set);
        });
        anchorRef.current = focusedTraceId;
      },
      "select.all": () => handleSelectAllVisible(true),
      "select.clear": () => clearSelection(),
      "lens.cycle": cycleLens,
      "lens.list": () => setLens("list"),
      "lens.graph": () => setLens("graph"),
      "lens.timeline": () => setLens("timeline"),
      "lens.coverage": () => setLens("coverage"),
      "edit.remove": () => void dispatchBulkRemove(),
      "palette.open": () => setPaletteOpen(true),
      "sheet.open": () => setSheetOpen(true),
    }),
    [
      moveFocus,
      focusedTraceId,
      onSelectTrace,
      paletteOpen,
      sheetOpen,
      selectedTraceId,
      selectedIds.length,
      clearSelection,
      setSelectedIds,
      handleSelectAllVisible,
      cycleLens,
      setLens,
      dispatchBulkRemove,
    ]
  );

  useDatasetCanvasKeyboard({
    enabled: !paletteOpen && !sheetOpen,
    handlers: keyboardHandlers,
  });

  /* ── Saved views ─────────────────────────────────────── */

  const [activeViewIdState, setActiveViewIdState] = React.useState<
    string | null
  >(defaultActiveViewId ?? null);
  const activeViewId = activeViewIdProp ?? activeViewIdState;
  const setActiveViewId = React.useCallback(
    (next: string | null) => {
      setActiveViewIdState(next);
      onActiveViewChange?.(next);
    },
    [onActiveViewChange]
  );

  const activeView = React.useMemo(() => {
    if (!activeViewId) return null;
    return savedViews?.find((v) => v.id === activeViewId) ?? null;
  }, [savedViews, activeViewId]);

  const captureCurrentViewState = React.useCallback(
    (): DatasetSavedView["state"] => ({
      lens,
      groupBy,
      ordering,
      sorting: sortingState.map((s) => ({ id: s.id, desc: s.desc })),
      density,
      showEmptyGroups,
      displayProperties: [...displayProperties],
      search: search.length > 0 ? search : undefined,
      filters: filtersResolved.map((f) => ({
        id: f.id,
        columnId: f.columnId,
        operator: f.operator,
        value: f.value,
      })),
    }),
    [
      lens,
      groupBy,
      ordering,
      sortingState,
      density,
      showEmptyGroups,
      displayProperties,
      search,
      filtersResolved,
    ]
  );

  /* Compare current state to the active view's captured state.
     Cheap-deep-equal on the JSON form keeps things simple — saved
     views are small (under ~10 chips) so the cost is negligible. */
  const isViewDirty = React.useMemo(() => {
    if (!activeView) return false;
    const current = captureCurrentViewState();
    return JSON.stringify(current) !== JSON.stringify(activeView.state);
  }, [activeView, captureCurrentViewState]);

  const applyView = React.useCallback(
    (view: DatasetSavedView) => {
      const s = view.state;
      if (s.lens) setLens(s.lens as DatasetDetailLens);
      if (s.groupBy) setGroupBy(s.groupBy as DatasetGroupBy);
      if (s.ordering) setOrdering(s.ordering as DatasetOrdering);
      if (s.density) setDensity(s.density as DatasetDensity);
      if (typeof s.showEmptyGroups === "boolean") {
        setShowEmptyGroups(s.showEmptyGroups);
      }
      if (s.displayProperties) {
        setDisplayProperties(s.displayProperties as DatasetDisplayProperty[]);
      }
      /* Sort state — prefer the new multi-column shape; fall back to
         deriving a single-column sort from the legacy `ordering`
         string so views captured before the tablecn migration still
         apply their intent. Empty `sorting` reverts to the
         pre-sort baked into `filteredTraces` (which respects the
         legacy `ordering`). */
      if (s.sorting && s.sorting.length > 0) {
        setSortingState(
          s.sorting.map((item) => ({ id: item.id, desc: item.desc }))
        );
      } else if (s.ordering) {
        setSortingState(orderingToSortingState(s.ordering as DatasetOrdering));
      } else {
        setSortingState([]);
      }
      setSearch(s.search ?? "");
      const nextFilters: FilterState[] = (s.filters ?? []).map((f, idx) => ({
        id: f.id ?? `view_${view.id}_${idx}`,
        columnId: f.columnId,
        operator: f.operator as FilterState["operator"],
        value: f.value,
      }));
      setFilters(nextFilters);
      setActiveViewId(view.id);
      clearSelection();
    },
    [
      setLens,
      setGroupBy,
      setOrdering,
      setDensity,
      setShowEmptyGroups,
      setDisplayProperties,
      setSearch,
      setFilters,
      setActiveViewId,
      clearSelection,
    ]
  );

  const saveCurrentView = React.useCallback(async () => {
    if (!onCreateSavedView) return null;
    const name = activeView
      ? `${activeView.name} copy`
      : `View ${(savedViews?.length ?? 0) + 1}`;
    const created = await onCreateSavedView({
      datasetId: snapshot.dataset.id,
      name,
      scope: "personal",
      state: captureCurrentViewState(),
    });
    setActiveViewId(created.id);
    return created.id;
  }, [
    onCreateSavedView,
    activeView,
    savedViews,
    snapshot.dataset.id,
    captureCurrentViewState,
    setActiveViewId,
  ]);

  const deleteView = React.useCallback(
    async (viewId: string) => {
      if (!onDeleteSavedView) return;
      await onDeleteSavedView({ datasetId: snapshot.dataset.id, viewId });
      if (activeViewId === viewId) setActiveViewId(null);
    },
    [onDeleteSavedView, snapshot.dataset.id, activeViewId, setActiveViewId]
  );

  const updateView = React.useCallback(
    async (viewId: string, patch: Partial<Omit<DatasetSavedView, "id">>) => {
      if (!onUpdateSavedView) return null;
      const updated = await onUpdateSavedView({
        datasetId: snapshot.dataset.id,
        viewId,
        patch,
      });
      return updated;
    },
    [onUpdateSavedView, snapshot.dataset.id]
  );

  /* ── Eval runs ───────────────────────────────────────── */

  const [activeEvalRunIdState, setActiveEvalRunIdState] = React.useState<
    string | null
  >(defaultActiveEvalRunId ?? null);
  const activeEvalRunId = activeEvalRunIdProp ?? activeEvalRunIdState;
  const setActiveEvalRunId = React.useCallback(
    (next: string | null) => {
      setActiveEvalRunIdState(next);
      onActiveEvalRunChange?.(next);
    },
    [onActiveEvalRunChange]
  );
  const activeEvalRun = React.useMemo(
    () => evalRuns?.find((r) => r.id === activeEvalRunId) ?? null,
    [evalRuns, activeEvalRunId]
  );
  const failingTraceIdSet = React.useMemo<ReadonlySet<string>>(() => {
    if (!activeEvalRun) return new Set();
    return new Set(activeEvalRun.failedTraceIds);
  }, [activeEvalRun]);

  /* If the view applied above doesn't include filters, the canvas's
     internal `internalFilters` can drift from `filtersProp`. Keep
     them in sync when the consumer-controlled prop changes. */
  React.useEffect(() => {
    if (filtersProp !== undefined) return;
    /* No-op — when uncontrolled, internal state owns the value. */
  }, [filtersProp]);

  /* ── Filter helpers used by the Coverage lens ─────── */
  const applyCoverageBucket = React.useCallback(
    (bucket: CoverageBucketSelection) => {
      const columnId =
        bucket.kind === "source"
          ? "source"
          : bucket.kind === "cluster"
            ? "cluster"
            : "split";
      const value =
        bucket.kind === "split" && bucket.value === "unassigned"
          ? null
          : bucket.kind === "cluster" && bucket.value === "__unclustered__"
            ? null
            : bucket.value;
      filterStore.actions.addConfiguredFilter({
        columnId,
        operator: "isAnyOf",
        value: [value],
      });
      setLens("list");
    },
    [filterStore.actions, setLens]
  );

  /* ── Header ─────────────────────────────────────────── */

  return (
    <div
      className={cx(
        "flex h-full min-h-0 flex-1 flex-col overflow-hidden",
        className
      )}
    >
      <DetailHeader
        dataset={snapshot.dataset}
        onBack={onBack}
        onUpdate={onUpdateDataset}
        onEdit={onEditDataset}
        onDelete={onDeleteDataset}
        onDuplicate={onDuplicateDataset}
      />

      <div className="flex flex-1 min-h-0 flex-row">
        <div className="flex min-w-0 flex-1 flex-col">
          <DatasetCanvasToolbar
            tracesTable={tracesTable}
            lens={lens}
            onLensChange={setLens}
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            showEmptyGroups={showEmptyGroups}
            onShowEmptyGroupsChange={setShowEmptyGroups}
            displayProperties={displayProperties}
            onToggleDisplayProperty={toggleDisplayProperty}
            onResetDisplay={() => {
              setGroupBy(defaultGroupBy);
              setOrdering(defaultOrdering);
              setSortingState(orderingToSortingState(defaultOrdering));
              setShowEmptyGroups(defaultShowEmptyGroups);
              setDisplayProperties(defaultDisplayProperties);
              setDensity(defaultDensity);
              setRowHeight(densityToRowHeight(defaultDensity));
            }}
            density={density}
            onDensityChange={setDensity}
            rowHeight={rowHeight}
            onRowHeightChange={setRowHeight}
            inspectorOpen={inspectorOpen}
            onInspectorOpenChange={setInspectorOpen}
            filterColumns={filterColumns}
            filterState={filterStore.filters}
            filterActions={filterStore.actions}
            totalCount={snapshot.traces.length}
            filteredCount={filteredTraces.length}
            savedViews={savedViews ?? []}
            activeViewId={activeViewId}
            currentViewState={captureCurrentViewState()}
            isViewDirty={isViewDirty}
            onApplyView={applyView}
            onSaveCurrentView={onCreateSavedView ? saveCurrentView : undefined}
            onUpdateView={onUpdateSavedView ? updateView : undefined}
            onDeleteView={onDeleteSavedView ? deleteView : undefined}
            evalRuns={evalRuns}
            activeEvalRunId={activeEvalRunId}
            onSelectEvalRun={setActiveEvalRunId}
            selectionCount={selectedIds.length}
            selectionAggregate={selectionAggregate}
            clusters={snapshot.clusters}
            canEdit={!!onUpdateTraces}
            canRemove={!!onRemoveTraces}
            onClearSelection={clearSelection}
            onBulkUpdateCluster={(next) => {
              if (!onUpdateTraces || selectedIds.length === 0) return;
              onUpdateTraces({
                datasetId: snapshot.dataset.id,
                traceIds: selectedIds,
                patch: { clusterId: next },
              });
            }}
            onBulkUpdateSplit={(next) => {
              if (!onUpdateTraces || selectedIds.length === 0) return;
              onUpdateTraces({
                datasetId: snapshot.dataset.id,
                traceIds: selectedIds,
                patch: { split: next },
              });
            }}
            onBulkRemove={async () => {
              if (!onRemoveTraces || selectedIds.length === 0) return;
              for (const traceId of selectedIds) {
                await onRemoveTraces({
                  datasetId: snapshot.dataset.id,
                  traceId,
                });
              }
              clearSelection();
            }}
          />

          <div ref={contentRef} className="flex flex-1 min-h-0">
            <div className="relative flex min-w-0 flex-1 flex-col">
              {snapshot.traces.length === 0 ? (
                <div className="flex flex-1 min-h-0 items-center justify-center p-4">
                  <DatasetEmpty variant="detail" />
                </div>
              ) : (
                <DatasetCanvasContent
                  snapshot={snapshot}
                  lens={lens}
                  tracesTable={tracesTable}
                  groupBy={groupBy}
                  rowHeight={rowHeight}
                  showEmptyGroups={showEmptyGroups}
                  filteredTraces={filteredTraces}
                  selectedTraceId={selectedTraceId ?? null}
                  onSelectTrace={onSelectTrace}
                  focusedTraceId={focusedTraceId}
                  failingTraceIdSet={failingTraceIdSet}
                  onRowClick={handleRowClick}
                  onCheckboxChange={handleCheckboxChange}
                  selectAllState={selectAllState}
                  onSelectAllVisible={handleSelectAllVisible}
                  canEdit={!!onUpdateTraces}
                  onUpdateCluster={updateClusterFor}
                  onUpdateSplit={updateSplitFor}
                  hasActiveFilters={filterStore.filters.length > 0}
                  onClearFilters={() => filterStore.actions.clearAll()}
                  datasetsForAdd={datasetsForAdd}
                  onAddTraceToDataset={onAddTraceToDataset}
                  getDatasetMembershipsForTrace={getDatasetMembershipsForTrace}
                  renderGraph={renderGraph}
                  renderTimeline={renderTimeline}
                  onCoverageBucketSelect={applyCoverageBucket}
                />
              )}

              {/* Floating bulk-actions bar — replaces the inline batch strip
              that used to live in the canvas toolbar. Always mounted so
              the slide-up + fade-in animation runs symmetrically on
              close. The container above is `position: relative` so this
              anchors to the canvas content area, not the viewport — keeps
              the bar away from the inspector drawer when it opens. */}
              <BulkActionsFloatingBar
                selectionCount={selectedIds.length}
                selectionAggregate={selectionAggregate}
                clusters={snapshot.clusters}
                canEdit={!!onUpdateTraces}
                canRemove={!!onRemoveTraces}
                onClearSelection={clearSelection}
                onBulkUpdateCluster={(next) => {
                  if (!onUpdateTraces || selectedIds.length === 0) return;
                  onUpdateTraces({
                    datasetId: snapshot.dataset.id,
                    traceIds: selectedIds,
                    patch: { clusterId: next },
                  });
                }}
                onBulkUpdateSplit={(next) => {
                  if (!onUpdateTraces || selectedIds.length === 0) return;
                  onUpdateTraces({
                    datasetId: snapshot.dataset.id,
                    traceIds: selectedIds,
                    patch: { split: next },
                  });
                }}
                onBulkRemove={async () => {
                  if (!onRemoveTraces || selectedIds.length === 0) return;
                  for (const traceId of selectedIds) {
                    await onRemoveTraces({
                      datasetId: snapshot.dataset.id,
                      traceId,
                    });
                  }
                  clearSelection();
                }}
              />
            </div>

            {inspectorOpen && selectedTraceId && selectedIds.length !== 2 ? (
              <DatasetTraceDetailDrawer
                isOpen={selectedTrace != null}
                onClose={() => onSelectTrace?.(null)}
                snapshot={snapshot}
                trace={selectedTrace}
                onRemoveTrace={onRemoveTraces}
                onJumpToTimeline={(traceId) => {
                  setLens("timeline");
                  onSelectTrace?.(traceId);
                }}
                width={inspectorWidth}
                onWidthChange={setInspectorWidth}
                className="hidden xl:block"
              />
            ) : null}
          </div>
        </div>
      </div>

      <DatasetShortcutSheet open={sheetOpen} onOpenChange={setSheetOpen} />
      <DatasetCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onShortcut={(id) => {
          const handler = (
            keyboardHandlers as Record<string, undefined | (() => void)>
          )[id];
          if (handler) handler();
        }}
      />
    </div>
  );
}

/* CSS.escape with a tiny fallback so the trace-id selector survives
 * older runtimes (test envs, jsdom) that don't ship `CSS.escape`. */
function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

/** Translate the legacy single-axis `DatasetOrdering` to a TanStack
 *  `SortingState`. Used to seed the table's initial sort from the
 *  `defaultOrdering` prop and to upgrade old saved views (which only
 *  carry `state.ordering`) to the new sort state. Returns `[]` for
 *  the date-based orderings since the table doesn't currently expose
 *  `addedAt` / `startedAt` as user-toggleable columns — those keep
 *  flowing through `sortTraces` as the pre-sort beneath any
 *  user-driven multi-column sort. */
function orderingToSortingState(ordering: DatasetOrdering): SortingState {
  switch (ordering) {
    case "durationDesc":
      return [{ id: "duration", desc: true }];
    case "eventCountDesc":
      return [{ id: "events", desc: true }];
    case "labelAsc":
      return [{ id: "trace", desc: false }];
    case "addedAtAsc":
    case "addedAtDesc":
    case "startedAtAsc":
    case "startedAtDesc":
    default:
      return [];
  }
}

/** Returns a new array sorted by the given ordering. Falls back to
 *  the input order on tie so groups stay stable. */
function sortTraces(
  traces: readonly TraceSummary[],
  ordering: DatasetOrdering
): TraceSummary[] {
  const sorted = [...traces];
  const ts = (iso: string | undefined) => (iso ? new Date(iso).getTime() : 0);
  switch (ordering) {
    case "addedAtAsc":
      sorted.sort((a, b) => ts(a.addedAt) - ts(b.addedAt));
      break;
    case "addedAtDesc":
      sorted.sort((a, b) => ts(b.addedAt) - ts(a.addedAt));
      break;
    case "startedAtAsc":
      sorted.sort((a, b) => ts(a.startedAt) - ts(b.startedAt));
      break;
    case "startedAtDesc":
      sorted.sort((a, b) => ts(b.startedAt) - ts(a.startedAt));
      break;
    case "durationDesc":
      sorted.sort((a, b) => b.durationMs - a.durationMs);
      break;
    case "eventCountDesc":
      sorted.sort((a, b) => b.eventCount - a.eventCount);
      break;
    case "labelAsc":
      sorted.sort((a, b) => a.label.localeCompare(b.label));
      break;
  }
  return sorted;
}

/* ── Detail header (dataset name + actions) ───────────────── */

interface DetailHeaderProps {
  dataset: Dataset;
  onBack?: () => void;
  onUpdate?: UpdateDatasetHandler;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

function DetailHeader({
  dataset,
  onBack: _onBack,
  onUpdate,
  onEdit,
  onDelete,
  onDuplicate,
}: DetailHeaderProps) {
  const meta = dataset.purpose ? DATASET_PURPOSE_META[dataset.purpose] : null;
  const PurposeIcon = meta?.Icon;

  const [editing, setEditing] = React.useState(false);
  const [draftName, setDraftName] = React.useState(dataset.name);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setDraftName(dataset.name);
  }, [dataset.name]);

  React.useEffect(() => {
    if (editing) {
      const id = window.setTimeout(() => inputRef.current?.select(), 30);
      return () => window.clearTimeout(id);
    }
  }, [editing]);

  const commit = async () => {
    const trimmed = draftName.trim();
    if (trimmed.length === 0 || trimmed === dataset.name) {
      setDraftName(dataset.name);
      setEditing(false);
      return;
    }
    if (onUpdate) {
      try {
        await onUpdate({ id: dataset.id, patch: { name: trimmed } });
      } catch {
        setDraftName(dataset.name);
      }
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraftName(dataset.name);
    setEditing(false);
  };

  return (
    <header className="flex flex-shrink-0 items-center gap-3 border-b border-l-border-faint bg-black px-4 py-3">
      <span
        className={cx(
          "flex size-7 shrink-0 items-center justify-center rounded-md",
          meta?.tile ?? "bg-l-wash-2"
        )}
        aria-hidden
      >
        {PurposeIcon ? (
          <PurposeIcon
            className={cx("size-4.5", meta?.ink)}
            strokeWidth={1.6}
          />
        ) : null}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <Input
              ref={inputRef}
              value={draftName}
              onChange={(e) => setDraftName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void commit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancel();
                }
              }}
              className="max-w-[420px]"
              aria-label="Dataset name"
            />
            <Button
              variant="icon"
              size="sm"
              aria-label="Save name"
              onPress={() => void commit()}
            >
              <Check className="size-3.5" strokeWidth={1.75} />
            </Button>
            <Button
              variant="icon"
              size="sm"
              aria-label="Cancel rename"
              onPress={cancel}
            >
              <X className="size-3.5" strokeWidth={1.75} />
            </Button>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => onUpdate && setEditing(true)}
              className={cx(
                "group inline-flex min-w-0 items-center gap-1.5 rounded-[3px] text-left",
                "font-sans text-[17px] font-medium leading-tight text-l-ink",
                onUpdate
                  ? "hover:bg-l-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40"
                  : "cursor-text"
              )}
              disabled={!onUpdate}
            >
              <span className="truncate px-1">{dataset.name}</span>
              {onUpdate ? (
                <Pencil
                  className="size-3 shrink-0 text-l-ink-dim opacity-0 transition-opacity duration-fast group-hover:opacity-100"
                  strokeWidth={1.75}
                />
              ) : null}
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <DatasetActionsMenu
          dataset={dataset}
          onEdit={onEdit}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
        />
      </div>
    </header>
  );
}

/* ── Toolbar — lens picker + filter rail + display ───────── */

interface SelectionAggregate {
  count: number;
  cluster: string | null | "mixed";
  split: DatasetSplit | null | "mixed";
}

interface DatasetCanvasToolbarProps {
  /** TanStack table instance — drives the multi-column SortList in
   *  the DisplayPopover. */
  tracesTable: TanStackTable<TraceSummary>;
  lens: DatasetDetailLens;
  onLensChange: (next: DatasetDetailLens) => void;
  groupBy: DatasetGroupBy;
  onGroupByChange: (next: DatasetGroupBy) => void;
  showEmptyGroups: boolean;
  onShowEmptyGroupsChange: (next: boolean) => void;
  displayProperties: readonly DatasetDisplayProperty[];
  onToggleDisplayProperty: (key: DatasetDisplayProperty) => void;
  onResetDisplay: () => void;
  /** Row height (4-step). Surfaced as a "Row height" picker row inside
   *  the Display popover. */
  rowHeight: DatasetTracesRowHeight;
  onRowHeightChange: (next: DatasetTracesRowHeight) => void;
  density: DatasetDensity;
  onDensityChange: (next: DatasetDensity) => void;
  /** Whether the right-side trace inspector drawer should be allowed
   *  to open when a trace is selected. Toolbar exposes a panel-toggle
   *  pill next to the row-height control so users can hide the
   *  inspector when they want the table to use the full width. */
  inspectorOpen: boolean;
  onInspectorOpenChange: (next: boolean) => void;
  filterColumns: ColumnConfig<TraceSummary>[];
  filterState: readonly FilterState[];
  filterActions: ReturnType<
    typeof useDataTableFilters<TraceSummary>
  >["actions"];
  totalCount: number;
  filteredCount: number;
  savedViews: readonly DatasetSavedView[];
  activeViewId: string | null;
  currentViewState: DatasetSavedView["state"];
  isViewDirty: boolean;
  onApplyView: (view: DatasetSavedView) => void;
  onSaveCurrentView?: () => Promise<string | null> | string | null;
  onUpdateView?: (
    viewId: string,
    patch: Partial<Omit<DatasetSavedView, "id">>
  ) => Promise<DatasetSavedView | null> | DatasetSavedView | null;
  onDeleteView?: (viewId: string) => void | Promise<void>;
  evalRuns?: readonly DatasetEvalRun[];
  activeEvalRunId?: string | null;
  onSelectEvalRun?: (runId: string | null) => void;
  /* Multi-select integration. When `selectionCount` > 0 the
     trailing slot morphs into the batch-actions strip. */
  selectionCount: number;
  selectionAggregate: SelectionAggregate | null;
  clusters: readonly DatasetCluster[];
  canEdit: boolean;
  canRemove: boolean;
  onClearSelection: () => void;
  onBulkUpdateCluster: (next: string | null) => void;
  onBulkUpdateSplit: (next: DatasetSplit | null) => void;
  onBulkRemove: () => Promise<void> | void;
}

function DatasetCanvasToolbar({
  tracesTable,
  lens,
  onLensChange,
  groupBy,
  onGroupByChange,
  showEmptyGroups,
  onShowEmptyGroupsChange,
  displayProperties,
  onToggleDisplayProperty,
  onResetDisplay,
  density: _density,
  onDensityChange: _onDensityChange,
  rowHeight,
  onRowHeightChange,
  inspectorOpen,
  onInspectorOpenChange,
  filterColumns,
  filterState,
  filterActions,
  totalCount: _totalCount,
  filteredCount: _filteredCount,
  savedViews,
  activeViewId,
  currentViewState,
  isViewDirty,
  onApplyView,
  onSaveCurrentView,
  onUpdateView,
  onDeleteView,
  evalRuns,
  activeEvalRunId,
  onSelectEvalRun,
  selectionCount,
  selectionAggregate,
  clusters,
  canEdit,
  canRemove,
  onClearSelection,
  onBulkUpdateCluster,
  onBulkUpdateSplit,
  onBulkRemove,
}: DatasetCanvasToolbarProps) {
  /* Bulk actions previously lived in the toolbar's trailing slot.
     They've moved to the floating `<BulkActionsFloatingBar>` rendered
     by the canvas page, anchored to the bottom-center of the content
     area. The `selection*` / `onBulk*` props are still part of this
     toolbar's interface for back-compat with consumers that haven't
     migrated yet, but this component no longer renders them. */
  void selectionAggregate;
  void selectionCount;
  void clusters;
  void canEdit;
  void canRemove;
  void onClearSelection;
  void onBulkUpdateCluster;
  void onBulkUpdateSplit;
  void onBulkRemove;

  const [editingViewId, setEditingViewId] = React.useState<string | null>(null);
  const editingView = React.useMemo(
    () => savedViews.find((view) => view.id === editingViewId) ?? null,
    [editingViewId, savedViews]
  );

  React.useEffect(() => {
    if (!editingViewId) return;
    if (!savedViews.some((view) => view.id === editingViewId)) {
      setEditingViewId(null);
    }
  }, [editingViewId, savedViews]);

  const handleSaveCurrentView = React.useMemo(() => {
    if (!onSaveCurrentView) return undefined;
    return async () => {
      const createdId = await onSaveCurrentView();
      if (createdId) setEditingViewId(createdId);
    };
  }, [onSaveCurrentView]);

  const isDisplayCustomized =
    groupBy !== "cluster" ||
    showEmptyGroups !== false ||
    rowHeight !== "comfortable" ||
    displayProperties.length !== DEFAULT_DISPLAY_PROPERTIES.length ||
    displayProperties.some(
      (p, idx) => DEFAULT_DISPLAY_PROPERTIES[idx] !== p
    );

  const tableControls = (
    <div className="flex flex-wrap items-center gap-1">
      <DatasetFilterRail
        columns={filterColumns}
        filters={filterState}
        actions={filterActions}
        compact
        slot="trigger"
        className="gap-1"
      />
      <DataTableSortList table={tracesTable} compact />
      <DisplayPopover
        groupBy={groupBy}
        onGroupByChange={onGroupByChange}
        showEmptyGroups={showEmptyGroups}
        onShowEmptyGroupsChange={onShowEmptyGroupsChange}
        displayProperties={displayProperties}
        onToggleDisplayProperty={onToggleDisplayProperty}
        rowHeight={rowHeight}
        onRowHeightChange={onRowHeightChange}
        onResetToDefault={onResetDisplay}
        compact
        isActive={isDisplayCustomized}
      />
      <InspectorToggleButton
        open={inspectorOpen}
        onOpenChange={onInspectorOpenChange}
      />
    </div>
  );

  /* Active-filter chips render in their own row below the toolbar
     (Linear-style filter bar). The +Filter trigger lives up in the
     toolbar's icon group, so this row is purely the active-state
     summary and only mounts when there's something to show. */
  const filterChipsRow =
    filterState.length > 0 ? (
      <DatasetFilterRail
        columns={filterColumns}
        filters={filterState}
        actions={filterActions}
        slot="chips"
      />
    ) : null;

  return (
    <div className="flex flex-shrink-0 flex-col">
      {/* Main toolbar — views (left) + filter / sort / display /
          inspector (right) + lens tabs (trailing). When a view is
          being edited, the filter row moves *into* the editor card
          below so it's visually clear those controls configure the
          view. */}
      <div
        className="flex flex-shrink-0 flex-col gap-2 border-b border-l-border-faint bg-black px-4 py-2"
        role="toolbar"
        aria-label="Dataset canvas controls"
      >
        <div className="flex flex-wrap items-center gap-2">
          <DatasetSavedViewsToolbar
            views={savedViews}
            activeViewId={activeViewId}
            isViewDirty={isViewDirty}
            onApplyView={(view) => {
              onApplyView(view);
              setEditingViewId(null);
            }}
            onEditView={(view) => {
              if (activeViewId !== view.id) onApplyView(view);
              setEditingViewId(view.id);
            }}
            onSaveCurrentView={handleSaveCurrentView}
            evalRuns={evalRuns}
            activeEvalRunId={activeEvalRunId ?? null}
            onSelectEvalRun={onSelectEvalRun}
            className="min-w-0 flex-1"
          />

          {editingView ? null : (
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              {tableControls}
            </div>
          )}

          <div
            role="tablist"
            aria-label="Lens"
            className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-l-border-faint bg-l-wash-1 p-0.5"
          >
            {DATASET_DETAIL_LENSES.map((id) => (
              <LensButton
                key={id}
                active={lens === id}
                onPress={() => onLensChange(id)}
                {...LENS_META[id]}
              />
            ))}
          </div>
        </div>

        {editingView ? (
          <DatasetSavedViewEditor
            view={editingView}
            isViewDirty={activeViewId === editingView.id && isViewDirty}
            currentViewState={currentViewState}
            canDelete={!!onDeleteView}
            onCancel={() => setEditingViewId(null)}
            onSave={
              onUpdateView
                ? async (patch) => {
                    await onUpdateView(editingView.id, patch);
                    setEditingViewId(null);
                  }
                : undefined
            }
            onDelete={
              onDeleteView
                ? async () => {
                    await onDeleteView(editingView.id);
                    setEditingViewId(null);
                  }
                : undefined
            }
          >
            {tableControls}
          </DatasetSavedViewEditor>
        ) : null}
      </div>

      {/* Linear-style active-filter bar — its own row below the
          main toolbar, only visible when at least one filter is
          applied. Hidden while editing a view because the filter
          rail is mounted *inside* the editor card during editing. */}
      {filterChipsRow && !editingView ? (
        <div
          aria-label="Active filters"
          className="flex flex-wrap items-center gap-1.5 border-b border-l-border-faint bg-black px-4 py-1.5"
        >
          {filterChipsRow}
        </div>
      ) : null}
    </div>
  );
}

interface DatasetSavedViewsToolbarProps {
  views: readonly DatasetSavedView[];
  activeViewId: string | null;
  isViewDirty: boolean;
  onApplyView: (view: DatasetSavedView) => void;
  onEditView: (view: DatasetSavedView) => void;
  onSaveCurrentView?: () => void;
  evalRuns?: readonly DatasetEvalRun[];
  activeEvalRunId: string | null;
  onSelectEvalRun?: (runId: string | null) => void;
  className?: string;
}

function DatasetSavedViewsToolbar({
  views,
  activeViewId,
  isViewDirty,
  onApplyView,
  onEditView,
  onSaveCurrentView,
  evalRuns,
  activeEvalRunId,
  onSelectEvalRun,
  className,
}: DatasetSavedViewsToolbarProps) {
  const hasViewControls = views.length > 0 || onSaveCurrentView;
  const hasEvalRuns = Boolean(evalRuns && evalRuns.length > 0);

  return (
    <div
      className={cx("flex min-w-0 flex-wrap items-center gap-1.5", className)}
    >
      {hasViewControls ? (
        <>
          {views.map((view) => {
            const active = view.id === activeViewId;
            return (
              <div
                key={view.id}
                className={cx(
                  "group inline-flex h-8 min-w-0 max-w-[220px] items-center rounded-pill border",
                  "transition-colors duration-fast ease-out motion-reduce:transition-none",
                  active
                    ? "border-l-border-strong bg-l-wash-3 text-l-ink"
                    : "border-l-border-faint bg-l-surface text-l-ink-lo hover:border-l-border-strong hover:bg-l-wash-2"
                )}
              >
                <button
                  type="button"
                  onClick={() => onApplyView(view)}
                  className="inline-flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pl-2.5 pr-1 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
                  aria-pressed={active}
                >
                  <Layers
                    className={cx(
                      "size-3.5 shrink-0",
                      active ? "text-l-ink" : "text-l-ink-dim"
                    )}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <span className="truncate font-sans text-[13px]">
                    {view.name}
                  </span>
                  {active && isViewDirty ? (
                    <span
                      className="size-1.5 shrink-0 rounded-pill bg-ember"
                      title="Unsaved changes"
                      aria-label="Unsaved changes"
                    />
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => onEditView(view)}
                  className={cx(
                    "mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded-pill text-l-ink-dim",
                    "opacity-70 transition-[background-color,color,opacity] duration-fast ease-out motion-reduce:transition-none",
                    "hover:bg-l-surface-hover hover:text-l-ink hover:opacity-100",
                    "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
                  )}
                  aria-label={`Edit view ${view.name}`}
                >
                  <Pencil className="size-3" strokeWidth={1.75} aria-hidden />
                </button>
              </div>
            );
          })}

          {onSaveCurrentView ? (
            <button
              type="button"
              onClick={onSaveCurrentView}
              aria-label="Save view"
              title="Save view"
              className={cx(
                "relative inline-flex size-8 shrink-0 items-center justify-center rounded-[10px]",
                "border border-l-border-faint bg-l-wash-1 text-l-ink-lo",
                "transition-colors duration-fast ease-out motion-reduce:transition-none",
                "hover:bg-l-wash-3 hover:text-l-ink",
                "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
              )}
            >
              <Layers
                className="size-4"
                strokeWidth={1.75}
                aria-hidden
              />
              <Plus
                className="absolute inset-0 m-auto size-2.5 -translate-y-[1px]"
                strokeWidth={3}
                aria-hidden
              />
            </button>
          ) : null}
        </>
      ) : null}

      {hasViewControls && hasEvalRuns ? (
        <span aria-hidden className="h-4 w-px bg-l-border-faint" />
      ) : null}

      {evalRuns?.map((run) => {
        const active = run.id === activeEvalRunId;
        return (
          <button
            key={run.id}
            type="button"
            onClick={() => onSelectEvalRun?.(active ? null : run.id)}
            className={cx(
              "inline-flex h-8 min-w-0 max-w-[220px] items-center gap-1.5 rounded-pill border px-2.5",
              "font-sans text-[13px] transition-colors duration-fast ease-out motion-reduce:transition-none",
              active
                ? "border-l-border-strong bg-l-wash-3 text-l-ink"
                : "border-l-border-faint bg-l-surface text-l-ink-lo hover:border-l-border-strong hover:bg-l-wash-2 hover:text-l-ink"
            )}
            aria-pressed={active}
          >
            <span
              aria-hidden
              className={cx(
                "size-1.5 shrink-0 rounded-pill",
                evalRunStatusDotClass(run.status)
              )}
            />
            <span className="truncate">{run.agentLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

interface DatasetSavedViewEditorProps {
  view: DatasetSavedView;
  isViewDirty: boolean;
  currentViewState: DatasetSavedView["state"];
  canDelete: boolean;
  onCancel: () => void;
  onSave?: (
    patch: Partial<Omit<DatasetSavedView, "id">>
  ) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  /** Filter / sort / display controls rendered inside the editor card
   *  so it's visually obvious these knobs configure the view. */
  children?: React.ReactNode;
}

function DatasetSavedViewEditor({
  view,
  isViewDirty,
  currentViewState,
  canDelete,
  onCancel,
  onSave,
  onDelete,
  children,
}: DatasetSavedViewEditorProps) {
  const [name, setName] = React.useState(view.name);
  const [description, setDescription] = React.useState(view.description ?? "");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    setName(view.name);
    setDescription(view.description ?? "");
  }, [view.description, view.name, view.id]);

  const trimmedName = name.trim();
  const canSave = Boolean(onSave && trimmedName.length > 0 && !pending);

  const save = React.useCallback(async () => {
    if (!onSave || !trimmedName) return;
    setPending(true);
    try {
      await onSave({
        name: trimmedName,
        description: description.trim() || undefined,
        ...(isViewDirty ? { state: currentViewState } : {}),
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setPending(false);
    }
  }, [currentViewState, description, isViewDirty, onSave, trimmedName]);

  const handleNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && canSave) {
      event.preventDefault();
      void save();
    }
  };

  return (
    <div
      role="group"
      aria-label={`Edit view ${view.name}`}
      className="rounded-[10px] border border-l-border-faint bg-l-wash-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-l-wash-4 text-l-ink-lo">
          <Layers className="size-4" strokeWidth={1.75} aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            onKeyDown={handleNameKeyDown}
            className={cx(
              "h-8 w-full min-w-0 bg-transparent px-0 font-sans text-[18px] font-medium leading-none text-l-ink outline-none",
              "placeholder:text-l-ink-dim"
            )}
            placeholder="View name"
            aria-label="View name"
          />
          <input
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
            onKeyDown={handleNameKeyDown}
            className={cx(
              "mt-1 h-7 w-full min-w-0 bg-transparent px-0 font-sans text-[13px] text-l-ink-lo outline-none",
              "placeholder:text-l-ink-dim"
            )}
            placeholder="Description (optional)"
            aria-label="View description"
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canDelete && onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onPress={() => void onDelete()}
              aria-label={`Delete view ${view.name}`}
              className="text-l-ink-dim hover:text-l-p-urgent"
            >
              <Trash2 className="size-3.5" strokeWidth={1.75} />
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onPress={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            isPending={pending}
            disabled={!canSave}
            onPress={() => void save()}
          >
            Save
          </Button>
        </div>
      </div>

      {children ? (
        <div className="border-t border-l-border-faint px-4 py-2">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function evalRunStatusDotClass(status: DatasetEvalRun["status"]): string {
  switch (status) {
    case "passing":
      return "bg-l-status-done";
    case "regressed":
      return "bg-l-status-inprogress";
    case "running":
      return "bg-l-ink-dim";
    case "failed":
      return "bg-l-p-urgent";
  }
}

/* ── Batch-actions strip ─────────────────────────────────── */

interface BatchActionsStripProps {
  count: number;
  clusterValue: string | null | "mixed";
  splitValue: DatasetSplit | null | "mixed";
  clusters: readonly DatasetCluster[];
  canEdit: boolean;
  canRemove: boolean;
  onClear: () => void;
  onUpdateCluster: (next: string | null) => void;
  onUpdateSplit: (next: DatasetSplit | null) => void;
  onRemove: () => Promise<void> | void;
}

function BatchActionsStrip({
  count,
  clusterValue,
  splitValue,
  clusters,
  canEdit,
  canRemove,
  onClear,
  onUpdateCluster,
  onUpdateSplit,
  onRemove,
}: BatchActionsStripProps) {
  const [removePending, setRemovePending] = React.useState(false);
  const handleRemove = async () => {
    setRemovePending(true);
    try {
      await onRemove();
    } finally {
      setRemovePending(false);
    }
  };
  return (
    <div
      className="flex flex-wrap items-center gap-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150"
      role="group"
      aria-label={`Bulk actions for ${count} traces`}
    >
      <ClearSelectionButton count={count} onClear={onClear} />
      {canEdit ? (
        <>
          <span className="h-4 w-px bg-hairline" aria-hidden />
          {clusters.length > 0 ? (
            <ClusterPicker
              value={clusterValue}
              clusters={clusters}
              onChange={onUpdateCluster}
              variant="chip"
            />
          ) : null}
          <SplitPicker
            value={splitValue}
            onChange={onUpdateSplit}
            variant="chip"
          />
        </>
      ) : null}
      {canRemove ? (
        <>
          <span className="h-4 w-px bg-hairline" aria-hidden />
          <Button
            variant="critical"
            size="sm"
            onPress={() => void handleRemove()}
            isLoading={removePending}
            leadingIcon={<Trash2 className="size-3.5" strokeWidth={1.75} />}
          >
            Remove
          </Button>
        </>
      ) : null}
    </div>
  );
}

/* ── Floating bulk-actions bar ────────────────────────────────────
 *
 * Replaces the inline `BatchActionsStrip` in the canvas toolbar. The
 * bar lives at the bottom-center of the canvas content area and slides
 * up + fades in when `selectionCount > 0`. Always mounted so the exit
 * animation runs symmetrically when count drops to 0.
 *
 * Anchoring:
 *   - The parent of this component must be `position: relative` so the
 *     `absolute` positioning here lands inside the canvas content area
 *     (not the viewport). This keeps the bar visually associated with
 *     the table and avoids overlapping the inspector drawer or other
 *     docked surfaces.
 *
 * A11y:
 *   - `role="region"` + `aria-label="Bulk actions"` so screen readers
 *     announce the toolbar by purpose.
 *   - `aria-hidden` flips with the open state so the buttons are not
 *     reachable via tab while the bar is animating out.
 *   - `Escape` is already wired through `dataset-canvas-keyboard.ts`
 *     (the `focus.close` handler clears selection when nothing else
 *     is open), so dismiss-on-Escape works without per-bar listeners.
 */
interface BulkActionsFloatingBarProps {
  selectionCount: number;
  selectionAggregate: SelectionAggregate | null;
  clusters: readonly DatasetCluster[];
  canEdit: boolean;
  canRemove: boolean;
  onClearSelection: () => void;
  onBulkUpdateCluster: (next: string | null) => void;
  onBulkUpdateSplit: (next: DatasetSplit | null) => void;
  onBulkRemove: () => Promise<void> | void;
}

function BulkActionsFloatingBar({
  selectionCount,
  selectionAggregate,
  clusters,
  canEdit,
  canRemove,
  onClearSelection,
  onBulkUpdateCluster,
  onBulkUpdateSplit,
  onBulkRemove,
}: BulkActionsFloatingBarProps) {
  const open = selectionCount > 0 && selectionAggregate !== null;

  /* Keep the last non-null aggregate around so the pickers don't flash
     to a blank state during the exit animation when the consumer drops
     `selectionAggregate` to null the moment count hits 0. */
  const [stickyAggregate, setStickyAggregate] =
    React.useState<SelectionAggregate | null>(null);
  React.useEffect(() => {
    if (selectionAggregate) setStickyAggregate(selectionAggregate);
  }, [selectionAggregate]);
  const aggregate = selectionAggregate ?? stickyAggregate;

  const [removePending, setRemovePending] = React.useState(false);
  const handleRemove = async () => {
    setRemovePending(true);
    try {
      await onBulkRemove();
    } finally {
      setRemovePending(false);
    }
  };

  const stickyCount = open
    ? selectionCount
    : (aggregate?.count ?? selectionCount);

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      aria-hidden={!open}
      className={cx(
        "pointer-events-none absolute inset-x-0 bottom-6 z-30 flex justify-center",
        "transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
        open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      {/*
       * Linear-shaped floating dock:
       *   - Pill body with backdrop blur so scrolling content beneath
       *     reads as "below" the bar.
       *   - Single 28px row inside a 36px frame (`p-1`). Every child is
       *     `h-7` so the eye doesn't jitter between elements.
       *   - Custom layered shadow (close + far) instead of `shadow-lg`,
       *     which is too soft for a dock that should feel deliberate.
       *   - No vertical separators — the gap rhythm groups items: tight
       *     `gap-1` between siblings, `gap-2` between logical groups.
       */}
      <div
        className={cx(
          "pointer-events-auto inline-flex h-9 items-center gap-1 rounded-full p-1",
          "border border-border bg-popover/95 backdrop-blur-md",
          "shadow-[0_8px_24px_-12px_rgba(0,0,0,0.45),0_2px_4px_-2px_rgba(0,0,0,0.25)]"
        )}
      >
        {/* Count + Esc kbd. Esc lives outside the aria-live region so
            screen readers don't re-announce the shortcut on every count
            change — only the count + "selected" announces. */}
        <span className="inline-flex h-7 items-center gap-2 pl-2.5 pr-1.5 font-sans text-[12.5px] text-muted-foreground">
          <span aria-live="polite">
            <span className="font-medium tabular-nums text-foreground">
              {stickyCount}
            </span>{" "}
            selected
          </span>
          <Kbd>Esc</Kbd>
        </span>

        <Tooltip content="Clear selection" delay={300}>
          <button
            type="button"
            onClick={onClearSelection}
            aria-label={`Clear selection of ${stickyCount} ${stickyCount === 1 ? "trace" : "traces"}`}
            tabIndex={open ? 0 : -1}
            className={cx(
              "inline-flex size-7 items-center justify-center rounded-full text-muted-foreground",
              "[@media(hover:hover)]:hover:bg-muted [@media(hover:hover)]:hover:text-foreground",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
              "transition-colors duration-fast ease-out motion-reduce:transition-none"
            )}
          >
            <X className="size-3.5" strokeWidth={1.75} aria-hidden />
          </button>
        </Tooltip>

        {canEdit && aggregate ? (
          <span className="ml-1 inline-flex items-center gap-1">
            {clusters.length > 0 ? (
              /* Span wrappers normalize picker chip height to 28px to
                 match the dock row, while preserving the chip's own
                 `[@media(pointer:coarse)]:h-9` touch bump. */
              <span className="inline-flex [&>button]:h-7 [@media(pointer:coarse)]:[&>button]:h-9">
                <ClusterPicker
                  value={aggregate.cluster}
                  clusters={clusters}
                  onChange={onBulkUpdateCluster}
                  variant="chip"
                />
              </span>
            ) : null}
            <span className="inline-flex [&>button]:h-7 [@media(pointer:coarse)]:[&>button]:h-9">
              <SplitPicker
                value={aggregate.split}
                onChange={onBulkUpdateSplit}
                variant="chip"
              />
            </span>
          </span>
        ) : null}

        {canRemove ? (
          /*
           * Ghost-styled destructive: red text + icon on transparent,
           * subtle red wash on hover. Less startling than a solid red
           * `<Button variant="critical">` for an always-visible dock.
           * The `⌫` kbd hint signals the bound keyboard shortcut
           * (Cmd+Backspace via the canvas keymap).
           */
          <button
            type="button"
            onClick={() => void handleRemove()}
            disabled={removePending}
            tabIndex={open ? 0 : -1}
            aria-label={`Remove ${stickyCount} selected ${stickyCount === 1 ? "trace" : "traces"}`}
            className={cx(
              "ml-1 inline-flex h-7 items-center gap-1.5 rounded-full pl-2 pr-1.5",
              "font-sans text-[12.5px] font-medium text-event-red",
              "[@media(hover:hover)]:hover:bg-event-red/10",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-event-red",
              "transition-colors duration-fast ease-out motion-reduce:transition-none",
              "disabled:cursor-not-allowed disabled:opacity-60"
            )}
          >
            {removePending ? (
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="size-3.5 animate-spin"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="opacity-25"
                />
                <path
                  d="M4 12a8 8 0 018-8"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="opacity-75"
                />
              </svg>
            ) : (
              <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
            )}
            <span>Remove</span>
            <Kbd>⌫</Kbd>
          </button>
        ) : null}
      </div>
    </div>
  );
}

interface LensButtonProps {
  label: string;
  kbd: string;
  Icon: React.ComponentType<{
    className?: string;
    strokeWidth?: number;
    "aria-hidden"?: true;
  }>;
  active: boolean;
  onPress: () => void;
}

function LensButton({ label, kbd, Icon, active, onPress }: LensButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onPress}
      title={`${label} (${kbd})`}
      className={cx(
        "inline-flex h-7 items-center gap-1.5 rounded-[2px] px-2 font-sans text-[12px] transition-colors duration-fast ease-out",
        "touch-manipulation [@media(pointer:coarse)]:h-9",
        "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
        active
          ? "bg-l-surface-selected text-l-ink"
          : "text-l-ink-lo hover:bg-l-surface-hover hover:text-l-ink"
      )}
    >
      <Icon className="size-3.5" strokeWidth={1.6} aria-hidden />
      <span>{label}</span>
      <kbd
        className="hidden font-mono text-[10px] text-l-ink-dim md:inline"
        aria-hidden
      >
        {kbd}
      </kbd>
    </button>
  );
}

/* ── Display popover ──────────────────────────────────────── */

const GROUP_BY_OPTIONS: Array<{ value: DatasetGroupBy; label: string }> = [
  { value: "cluster", label: "Cluster" },
  { value: "split", label: "Split" },
  { value: "source", label: "Source" },
  { value: "none", label: "None" },
];

const DISPLAY_PROPERTY_LABELS: Record<DatasetDisplayProperty, string> = {
  cluster: "Cluster",
  events: "Events",
  duration: "Duration",
  split: "Split",
  traceId: "Trace ID",
};

interface DisplayPopoverProps {
  groupBy: DatasetGroupBy;
  onGroupByChange: (next: DatasetGroupBy) => void;
  showEmptyGroups: boolean;
  onShowEmptyGroupsChange: (next: boolean) => void;
  displayProperties: readonly DatasetDisplayProperty[];
  onToggleDisplayProperty: (key: DatasetDisplayProperty) => void;
  /** Row density. Mounted inline as a "Row height" picker row so the
   *  toolbar doesn't have to carry a dedicated standalone button. */
  rowHeight: DatasetTracesRowHeight;
  onRowHeightChange: (next: DatasetTracesRowHeight) => void;
  /** Reset every dimension to the canvas's defaults. */
  onResetToDefault: () => void;
  /** Render the trigger as an icon-only square pill, with a small dot
   *  when display has been customized away from defaults. */
  compact?: boolean;
  /** Drives the dot indicator in compact mode. */
  isActive?: boolean;
}

const ROW_HEIGHT_OPTIONS: ReadonlyArray<{
  value: DatasetTracesRowHeight;
  label: string;
}> = [
  { value: "compact", label: "Compact" },
  { value: "default", label: "Default" },
  { value: "comfortable", label: "Comfortable" },
  { value: "spacious", label: "Spacious" },
];

const ROW_HEIGHT_LABEL: Record<DatasetTracesRowHeight, string> = {
  compact: "Compact",
  default: "Default",
  comfortable: "Comfortable",
  spacious: "Spacious",
};

/**
 * Toolbar pill that toggles the right-side trace inspector panel.
 * Designed to slot in beside the row-height pill so the four
 * filter/sort/display/inspector controls read as one icon-only group.
 *
 * Design choices (Emil):
 *   • Icon-only with `aria-label` + `aria-pressed` for screen readers
 *     and a `title` tooltip for sighted hover users.
 *   • Linear-style morph: the outer rectangle stays put while the
 *     inner divider line slides between two positions so users see a
 *     continuous transformation instead of a glyph swap. Avoids the
 *     accessibility footgun of two stacked `aria-hidden` icons and
 *     the cross-fade flicker that comes with it.
 *   • Hover wash gated by `(hover: hover)` so iOS doesn't get a stuck
 *     wash after a tap.
 *   • Animation kept under 200ms (`ease-out`) — the toggle is
 *     user-initiated and infrequent enough to deserve motion.
 *   • Reduced motion: the divider snaps without easing when
 *     `prefers-reduced-motion: reduce` is set.
 *   • Focus-visible ring and `outline-ember` so keyboard users see the
 *     focus target without it bleeding into mouse-pointer hover state.
 *   • Same 32 × 32 squircle as its siblings (`rounded-[10px]`,
 *     `border-l-border-faint`, `bg-l-wash-1`) — no layout shift across
 *     state changes because the SVG box is fixed at 16 × 16.
 */
function InspectorToggleButton({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const label = open ? "Hide inspector" : "Show inspector";
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={open}
      title={label}
      onClick={() => onOpenChange(!open)}
      className={cx(
        "relative inline-flex size-8 shrink-0 items-center justify-center rounded-[10px]",
        "border border-l-border-faint bg-l-wash-1 text-l-ink-lo",
        "transition-colors duration-fast ease-out motion-reduce:transition-none",
        "[@media(hover:hover)]:hover:bg-l-wash-3 [@media(hover:hover)]:hover:text-l-ink",
        "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
        open ? "text-l-ink" : null
      )}
    >
      <InspectorPanelIcon open={open} />
    </button>
  );
}

/**
 * Custom inspector pictogram — a stable rounded rectangle with an
 * inner divider line that animates between two positions. Mirrors
 * Linear's sidebar toggle: the line slides toward the panel edge when
 * the inspector is open and toward the centre when it's closed, so
 * the metaphor reads as the panel itself sliding in/out.
 */
function InspectorPanelIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="size-4"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      {/* The divider lives inside a `<g>` so we can transform via CSS
         without disturbing the rect's coordinates. SVG transforms in
         user-space units interact 1:1 with the viewBox (24×24), so a
         6-unit translate is exactly 1/4 of the icon width. */}
      <g
        className="transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(${open ? 0 : -6}px)` }}
      >
        <line x1="15" y1="3" x2="15" y2="21" />
      </g>
    </svg>
  );
}

/**
 * Tablecn-shaped view dropdown — Grouping picker + show-empty-groups
 * toggle + column-visibility list + Reset. The Sort affordance now
 * lives at the top-level toolbar (`DataTableSortList`) so it doesn't
 * have to live nested inside this popover.
 */
function DisplayPopover({
  groupBy,
  onGroupByChange,
  showEmptyGroups,
  onShowEmptyGroupsChange,
  displayProperties,
  onToggleDisplayProperty,
  rowHeight,
  onRowHeightChange,
  onResetToDefault,
  compact,
  isActive,
}: DisplayPopoverProps) {
  const groupByLabel =
    GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label ?? "—";
  const displaySet = new Set(displayProperties);

  return (
    <Popover>
      <PopoverTrigger asChild>
        {compact ? (
          <button
            type="button"
            aria-label="Display"
            title="Display"
            className={cx(
              "relative inline-flex size-8 shrink-0 items-center justify-center rounded-[10px]",
              "border border-l-border-faint bg-l-wash-1 text-l-ink-lo",
              "transition-colors duration-fast ease-out motion-reduce:transition-none",
              "hover:bg-l-wash-3 hover:text-l-ink",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
              isActive ? "text-l-ink" : null
            )}
          >
            <SlidersHorizontal
              className="size-4"
              strokeWidth={1.75}
              aria-hidden
            />
            {isActive ? (
              <span
                aria-hidden
                className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-ember"
              />
            ) : null}
          </button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={
              <SlidersHorizontal className="size-3.5" strokeWidth={1.6} />
            }
          >
            Display
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        placement="bottom end"
        className="w-[296px] overflow-hidden p-0"
      >
        {/* Section 1 — Grouping + Row height (Sort lives in the
            toolbar now). Row height moved here so the toolbar
            doesn't need its own standalone pill. */}
        <div className="flex flex-col gap-0.5 border-b border-border px-3 py-2">
          <DisplayDropdownRow
            label="Grouping"
            value={groupByLabel}
            options={GROUP_BY_OPTIONS}
            selected={groupBy}
            onSelect={(v) => onGroupByChange(v as DatasetGroupBy)}
          />
          <DisplayDropdownRow
            label="Row height"
            value={ROW_HEIGHT_LABEL[rowHeight]}
            options={ROW_HEIGHT_OPTIONS}
            selected={rowHeight}
            onSelect={(v) => onRowHeightChange(v as DatasetTracesRowHeight)}
          />
        </div>

        {/* Section 2 — toggles */}
        <div className="flex flex-col gap-0.5 border-b border-hairline px-3 py-2">
          <DisplayToggleRow
            label="Show empty groups"
            value={showEmptyGroups}
            onChange={onShowEmptyGroupsChange}
            disabled={groupBy === "none"}
          />
        </div>

        {/* Section 3 — Display properties (TanStack-driven column visibility) */}
        <div className="flex flex-col border-b border-hairline">
          <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1">
            <span className="font-sans text-[11px] text-muted-foreground">
              Properties
            </span>
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {displaySet.size + 2 /* select+trace are always on */} of{" "}
              {DATASET_DISPLAY_PROPERTIES.length + 2}
            </span>
          </div>
          <ul
            role="listbox"
            aria-label="Visible columns"
            className="flex flex-col px-1 pb-1"
          >
            {DATASET_DISPLAY_PROPERTIES.map((key) => {
              const active = displaySet.has(key);
              return (
                <li key={key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => onToggleDisplayProperty(key)}
                    className={cx(
                      "flex w-full items-center justify-between rounded-[3px] px-2 py-1.5 text-left",
                      "font-sans text-[12px] text-foreground",
                      "hover:bg-muted/60 focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
                      "[@media(pointer:coarse)]:py-2"
                    )}
                  >
                    <span>{DISPLAY_PROPERTY_LABELS[key]}</span>
                    <Check
                      className={cx(
                        "size-3.5 shrink-0",
                        active ? "text-ember" : "opacity-0"
                      )}
                      strokeWidth={2}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Section 4 — Reset */}
        <div className="flex items-center justify-end gap-3 px-3 py-2">
          <button
            type="button"
            onClick={onResetToDefault}
            className={cx(
              "font-sans text-[11.5px] text-l-ink-dim",
              "hover:text-l-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
            )}
          >
            Reset to default
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** A single "label · value (chevron)" row with a nested popover for
 *  picking the next value. Mirrors Linear's `_Simple Dropdown` node. */
function DisplayDropdownRow({
  label,
  value,
  options,
  selected,
  onSelect,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="font-sans text-[12px] text-l-ink-dim">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cx(
              "inline-flex h-6 items-center justify-between gap-1 rounded-[3px] px-2",
              "min-w-[120px]",
              "bg-l-surface-input font-sans text-[12px] text-l-ink",
              "hover:bg-l-surface-hover transition-colors duration-fast ease-out",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
              "[@media(pointer:coarse)]:h-9"
            )}
          >
            <span className="truncate">{value}</span>
            <span aria-hidden className="ml-1 text-l-ink-dim">
              ⌄
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent placement="bottom end" className="w-[180px] p-1">
          <ul role="listbox" className="flex flex-col">
            {options.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={opt.value === selected}
                  onClick={() => onSelect(opt.value)}
                  className={cx(
                    "flex w-full items-center justify-between rounded-[3px] px-2 py-1.5 text-left",
                    "font-sans text-[12px] text-l-ink",
                    "hover:bg-l-surface-hover focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
                    opt.value === selected ? "bg-l-surface-selected" : null
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {opt.value === selected ? (
                    <Check
                      className="ml-2 size-3.5 shrink-0 text-ember"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** A small `label · toggle` row matching Linear's view-dropdown
 *  toggle pattern. Built on a native checkbox so keyboard navigation
 *  works inside the popover without extra wiring. */
function DisplayToggleRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cx(
        "flex items-center justify-between py-1",
        disabled ? "opacity-60" : null
      )}
    >
      <span className="font-sans text-[12px] text-l-ink-dim">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={cx(
          "relative inline-flex h-[14px] w-[24px] shrink-0 items-center rounded-pill p-[2px]",
          "transition-colors duration-fast ease-out motion-reduce:transition-none",
          "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
          "disabled:cursor-not-allowed",
          value ? "bg-ember" : "bg-l-wash-5"
        )}
      >
        <span
          aria-hidden
          className={cx(
            "block size-[10px] rounded-pill bg-white transition-transform duration-fast ease-out",
            "motion-reduce:transition-none",
            value ? "translate-x-[10px]" : "translate-x-0"
          )}
        />
      </button>
    </label>
  );
}

/* ── Canvas content (lens swap) ──────────────────────────── */

interface DatasetCanvasContentProps {
  snapshot: DatasetSnapshot;
  lens: DatasetDetailLens;
  /** TanStack table instance — the list lens's source of truth for
   *  sort, column visibility, and row-selection state. */
  tracesTable: TanStackTable<TraceSummary>;
  groupBy: DatasetGroupBy;
  rowHeight: DatasetTracesRowHeight;
  showEmptyGroups: boolean;
  filteredTraces: TraceSummary[];
  selectedTraceId: string | null;
  onSelectTrace?: (traceId: string | null) => void;
  focusedTraceId: string | null;
  /** Trace ids that the active eval run failed on; renders a small
   *  red marker on the trace row. */
  failingTraceIdSet: ReadonlySet<string>;
  onRowClick: (
    traceId: string,
    event: React.MouseEvent | React.KeyboardEvent
  ) => void;
  onCheckboxChange: (
    traceId: string,
    next: boolean,
    event: React.MouseEvent
  ) => void;
  selectAllState: "none" | "indeterminate" | "all";
  onSelectAllVisible: (next: boolean) => void;
  /* Inline chip editing. */
  canEdit: boolean;
  onUpdateCluster: (traceId: string, next: string | null) => void;
  onUpdateSplit: (traceId: string, next: DatasetSplit | null) => void;
  /** Whether any filter is currently active. Drives the empty-state
   *  copy / clear-filters affordance when the table is empty. */
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  /* Other lens slots. */
  datasetsForAdd?: readonly Dataset[];
  onAddTraceToDataset?: AddTraceToDatasetHandler;
  getDatasetMembershipsForTrace?: DatasetMembershipsResolver;
  renderGraph?: (snapshot: DatasetSnapshot) => React.ReactNode;
  renderTimeline?: (snapshot: DatasetSnapshot) => React.ReactNode;
  onCoverageBucketSelect: (bucket: CoverageBucketSelection) => void;
}

function DatasetCanvasContent({
  snapshot,
  lens,
  tracesTable,
  groupBy,
  rowHeight,
  showEmptyGroups,
  filteredTraces,
  selectedTraceId,
  onSelectTrace,
  focusedTraceId,
  failingTraceIdSet,
  onRowClick,
  onCheckboxChange,
  selectAllState,
  onSelectAllVisible,
  canEdit,
  onUpdateCluster,
  onUpdateSplit,
  hasActiveFilters,
  onClearFilters,
  datasetsForAdd,
  onAddTraceToDataset,
  getDatasetMembershipsForTrace,
  renderGraph,
  renderTimeline,
  onCoverageBucketSelect,
}: DatasetCanvasContentProps) {
  switch (lens) {
    case "list":
      return (
        <DatasetTracesTable
          table={tracesTable}
          snapshot={snapshot}
          groupBy={groupBy}
          rowHeight={rowHeight}
          showEmptyGroups={showEmptyGroups}
          /* density was the legacy 2-step prop; the new 4-step
             rowHeight is the source of truth. */
          selectedTraceId={selectedTraceId}
          focusedTraceId={focusedTraceId}
          failingTraceIdSet={failingTraceIdSet}
          onRowClick={onRowClick}
          onCheckboxChange={onCheckboxChange}
          selectAllState={selectAllState}
          onSelectAllVisible={onSelectAllVisible}
          canEdit={canEdit}
          onUpdateCluster={onUpdateCluster}
          onUpdateSplit={onUpdateSplit}
          emptyPlaceholder={
            <FilteredEmpty
              totalCount={snapshot.traces.length}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={onClearFilters}
            />
          }
        />
      );
    case "graph":
      return (
        <div className="flex h-full min-h-0 flex-1 flex-col p-0">
          {renderGraph ? (
            renderGraph(snapshot)
          ) : (
            <DatasetGraphView
              snapshot={snapshot}
              selectedTraceId={selectedTraceId}
              onSelectTrace={onSelectTrace}
            />
          )}
        </div>
      );
    case "timeline":
      return (
        <div className="flex h-full min-h-0 flex-1 flex-col p-0">
          {renderTimeline ? (
            renderTimeline(snapshot)
          ) : (
            <TimelineLens
              snapshot={snapshot}
              selectedTraceId={selectedTraceId}
              onSelectTrace={onSelectTrace}
              datasetsForAdd={datasetsForAdd}
              onAddTraceToDataset={onAddTraceToDataset}
              getDatasetMembershipsForTrace={getDatasetMembershipsForTrace}
            />
          )}
        </div>
      );
    case "coverage":
      return (
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-auto p-4">
          <DatasetCoverageLens
            traces={filteredTraces}
            totalCount={snapshot.traces.length}
            clusters={snapshot.clusters}
            onBucketSelect={onCoverageBucketSelect}
          />
        </div>
      );
  }
}

/**
 * Empty state shown when the table has no rows after filtering.
 * Mirrors Linear's pattern:
 *   • a tilted filter illustration
 *   • a single concise headline
 *   • a small panel showing how many rows are hidden + a one-click
 *     Clear Filters action
 *
 * When the dataset itself is empty (no filters active), the headline
 * and panel adapt — we just say "No traces in this dataset" without
 * the clear-filters affordance.
 */
function FilteredEmpty({
  totalCount,
  hasActiveFilters,
  onClearFilters,
}: {
  totalCount: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div className="flex flex-1 min-h-0 items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-5 text-center">
        <FilterEmptyIllustration />

        <p className="font-sans text-[13px] text-l-ink-lo">
          {hasActiveFilters
            ? "No traces matching the filters"
            : "No traces in this dataset"}
        </p>

        {hasActiveFilters ? (
          <div className="inline-flex items-center gap-2 rounded-[6px] border border-l-border-faint bg-l-wash-1 py-1 pl-3 pr-1">
            <span className="font-sans text-[12px] text-l-ink-lo">
              <span className="font-medium text-l-ink">
                {formatNumber(totalCount)}{" "}
                {totalCount === 1 ? "trace" : "traces"}
              </span>{" "}
              hidden by filters
            </span>
            <button
              type="button"
              onClick={onClearFilters}
              className={cx(
                "inline-flex h-7 items-center gap-1 rounded-[4px] px-2",
                "font-sans text-[12px] text-l-ink",
                "transition-colors duration-fast ease-out motion-reduce:transition-none",
                "[@media(hover:hover)]:hover:bg-l-wash-3",
                "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
              )}
            >
              Clear Filters
              <X className="size-3" strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Tilted filter pictogram for the empty state. Hand-drawn-feeling
 * stack of three lines inside a rotated rounded square — same vibe
 * as Linear's "no issues matching the filters" illustration. Built
 * inline so it can pick up `currentColor` without an extra asset.
 */
function FilterEmptyIllustration() {
  return (
    <span
      aria-hidden
      className="inline-flex size-16 items-center justify-center text-l-ink-dim/60"
    >
      <svg
        width="64"
        height="64"
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="-rotate-12"
      >
        {/* Outer rounded card. */}
        <rect
          x="12"
          y="14"
          width="40"
          height="36"
          rx="6"
          className="text-l-ink-dim/40"
        />
        {/* Three filter lines, decreasing in length to evoke the
           classic funnel/filter glyph. */}
        <line x1="22" y1="26" x2="42" y2="26" />
        <line x1="25" y1="32" x2="39" y2="32" />
        <line x1="28" y1="38" x2="36" y2="38" />
      </svg>
    </span>
  );
}

/* ── Timeline lens ──────────────────────────────────────── */

interface TimelineLensProps {
  snapshot: DatasetSnapshot;
  selectedTraceId: string | null;
  onSelectTrace?: (traceId: string | null) => void;
  datasetsForAdd?: readonly Dataset[];
  onAddTraceToDataset?: AddTraceToDatasetHandler;
  getDatasetMembershipsForTrace?: DatasetMembershipsResolver;
}

function TimelineLens({
  snapshot,
  selectedTraceId,
  onSelectTrace,
  datasetsForAdd,
  onAddTraceToDataset,
  getDatasetMembershipsForTrace,
}: TimelineLensProps) {
  const events = React.useMemo(() => snapshot.events ?? [], [snapshot.events]);
  const datasets = datasetsForAdd ?? [snapshot.dataset];

  /* Capture a stable mount timestamp so the initial range stays
     idempotent across re-renders. Mirrors `TimelineDashboard`'s
     pattern at `/dashboard/timeline`. */
  const [mountedAtMs] = React.useState(() => Date.now());

  const [playback, setPlayback] = React.useState<StreamPlaybackState>("paused");
  const [groupBy, setGroupBy] = React.useState<StreamTimelineGroupBy>("trace");
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(
    null
  );

  React.useEffect(() => {
    if (!selectedTraceId) {
      setSelectedEventId(null);
      return;
    }
    const firstEvent = events.find((e) => e.traceId === selectedTraceId);
    setSelectedEventId(firstEvent?.id ?? null);
  }, [selectedTraceId, events]);

  /* Anchor the initial view so the playhead lands 15 minutes before
     the latest event (matches `TimelineDashboard`'s contract). The
     viewer's first-mount centering effect will then snap to the
     latest event ± 30 minutes when paused, but providing a sensible
     initial range avoids a flash of wrong-time content on first
     paint. */
  const { initialCenterMs, initialHalfWidthMs } = React.useMemo(() => {
    if (events.length === 0) {
      return {
        initialCenterMs: mountedAtMs - 15 * 60 * 1000,
        initialHalfWidthMs: 20 * 60 * 1000,
      };
    }
    let latest = -Infinity;
    for (const e of events) {
      const t = new Date(e.occurredAt).getTime();
      if (t > latest) latest = t;
    }
    return {
      initialCenterMs: latest - 15 * 60 * 1000,
      initialHalfWidthMs: 20 * 60 * 1000,
    };
  }, [events, mountedAtMs]);

  if (events.length === 0) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 p-6 text-center">
        <span className="font-sans text-[12.5px] text-l-ink-lo">
          No events to display
        </span>
        <span className="font-mono text-[11px] text-l-ink-dim">
          Add traces to this dataset to populate the timeline.
        </span>
      </div>
    );
  }

  return (
    /* Outer wrapper mirrors `TimelineDashboard` 1:1 — no extra
       `bg-l-surface` so the viewer's own `bg-page` reads correctly,
       no `h-full` so the chain `flex-1 min-h-0` from the canvas is
       what bounds the height. */
    <div className="flex min-h-0 flex-1 flex-col">
      <StreamTimelineViewer
        events={events}
        playback={playback}
        selectedEventId={selectedEventId}
        onPlaybackChange={setPlayback}
        onSelect={(e) => {
          setSelectedEventId(e.eventId);
          if (!onSelectTrace) return;
          if (!e.event) {
            onSelectTrace(null);
            return;
          }
          onSelectTrace(e.event.traceId ?? null);
        }}
        initialCenterMs={initialCenterMs}
        initialHalfWidthMs={initialHalfWidthMs}
        toolbarLeading={
          <span className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.04em] text-l-ink-dim">
            <span className="truncate text-l-ink-lo">
              {snapshot.dataset.name}
            </span>
            <span aria-hidden>·</span>
            <span>{snapshot.traces.length} traces</span>
          </span>
        }
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        showFilters
        showConnectors
        /* The dataset canvas owns the inspector at the chassis
           level via `DatasetTraceDetailDrawer` — it surfaces the
           selected trace AND a navigable list of its events with
           an "Active event" detail block, so the timeline's inline
           detail panel would be redundant. Disabled here so the
           canvas has exactly one inspector across all lenses. */
        showDetailPanel={false}
        datasets={datasets}
        onAddTraceToDataset={onAddTraceToDataset}
        getDatasetMembershipsForTrace={getDatasetMembershipsForTrace}
        className="flex-1"
      />
    </div>
  );
}
