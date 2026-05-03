"use client";

import * as React from "react";
import {
  Check,
  List as ListIcon,
  Network,
  PieChart,
  Pencil,
  SlidersHorizontal,
  Timer,
  Trash2,
  X,
} from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import { Checkbox } from "../primitives/checkbox";
import { Input } from "../primitives/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../primitives/popover";
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

import { DatasetCanvasRail } from "./dataset-canvas-rail";
import { DatasetFilterRail } from "./dataset-filter-rail";

import { DATASET_PURPOSE_META } from "./purpose-meta";
import { DatasetActionsMenu } from "./dataset-actions-menu";
import {
  DatasetCoverageLens,
  type CoverageBucketSelection,
} from "./dataset-coverage-lens";
import { DatasetEmpty } from "./dataset-empty";
import { DatasetGraphView } from "./dataset-graph-view";
import { DatasetMetricsStrip } from "./dataset-metrics-strip";
import { defaultDatasetTraceColumns } from "./dataset-trace-columns";
import {
  ClearSelectionButton,
  ClusterPicker,
  SplitPicker,
  StatusPicker,
} from "./dataset-trace-pickers";
import {
  useDatasetCanvasKeyboard,
  type DatasetCanvasHandlers,
} from "./dataset-canvas-keyboard";
import { DatasetCommandPalette } from "./dataset-command-palette";
import { DatasetShortcutSheet } from "./dataset-shortcut-sheet";
import {
  TraceSummaryRow,
  buildClusterIndex,
  traceRowGridTemplate,
} from "./trace-summary-row";
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
  TraceStatus,
  TraceSummary,
  UpdateDatasetHandler,
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

export type DatasetDetailLens =
  | "list"
  | "graph"
  | "timeline"
  | "coverage";

export const DATASET_DETAIL_LENSES: readonly DatasetDetailLens[] = [
  "list",
  "graph",
  "timeline",
  "coverage",
];

/** Backward-compat alias — the old API named these "tabs". */
export type DatasetDetailTab = DatasetDetailLens;
export const DATASET_DETAIL_TABS = DATASET_DETAIL_LENSES;

export type DatasetGroupBy = "cluster" | "split" | "source" | "status" | "none";
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
  { label: string; kbd: string; Icon: React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: true }> }
> = {
  list: { label: "List", kbd: "⌥1", Icon: ListIcon },
  graph: { label: "Graph", kbd: "⌥2", Icon: Network },
  timeline: { label: "Timeline", kbd: "⌥3", Icon: Timer },
  coverage: { label: "Coverage", kbd: "⌥4", Icon: PieChart },
};

export interface DatasetDetailPageProps {
  snapshot: DatasetSnapshot;

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
  /** Persisted views to render in the left rail. */
  savedViews?: readonly DatasetSavedView[];
  /** Currently-applied view id (controlled). */
  activeViewId?: string | null;
  defaultActiveViewId?: string | null;
  onActiveViewChange?: (next: string | null) => void;
  /** Save current canvas state as a new view. */
  onCreateSavedView?: CreateSavedViewHandler;
  /** Delete a saved view. */
  onDeleteSavedView?: DeleteSavedViewHandler;

  /* ── Eval runs ──────────────────────────────────────────── */
  /** Recent eval runs scoped to this dataset, surfaced in the rail. */
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
  defaultDensity = "dense",
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
    lensProp ?? tab ?? defaultLens ?? defaultTab ?? "list",
  );
  const lens = lensProp ?? tab ?? lensState;
  const setLens = React.useCallback(
    (next: DatasetDetailLens) => {
      setLensState(next);
      onLensChange?.(next);
      onTabChange?.(next);
    },
    [onLensChange, onTabChange],
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
  const setDisplayProperties = (
    next: readonly DatasetDisplayProperty[],
  ) => {
    setDisplayPropertiesState(next);
    onDisplayPropertiesChange?.(next);
  };
  const toggleDisplayProperty = (key: DatasetDisplayProperty) => {
    const set = new Set(displayProperties);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    setDisplayProperties(
      DATASET_DISPLAY_PROPERTIES.filter((k) => set.has(k)),
    );
  };

  const [densityState, setDensityState] =
    React.useState<DatasetDensity>(defaultDensity);
  const density = densityProp ?? densityState;
  const setDensity = (next: DatasetDensity) => {
    setDensityState(next);
    onDensityChange?.(next);
  };

  /* ── Filter rail wiring ──────────────────────────────── */
  const filterColumns = React.useMemo(
    () => filterColumnsProp ?? defaultDatasetTraceColumns(snapshot),
    [filterColumnsProp, snapshot],
  );
  /* Local filter state — used when the consumer is uncontrolled.
     The filter store reads from the controlled prop when present;
     otherwise from this local state. Splitting state out (instead
     of letting `useDataTableFilters` own it internally) lets the
     "Apply saved view" path replace the entire filter list with
     one call. */
  const [internalFilters, setInternalFilters] = React.useState<FilterState[]>(
    [],
  );
  const filtersResolved = filtersProp ?? internalFilters;
  const setFilters = React.useCallback(
    (
      next:
        | readonly FilterState[]
        | ((prev: readonly FilterState[]) => readonly FilterState[]),
    ) => {
      const resolved =
        typeof next === "function"
          ? next(filtersResolved)
          : next;
      const arr = [...resolved];
      if (filtersProp === undefined) {
        setInternalFilters(arr);
      }
      onFiltersChange?.(arr);
    },
    [filtersResolved, filtersProp, onFiltersChange],
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
  }, [snapshot.traces, filterStore.filters.length, filterStore.predicate, search, ordering]);

  /* ── Multi-select state ──────────────────────────────── */

  const [selectedIdsState, setSelectedIdsState] = React.useState<
    readonly string[]
  >(defaultSelectedTraceIds ?? []);
  const selectedIds = selectedTraceIdsProp ?? selectedIdsState;
  const setSelectedIds = React.useCallback(
    (next: readonly string[] | ((prev: readonly string[]) => readonly string[])) => {
      setSelectedIdsState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        onSelectedTraceIdsChange?.(resolved);
        return resolved;
      });
    },
    [onSelectedTraceIdsChange],
  );

  const selectedIdSet = React.useMemo(
    () => new Set(selectedIds),
    [selectedIds],
  );

  /* Anchor for shift-range selection. Defaults to the most-recently
     toggled trace; falls back to the inspector selection. */
  const anchorRef = React.useRef<string | null>(selectedTraceId ?? null);

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
      status: (() => {
        const vals = new Set<TraceStatus>();
        for (const t of traces) {
          vals.add(t.status);
          if (vals.size > 1) break;
        }
        return vals.size > 1 ? ("mixed" as const) : (Array.from(vals)[0] as TraceStatus);
      })(),
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
    [selectedIds, selectedIdSet],
  );

  const updateClusterFor = React.useCallback(
    (traceId: string, next: string | null) => {
      onUpdateTraces?.({
        datasetId: snapshot.dataset.id,
        traceIds: resolveMutationTargets(traceId),
        patch: { clusterId: next },
      });
    },
    [onUpdateTraces, resolveMutationTargets, snapshot.dataset.id],
  );
  const updateSplitFor = React.useCallback(
    (traceId: string, next: DatasetSplit | null) => {
      onUpdateTraces?.({
        datasetId: snapshot.dataset.id,
        traceIds: resolveMutationTargets(traceId),
        patch: { split: next },
      });
    },
    [onUpdateTraces, resolveMutationTargets, snapshot.dataset.id],
  );
  const updateStatusFor = React.useCallback(
    (traceId: string, next: TraceStatus) => {
      onUpdateTraces?.({
        datasetId: snapshot.dataset.id,
        traceIds: resolveMutationTargets(traceId),
        patch: { status: next },
      });
    },
    [onUpdateTraces, resolveMutationTargets, snapshot.dataset.id],
  );

  /* ── Multi-select interaction handlers ───────────────── */

  /** Resolve the visible (filtered+grouped) row order — used to
   *  resolve a shift-click range. Computed against `filteredTraces`
   *  but in the *grouped* order so a shift-click inside a cluster
   *  bucket only spans the visible window. The List lens flattens
   *  groups in the same order it renders them. */
  const visibleRowOrder = React.useMemo(
    () => filteredTraces.map((t) => t.traceId),
    [filteredTraces],
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
    [onSelectTrace, setSelectedIds, visibleRowOrder],
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
    [setSelectedIds],
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
    [setSelectedIds, visibleRowOrder],
  );

  const visibleSelectedCount = React.useMemo(
    () => visibleRowOrder.reduce((acc, id) => (selectedIdSet.has(id) ? acc + 1 : acc), 0),
    [visibleRowOrder, selectedIdSet],
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
      `[data-trace-id="${cssEscape(focusedTraceId)}"]`,
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
              Math.min(visibleRowOrder.length - 1, currentIndex + delta),
            );
      setFocusedTraceId(visibleRowOrder[nextIndex] ?? null);
    },
    [focusedTraceId, visibleRowOrder],
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
    ],
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
    [onActiveViewChange],
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
      density,
      showEmptyGroups,
      displayProperties,
      search,
      filtersResolved,
    ],
  );

  /* Compare current state to the active view's captured state.
     Cheap-deep-equal on the JSON form keeps things simple — saved
     views are small (under ~10 chips) so the cost is negligible. */
  const isViewDirty = React.useMemo(() => {
    if (!activeView) return false;
    const current = captureCurrentViewState();
    return (
      JSON.stringify(current) !== JSON.stringify(activeView.state)
    );
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
        setDisplayProperties(
          s.displayProperties as DatasetDisplayProperty[],
        );
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
      setSearch,
      setFilters,
      setActiveViewId,
      clearSelection,
    ],
  );

  const saveCurrentView = React.useCallback(async () => {
    if (!onCreateSavedView) return;
    const defaultName = activeView
      ? `${activeView.name} copy`
      : `View ${(savedViews?.length ?? 0) + 1}`;
    const name =
      typeof window !== "undefined" && typeof window.prompt === "function"
        ? window.prompt("Name this view", defaultName)
        : defaultName;
    if (!name) return;
    const created = await onCreateSavedView({
      datasetId: snapshot.dataset.id,
      name,
      scope: "personal",
      state: captureCurrentViewState(),
    });
    setActiveViewId(created.id);
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
    [onDeleteSavedView, snapshot.dataset.id, activeViewId, setActiveViewId],
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
    [onActiveEvalRunChange],
  );
  const activeEvalRun = React.useMemo(
    () => evalRuns?.find((r) => r.id === activeEvalRunId) ?? null,
    [evalRuns, activeEvalRunId],
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
            : bucket.kind === "split"
              ? "split"
              : "status";
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
    [filterStore.actions, setLens],
  );

  /* ── Header ─────────────────────────────────────────── */

  return (
    <div
      className={cx(
        "flex h-full min-h-0 flex-1 flex-col overflow-hidden",
        className,
      )}
    >
      <DetailHeader
        dataset={snapshot.dataset}
        onUpdate={onUpdateDataset}
        onEdit={onEditDataset}
        onDelete={onDeleteDataset}
        onDuplicate={onDuplicateDataset}
      />

      <DatasetMetricsStrip
        snapshot={snapshot}
        className="flex-shrink-0 border-b border-l-border-faint px-4 pb-3 pt-3"
      />

      <div className="flex flex-1 min-h-0 flex-row">
      {/* ── Left rail (saved views + eval runs). Renders only when
         the consumer wires either set so empty datasets don't grow
         a perpetual empty rail. */}
      {(savedViews && savedViews.length > 0) || onCreateSavedView || (evalRuns && evalRuns.length > 0) ? (
        <DatasetCanvasRail
          savedViews={savedViews ?? []}
          activeViewId={activeViewId}
          onApplyView={applyView}
          isViewDirty={isViewDirty}
          onSaveCurrentView={onCreateSavedView ? saveCurrentView : undefined}
          onDeleteView={onDeleteSavedView ? deleteView : undefined}
          evalRuns={evalRuns}
          activeEvalRunId={activeEvalRunId}
          onSelectEvalRun={setActiveEvalRunId}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
      <DatasetCanvasToolbar
        lens={lens}
        onLensChange={setLens}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        ordering={ordering}
        onOrderingChange={setOrdering}
        showEmptyGroups={showEmptyGroups}
        onShowEmptyGroupsChange={setShowEmptyGroups}
        displayProperties={displayProperties}
        onToggleDisplayProperty={toggleDisplayProperty}
        onResetDisplay={() => {
          setGroupBy(defaultGroupBy);
          setOrdering(defaultOrdering);
          setShowEmptyGroups(defaultShowEmptyGroups);
          setDisplayProperties(defaultDisplayProperties);
          setDensity(defaultDensity);
        }}
        density={density}
        onDensityChange={setDensity}
        filterColumns={filterColumns}
        filterState={filterStore.filters}
        filterActions={filterStore.actions}
        search={search}
        onSearchChange={setSearch}
        searchInputRef={searchInputRef}
        onOpenShortcuts={() => setSheetOpen(true)}
        totalCount={snapshot.traces.length}
        filteredCount={filteredTraces.length}
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
        onBulkUpdateStatus={(next) => {
          if (!onUpdateTraces || selectedIds.length === 0) return;
          onUpdateTraces({
            datasetId: snapshot.dataset.id,
            traceIds: selectedIds,
            patch: { status: next },
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

      <div ref={contentRef} className="flex flex-1 min-h-0 flex-col">
        {snapshot.traces.length === 0 ? (
          <div className="flex flex-1 min-h-0 items-center justify-center p-4">
            <DatasetEmpty variant="detail" />
          </div>
        ) : (
          <DatasetCanvasContent
            snapshot={snapshot}
            lens={lens}
            groupBy={groupBy}
            density={density}
            showEmptyGroups={showEmptyGroups}
            displayProperties={displayProperties}
            filteredTraces={filteredTraces}
            selectedTraceId={selectedTraceId ?? null}
            onSelectTrace={onSelectTrace}
            selectedIdSet={selectedIdSet}
            focusedTraceId={focusedTraceId}
            failingTraceIdSet={failingTraceIdSet}
            onRowClick={handleRowClick}
            onCheckboxChange={handleCheckboxChange}
            selectAllState={selectAllState}
            onSelectAllVisible={handleSelectAllVisible}
            canEdit={!!onUpdateTraces}
            onUpdateCluster={updateClusterFor}
            onUpdateSplit={updateSplitFor}
            onUpdateStatus={updateStatusFor}
            datasetsForAdd={datasetsForAdd}
            onAddTraceToDataset={onAddTraceToDataset}
            getDatasetMembershipsForTrace={getDatasetMembershipsForTrace}
            renderGraph={renderGraph}
            renderTimeline={renderTimeline}
            onCoverageBucketSelect={applyCoverageBucket}
          />
        )}
      </div>
      </div>
      </div>

      <DatasetShortcutSheet open={sheetOpen} onOpenChange={setSheetOpen} />
      <DatasetCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onShortcut={(id) => {
          const handler = (keyboardHandlers as Record<string, undefined | (() => void)>)[id];
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

/** Returns a new array sorted by the given ordering. Falls back to
 *  the input order on tie so groups stay stable. */
function sortTraces(
  traces: readonly TraceSummary[],
  ordering: DatasetOrdering,
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
  onUpdate?: UpdateDatasetHandler;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

function DetailHeader({
  dataset,
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
    <header className="flex flex-shrink-0 items-start gap-3 border-b border-l-border-faint px-4 py-3">
      <span
        className={cx(
          "flex size-9 shrink-0 items-center justify-center rounded-[3px]",
          meta?.tile ?? "bg-l-surface-input",
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
          <button
            type="button"
            onClick={() => onUpdate && setEditing(true)}
            className={cx(
              "group inline-flex items-center gap-1.5 self-start rounded-[2px] text-left",
              "font-sans text-[18px] font-medium leading-tight text-l-ink",
              onUpdate
                ? "hover:bg-l-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40"
                : "cursor-text",
            )}
            disabled={!onUpdate}
          >
            <span className="px-1">{dataset.name}</span>
            {onUpdate ? (
              <Pencil
                className="size-3 text-l-ink-dim opacity-0 transition-opacity group-hover:opacity-100"
                strokeWidth={1.75}
              />
            ) : null}
          </button>
        )}
        <div className="flex items-center gap-2 font-mono text-[11px] text-l-ink-dim">
          <span
            aria-hidden
            className={cx("size-1.5 rounded-pill", meta?.dot ?? "bg-l-ink-dim")}
          />
          <span>{meta?.label ?? "Dataset"}</span>
          {dataset.createdBy ? (
            <>
              <span aria-hidden>·</span>
              <span>{dataset.createdBy}</span>
            </>
          ) : null}
          <span aria-hidden>·</span>
          <span>{dataset.id}</span>
        </div>
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
  status: TraceStatus | "mixed";
}

interface DatasetCanvasToolbarProps {
  lens: DatasetDetailLens;
  onLensChange: (next: DatasetDetailLens) => void;
  groupBy: DatasetGroupBy;
  onGroupByChange: (next: DatasetGroupBy) => void;
  ordering: DatasetOrdering;
  onOrderingChange: (next: DatasetOrdering) => void;
  showEmptyGroups: boolean;
  onShowEmptyGroupsChange: (next: boolean) => void;
  displayProperties: readonly DatasetDisplayProperty[];
  onToggleDisplayProperty: (key: DatasetDisplayProperty) => void;
  onResetDisplay: () => void;
  density: DatasetDensity;
  onDensityChange: (next: DatasetDensity) => void;
  filterColumns: ColumnConfig<TraceSummary>[];
  filterState: readonly FilterState[];
  filterActions: ReturnType<typeof useDataTableFilters<TraceSummary>>["actions"];
  search: string;
  onSearchChange: (next: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onOpenShortcuts: () => void;
  totalCount: number;
  filteredCount: number;
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
  onBulkUpdateStatus: (next: TraceStatus) => void;
  onBulkRemove: () => Promise<void> | void;
}

function DatasetCanvasToolbar({
  lens,
  onLensChange,
  groupBy,
  onGroupByChange,
  ordering,
  onOrderingChange,
  showEmptyGroups,
  onShowEmptyGroupsChange,
  displayProperties,
  onToggleDisplayProperty,
  onResetDisplay,
  density: _density,
  onDensityChange: _onDensityChange,
  filterColumns,
  filterState,
  filterActions,
  search,
  onSearchChange,
  searchInputRef,
  onOpenShortcuts,
  totalCount,
  filteredCount,
  selectionCount,
  selectionAggregate,
  clusters,
  canEdit,
  canRemove,
  onClearSelection,
  onBulkUpdateCluster,
  onBulkUpdateSplit,
  onBulkUpdateStatus,
  onBulkRemove,
}: DatasetCanvasToolbarProps) {
  const isFiltered = filteredCount !== totalCount;
  const inBatchMode = selectionCount > 0;

  return (
    <div
      className="flex flex-shrink-0 flex-col gap-2 border-b border-l-border-faint bg-l-surface-bar/40 px-4 py-2"
      role="toolbar"
      aria-label="Dataset canvas controls"
    >
      <div className="flex flex-wrap items-center gap-2">
        {/* Lens picker — visible always, kbd-driven later (P3). */}
        <div
          role="tablist"
          aria-label="Lens"
          className="inline-flex items-center gap-1 rounded-[3px] border border-hairline-strong bg-l-surface-raised p-0.5"
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

        <Input
          ref={searchInputRef}
          search
          placeholder="Search · / to focus"
          value={search}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
          className="w-[260px] max-w-full"
        />

        <DisplayPopover
          groupBy={groupBy}
          onGroupByChange={onGroupByChange}
          ordering={ordering}
          onOrderingChange={onOrderingChange}
          showEmptyGroups={showEmptyGroups}
          onShowEmptyGroupsChange={onShowEmptyGroupsChange}
          displayProperties={displayProperties}
          onToggleDisplayProperty={onToggleDisplayProperty}
          onResetToDefault={onResetDisplay}
        />

        <Button
          variant="ghost"
          size="sm"
          onPress={onOpenShortcuts}
          aria-label="Show keyboard shortcuts"
          title="Keyboard shortcuts (?)"
        >
          <span className="font-mono text-[12px]">?</span>
        </Button>

        {/* Trailing slot — morphs in place between count + batch
           actions. Both branches share the same min-height so the
           toolbar never shifts vertically when selection changes. */}
        <div className="ml-auto flex min-h-7 flex-wrap items-center gap-2">
          {inBatchMode && selectionAggregate ? (
            <BatchActionsStrip
              count={selectionAggregate.count}
              clusterValue={selectionAggregate.cluster}
              splitValue={selectionAggregate.split}
              statusValue={selectionAggregate.status}
              clusters={clusters}
              canEdit={canEdit}
              canRemove={canRemove}
              onClear={onClearSelection}
              onUpdateCluster={onBulkUpdateCluster}
              onUpdateSplit={onBulkUpdateSplit}
              onUpdateStatus={onBulkUpdateStatus}
              onRemove={onBulkRemove}
            />
          ) : (
            <span
              className="font-mono text-[10.5px] tabular-nums text-l-ink-dim"
              aria-live="polite"
            >
              {isFiltered ? (
                <>
                  {formatNumber(filteredCount)}{" "}
                  <span className="text-l-ink-dim/70">
                    / {formatNumber(totalCount)}
                  </span>{" "}
                  traces
                </>
              ) : (
                <>{formatNumber(totalCount)} traces</>
              )}
            </span>
          )}
        </div>
      </div>

      <DatasetFilterRail
        columns={filterColumns}
        filters={filterState}
        actions={filterActions}
      />
    </div>
  );
}

/* ── Batch-actions strip ─────────────────────────────────── */

interface BatchActionsStripProps {
  count: number;
  clusterValue: string | null | "mixed";
  splitValue: DatasetSplit | null | "mixed";
  statusValue: TraceStatus | "mixed";
  clusters: readonly DatasetCluster[];
  canEdit: boolean;
  canRemove: boolean;
  onClear: () => void;
  onUpdateCluster: (next: string | null) => void;
  onUpdateSplit: (next: DatasetSplit | null) => void;
  onUpdateStatus: (next: TraceStatus) => void;
  onRemove: () => Promise<void> | void;
}

function BatchActionsStrip({
  count,
  clusterValue,
  splitValue,
  statusValue,
  clusters,
  canEdit,
  canRemove,
  onClear,
  onUpdateCluster,
  onUpdateSplit,
  onUpdateStatus,
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
          <StatusPicker
            value={statusValue}
            onChange={onUpdateStatus}
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

interface LensButtonProps {
  label: string;
  kbd: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: true }>;
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
          : "text-l-ink-lo hover:bg-l-surface-hover hover:text-l-ink",
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
  { value: "status", label: "Status" },
  { value: "none", label: "None" },
];

const ORDERING_OPTIONS: Array<{ value: DatasetOrdering; label: string }> = [
  { value: "addedAtDesc", label: "Added (newest)" },
  { value: "addedAtAsc", label: "Added (oldest)" },
  { value: "startedAtDesc", label: "Started (newest)" },
  { value: "startedAtAsc", label: "Started (oldest)" },
  { value: "durationDesc", label: "Duration (longest)" },
  { value: "eventCountDesc", label: "Events (most)" },
  { value: "labelAsc", label: "Label (A→Z)" },
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
  ordering: DatasetOrdering;
  onOrderingChange: (next: DatasetOrdering) => void;
  showEmptyGroups: boolean;
  onShowEmptyGroupsChange: (next: boolean) => void;
  displayProperties: readonly DatasetDisplayProperty[];
  onToggleDisplayProperty: (key: DatasetDisplayProperty) => void;
  /** Reset every dimension to the canvas's defaults. */
  onResetToDefault: () => void;
}

/**
 * Linear-style view dropdown — three logical sections (data shape,
 * view options, column visibility) divided by hairlines, with a
 * Reset footer. Matches the Linear Design System "View dropdown"
 * component (Figma node 86:2955) so the canvas reads as familiar
 * to anyone fluent in Linear.
 */
function DisplayPopover({
  groupBy,
  onGroupByChange,
  ordering,
  onOrderingChange,
  showEmptyGroups,
  onShowEmptyGroupsChange,
  displayProperties,
  onToggleDisplayProperty,
  onResetToDefault,
}: DisplayPopoverProps) {
  const groupByLabel =
    GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label ?? "—";
  const orderingLabel =
    ORDERING_OPTIONS.find((o) => o.value === ordering)?.label ?? "—";
  const displaySet = new Set(displayProperties);

  return (
    <Popover>
      <PopoverTrigger>
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={
            <SlidersHorizontal className="size-3.5" strokeWidth={1.6} />
          }
        >
          Display
        </Button>
      </PopoverTrigger>
      <PopoverContent
        placement="bottom end"
        className="w-[296px] overflow-hidden p-0"
      >
        {/* Section 1 — Grouping + Ordering */}
        <div className="flex flex-col gap-0.5 border-b border-hairline px-3 py-2">
          <DisplayDropdownRow
            label="Grouping"
            value={groupByLabel}
            options={GROUP_BY_OPTIONS}
            selected={groupBy}
            onSelect={(v) => onGroupByChange(v as DatasetGroupBy)}
          />
          <DisplayDropdownRow
            label="Ordering"
            value={orderingLabel}
            options={ORDERING_OPTIONS}
            selected={ordering}
            onSelect={(v) => onOrderingChange(v as DatasetOrdering)}
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

        {/* Section 3 — Display properties */}
        <div className="flex flex-col gap-1.5 border-b border-hairline px-3 py-2">
          <span className="font-sans text-[11px] text-l-ink-dim">
            Display properties
          </span>
          <div className="flex flex-wrap gap-1">
            {DATASET_DISPLAY_PROPERTIES.map((key) => {
              const active = displaySet.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onToggleDisplayProperty(key)}
                  className={cx(
                    "inline-flex h-6 items-center rounded-[3px] px-2",
                    "font-sans text-[11.5px] transition-colors duration-fast ease-out",
                    "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
                    "[@media(pointer:coarse)]:h-9",
                    active
                      ? "bg-l-surface-hover text-l-ink"
                      : "border border-l-border-faint text-l-ink-dim hover:border-hairline-strong hover:text-l-ink",
                  )}
                  aria-pressed={active}
                >
                  {DISPLAY_PROPERTY_LABELS[key]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 4 — Reset */}
        <div className="flex items-center justify-end gap-3 px-3 py-2">
          <button
            type="button"
            onClick={onResetToDefault}
            className={cx(
              "font-sans text-[11.5px] text-l-ink-dim",
              "hover:text-l-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
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
        <PopoverTrigger>
          <button
            type="button"
            className={cx(
              "inline-flex h-6 items-center justify-between gap-1 rounded-[3px] px-2",
              "min-w-[120px]",
              "bg-l-surface-input font-sans text-[12px] text-l-ink",
              "hover:bg-l-surface-hover transition-colors duration-fast ease-out",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
              "[@media(pointer:coarse)]:h-9",
            )}
          >
            <span className="truncate">{value}</span>
            <span aria-hidden className="ml-1 text-l-ink-dim">⌄</span>
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
                    opt.value === selected ? "bg-l-surface-selected" : null,
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
        disabled ? "opacity-60" : null,
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
          value ? "bg-ember" : "bg-l-wash-5",
        )}
      >
        <span
          aria-hidden
          className={cx(
            "block size-[10px] rounded-pill bg-white transition-transform duration-fast ease-out",
            "motion-reduce:transition-none",
            value ? "translate-x-[10px]" : "translate-x-0",
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
  groupBy: DatasetGroupBy;
  density: DatasetDensity;
  showEmptyGroups: boolean;
  displayProperties: readonly DatasetDisplayProperty[];
  filteredTraces: TraceSummary[];
  selectedTraceId: string | null;
  onSelectTrace?: (traceId: string | null) => void;
  /* Multi-select wiring for the List lens. */
  selectedIdSet: ReadonlySet<string>;
  focusedTraceId: string | null;
  /** Trace ids that the active eval run failed on; renders a small
   *  red marker on the row's status column. */
  failingTraceIdSet: ReadonlySet<string>;
  onRowClick: (traceId: string, event: React.MouseEvent | React.KeyboardEvent) => void;
  onCheckboxChange: (
    traceId: string,
    next: boolean,
    event: React.MouseEvent,
  ) => void;
  selectAllState: "none" | "indeterminate" | "all";
  onSelectAllVisible: (next: boolean) => void;
  /* Inline chip editing. */
  canEdit: boolean;
  onUpdateCluster: (traceId: string, next: string | null) => void;
  onUpdateSplit: (traceId: string, next: DatasetSplit | null) => void;
  onUpdateStatus: (traceId: string, next: TraceStatus) => void;
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
  groupBy,
  density,
  showEmptyGroups,
  displayProperties,
  filteredTraces,
  selectedTraceId,
  onSelectTrace,
  selectedIdSet,
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
        <ListLens
          snapshot={snapshot}
          traces={filteredTraces}
          groupBy={groupBy}
          density={density}
          showEmptyGroups={showEmptyGroups}
          displayProperties={displayProperties}
          selectedTraceId={selectedTraceId}
          onRowClick={onRowClick}
          selectedIdSet={selectedIdSet}
          focusedTraceId={focusedTraceId}
          failingTraceIdSet={failingTraceIdSet}
          onCheckboxChange={onCheckboxChange}
          selectAllState={selectAllState}
          onSelectAllVisible={onSelectAllVisible}
          canEdit={canEdit}
          onUpdateCluster={onUpdateCluster}
          onUpdateSplit={onUpdateSplit}
          onUpdateStatus={onUpdateStatus}
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

/* ── List lens ──────────────────────────────────────────── */

interface ListLensProps {
  snapshot: DatasetSnapshot;
  traces: TraceSummary[];
  groupBy: DatasetGroupBy;
  density: DatasetDensity;
  showEmptyGroups: boolean;
  displayProperties: readonly DatasetDisplayProperty[];
  selectedTraceId: string | null;
  onRowClick: (traceId: string, event: React.MouseEvent | React.KeyboardEvent) => void;
  selectedIdSet: ReadonlySet<string>;
  focusedTraceId: string | null;
  failingTraceIdSet: ReadonlySet<string>;
  onCheckboxChange: (
    traceId: string,
    next: boolean,
    event: React.MouseEvent,
  ) => void;
  selectAllState: "none" | "indeterminate" | "all";
  onSelectAllVisible: (next: boolean) => void;
  canEdit: boolean;
  onUpdateCluster: (traceId: string, next: string | null) => void;
  onUpdateSplit: (traceId: string, next: DatasetSplit | null) => void;
  onUpdateStatus: (traceId: string, next: TraceStatus) => void;
}

function ListLens({
  snapshot,
  traces,
  groupBy,
  density,
  showEmptyGroups,
  displayProperties,
  selectedTraceId,
  onRowClick,
  selectedIdSet,
  focusedTraceId,
  failingTraceIdSet,
  onCheckboxChange,
  selectAllState,
  onSelectAllVisible,
  canEdit,
  onUpdateCluster,
  onUpdateSplit,
  onUpdateStatus,
}: ListLensProps) {
  const clusterIndex = React.useMemo(
    () => buildClusterIndex(snapshot.clusters),
    [snapshot.clusters],
  );

  const grouped = React.useMemo(
    () => groupTracesBy(traces, groupBy, clusterIndex, snapshot, showEmptyGroups),
    [traces, groupBy, clusterIndex, snapshot, showEmptyGroups],
  );

  const visibleProps = React.useMemo<ReadonlySet<DatasetDisplayProperty>>(
    () => new Set(displayProperties),
    [displayProperties],
  );

  if (traces.length === 0 && !showEmptyGroups) {
    return (
      <FilteredEmpty totalCount={snapshot.traces.length} />
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-auto p-4">
      <div className="rounded-[4px] border border-hairline-strong bg-l-surface-raised">
        <ListHeader
          showCluster={groupBy !== "cluster" && visibleProps.has("cluster")}
          showEvents={visibleProps.has("events")}
          showDuration={visibleProps.has("duration")}
          showSplit={visibleProps.has("split")}
          selectAllState={selectAllState}
          onSelectAllVisible={onSelectAllVisible}
        />
        <div>
          {grouped.map((group) => (
            <React.Fragment key={group.key}>
              {groupBy !== "none" ? (
                <GroupHead label={group.label} count={group.traces.length} dot={group.dot} fill={group.fill} />
              ) : null}
              {group.traces.length === 0 ? (
                <EmptyGroupHint />
              ) : null}
              {group.traces.map((trace) => (
                <TraceSummaryRow
                  key={trace.traceId}
                  trace={trace}
                  cluster={
                    groupBy === "cluster" || !visibleProps.has("cluster")
                      ? null
                      : trace.clusterId
                        ? clusterIndex.get(trace.clusterId) ?? null
                        : null
                  }
                  density={density}
                  showCluster={visibleProps.has("cluster")}
                  showEvents={visibleProps.has("events")}
                  showDuration={visibleProps.has("duration")}
                  showSplit={visibleProps.has("split")}
                  showTraceId={visibleProps.has("traceId")}
                  isActive={trace.traceId === selectedTraceId}
                  isMultiSelected={selectedIdSet.has(trace.traceId)}
                  isFocused={trace.traceId === focusedTraceId}
                  isFailing={failingTraceIdSet.has(trace.traceId)}
                  onSelect={onRowClick}
                  selectable
                  onMultiSelectChange={onCheckboxChange}
                  editable={canEdit}
                  clusters={canEdit ? snapshot.clusters : undefined}
                  onUpdateCluster={canEdit ? onUpdateCluster : undefined}
                  onUpdateSplit={canEdit ? onUpdateSplit : undefined}
                  onUpdateStatus={canEdit ? onUpdateStatus : undefined}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyGroupHint() {
  return (
    <div className="px-3 py-2 font-mono text-[10.5px] text-l-ink-dim">
      No traces in this group.
    </div>
  );
}

interface TraceGroup {
  key: string;
  label: string;
  /** Solid token color for the dot (Tailwind class). */
  dot?: string;
  /** Optional inline fill (CSS variable for cluster colors). */
  fill?: string;
  traces: TraceSummary[];
}

function groupTracesBy(
  traces: readonly TraceSummary[],
  groupBy: DatasetGroupBy,
  clusterIndex: Map<string, DatasetCluster>,
  snapshot: DatasetSnapshot,
  showEmptyGroups: boolean,
): TraceGroup[] {
  if (groupBy === "none") {
    return [{ key: "all", label: "", traces: [...traces] }];
  }

  const buckets = new Map<string, TraceGroup>();
  const order: TraceGroup[] = [];

  const ensure = (key: string, init: () => Omit<TraceGroup, "traces">): TraceGroup => {
    let existing = buckets.get(key);
    if (existing) return existing;
    existing = { ...init(), traces: [] } as TraceGroup;
    buckets.set(key, existing);
    order.push(existing);
    return existing;
  };

  /* When showEmptyGroups is set, prime the group order with the
     full universe of buckets so empty ones still render headers.
     Order matches the populated case below to keep bucket positions
     stable as filters change. */
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
        dot: "bg-l-ink-dim",
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
        dot: "bg-l-ink-dim",
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

  for (const trace of traces) {
    if (groupBy === "cluster") {
      const id = trace.clusterId ?? "__none__";
      const cluster = trace.clusterId
        ? clusterIndex.get(trace.clusterId) ?? null
        : null;
      ensure(id, () => ({
        key: id,
        label: cluster?.label ?? "Unclustered",
        fill: cluster?.color,
        dot: cluster ? undefined : "bg-l-ink-dim",
      })).traces.push(trace);
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
                : "bg-l-ink-dim",
      })).traces.push(trace);
      continue;
    }

    if (groupBy === "source") {
      const id = trace.primarySource;
      ensure(id, () => ({
        key: id,
        label: id,
        dot: "bg-event-teal",
      })).traces.push(trace);
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
    })).traces.push(trace);
  }

  /* Drop empty groups when the toggle is off — the populated set
     was just appended to the primed groups. */
  if (!showEmptyGroups) {
    return order.filter((g) => g.traces.length > 0);
  }
  return order;
}

function ListHeader({
  showCluster,
  showEvents,
  showDuration,
  showSplit,
  selectAllState,
  onSelectAllVisible,
}: {
  showCluster: boolean;
  showEvents: boolean;
  showDuration: boolean;
  showSplit: boolean;
  selectAllState: "none" | "indeterminate" | "all";
  onSelectAllVisible: (next: boolean) => void;
}) {
  const checked: boolean | "indeterminate" =
    selectAllState === "all"
      ? true
      : selectAllState === "indeterminate"
        ? "indeterminate"
        : false;
  return (
    <div
      style={{
        gridTemplateColumns: traceRowGridTemplate(
          showCluster,
          showEvents,
          showDuration,
          showSplit,
        ),
      }}
      className={cx(
        "sticky top-0 z-[1] grid items-center gap-2 px-2 h-7",
        "border-b border-hairline-strong bg-l-surface-bar",
        "font-mono text-[10px] uppercase tracking-[0.06em] text-l-ink-dim",
      )}
    >
      <div className="flex items-center justify-center">
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
      </div>
      <span aria-hidden />
      <span>Trace</span>
      {showCluster ? <span>Cluster</span> : null}
      {showEvents ? <span className="text-right">Events</span> : null}
      {showDuration ? <span className="text-right">Dur</span> : null}
      {showSplit ? <span>Split / added</span> : null}
      <span aria-hidden />
    </div>
  );
}


function GroupHead({
  label,
  count,
  dot,
  fill,
}: {
  label: string;
  count: number;
  dot?: string;
  fill?: string;
}) {
  return (
    <div className="sticky top-7 z-[1] flex items-center gap-2 border-b border-t border-l-border-faint bg-l-surface-bar-2 px-3 h-7 font-sans text-[11px] text-l-ink-lo">
      <span
        aria-hidden
        className={cx("size-1.5 rounded-pill", dot)}
        style={fill ? { background: fill } : undefined}
      />
      <span className="font-medium text-l-ink">{label}</span>
      <span className="ml-auto font-mono text-[10px] tabular-nums text-l-ink-dim">
        {count} {count === 1 ? "trace" : "traces"}
      </span>
    </div>
  );
}

function FilteredEmpty({ totalCount }: { totalCount: number }) {
  return (
    <div className="flex flex-1 min-h-0 items-center justify-center p-4">
      <div className="rounded-[4px] border border-hairline-strong bg-l-surface-raised px-6 py-8 text-center">
        <p className="font-sans text-[12.5px] text-l-ink-lo">
          No traces match the active filters.
        </p>
        <p className="mt-1 font-mono text-[10.5px] text-l-ink-dim">
          {formatNumber(totalCount)}{" "}
          {totalCount === 1 ? "trace" : "traces"} in the dataset overall.
        </p>
      </div>
    </div>
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
  const events = snapshot.events ?? [];
  const datasets = datasetsForAdd ?? [snapshot.dataset];

  const [playback, setPlayback] = React.useState<StreamPlaybackState>("paused");
  const [groupBy, setGroupBy] =
    React.useState<StreamTimelineGroupBy>("trace");
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    if (!selectedTraceId) {
      setSelectedEventId(null);
      return;
    }
    const firstEvent = events.find((e) => e.traceId === selectedTraceId);
    setSelectedEventId(firstEvent?.id ?? null);
  }, [selectedTraceId, events]);

  const { initialCenterMs, initialHalfWidthMs } = React.useMemo(() => {
    if (events.length === 0) {
      return {
        initialCenterMs: Date.now(),
        initialHalfWidthMs: 30 * 60 * 1000,
      };
    }
    const ts = events
      .map((e) => new Date(e.occurredAt).getTime())
      .sort((a, b) => a - b);
    const median = ts[Math.floor(ts.length / 2)] ?? ts[0]!;
    const span = ts[ts.length - 1]! - ts[0]!;
    const halfWidth = Math.min(
      Math.max(span / 4, 5 * 60 * 1000),
      6 * 60 * 60 * 1000,
    );
    return { initialCenterMs: median, initialHalfWidthMs: halfWidth };
  }, [events]);

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
    <div className="flex h-full min-h-0 flex-1 flex-col bg-l-surface">
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
            <span className="truncate text-l-ink-lo">{snapshot.dataset.name}</span>
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

