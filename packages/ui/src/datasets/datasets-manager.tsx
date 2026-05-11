"use client";

import * as React from "react";
import {
  Box,
  ChevronDown,
  MoreHorizontal,
  Plus,
} from "lucide-react";

import { cx } from "../utils/cx";
import {
  Avatar,
  AvatarFallback,
  deriveInitials,
  type AvatarTone,
} from "../primitives/avatar";
import { Button } from "../primitives/button";
import { useSetSiteBreadcrumb } from "../layout/site-breadcrumb";

import { DatasetActionsMenu } from "./dataset-actions-menu";
import { DatasetCard } from "./dataset-card";
import { DatasetCreateDialog } from "./dataset-create-dialog";
import { DatasetDeleteConfirm } from "./dataset-delete-confirm";
import { DatasetDetailPage } from "./dataset-detail-page";
import { DatasetEditDialog } from "./dataset-edit-dialog";
import { DatasetEmpty } from "./dataset-empty";
import { DatasetTraceCompareDrawer } from "./dataset-trace-compare";
import { DatasetsStatsPanel } from "./datasets-stats-panel";
import {
  DatasetsToolbar,
  type DatasetsScope,
  type DatasetsView,
} from "./datasets-toolbar";
import { RAIL_HANDLE_CLASSNAME, useRailResize } from "./use-rail-resize";
import { datasetSnapshotsById, datasetsManagerSeed } from "./data";
import type { DatasetFormValues } from "./dataset-form";
import { DATASET_PURPOSE_META } from "./purpose-meta";
import type {
  AddTraceToDatasetHandler,
  DatasetMembershipsResolver,
} from "../stream-timeline/types";
import type {
  CreateDatasetHandler,
  CreateSavedViewHandler,
  CreateSavedViewPayload,
  Dataset,
  DatasetEvalRun,
  DatasetPurpose,
  DatasetSavedView,
  DatasetSnapshot,
  DeleteDatasetHandler,
  DeleteSavedViewHandler,
  RemoveTraceFromDatasetHandler,
  TraceSummary,
  UpdateDatasetHandler,
  UpdateSavedViewHandler,
  UpdateTracesHandler,
  UpdateTracesPayload,
} from "./types";

/*
 * DatasetsManager — page-level surface for browsing datasets, applying
 * filters, switching between list/grid, and drilling into a single
 * dataset's detail page.
 *
 * Mostly uncontrolled: state lives inside, but every mutation
 * (`onCreateDataset`, `onUpdateDataset`, `onDeleteDataset`,
 * `onRemoveTraceFromDataset`) is also surfaced so consumers can wire
 * a backend. When no handler is wired, mutations apply against the
 * internal `datasets` state so Storybook stories feel real.
 *
 * The detail page chassis lands in a later phase — this file pulls
 * it in via a deferred render slot
 * (`renderDetail`) that defaults to a thin placeholder. The Phase 5
 * (`detail-chassis`) work swaps the default in.
 */

export interface DatasetsManagerProps {
  /** Initial dataset list. Defaults to the seed for stories. */
  datasets?: readonly Dataset[];
  /** Snapshot data for the detail surface, keyed by dataset id. Used
   *  by the placeholder detail render and (later) the full detail
   *  page. */
  snapshotsById?: Readonly<Record<string, DatasetSnapshot>>;
  /** Initial view. Defaults to grid. */
  initialView?: DatasetsView;
  /** Optional workspace label rendered in the breadcrumb / title block. */
  workspace?: string;
  /** Hide the toolbar's primary "New dataset" CTA. */
  hideToolbarAdd?: boolean;
  /** Optional override for how the detail page is rendered. Defaults
   *  to `DatasetDetailPage` (Overview / Traces / Clusters tabs); the
   *  graph-view and timeline-tab phases compose richer renders. */
  renderDetail?: (
    snapshot: DatasetSnapshot,
    helpers: ManagerDetailHelpers
  ) => React.ReactNode;
  /** Render slot threaded into `DatasetDetailPage`'s Graph tab. */
  renderDetailGraph?: (snapshot: DatasetSnapshot) => React.ReactNode;
  /** Render slot threaded into `DatasetDetailPage`'s Timeline tab. */
  renderDetailTimeline?: (snapshot: DatasetSnapshot) => React.ReactNode;

  /* CRUD hooks — when omitted, mutations apply to internal state. */
  onCreateDataset?: CreateDatasetHandler;
  onUpdateDataset?: UpdateDatasetHandler;
  onDeleteDataset?: DeleteDatasetHandler;
  onRemoveTraceFromDataset?: RemoveTraceFromDatasetHandler;
  /** Inline + bulk trace mutation. Drives row chip pickers and the
   *  batch-actions strip on the dataset canvas. When omitted, the
   *  manager applies optimistic local-state mutations against the
   *  `snapshotsById` index so stories feel real. */
  onUpdateTraces?: UpdateTracesHandler;
  /** Add-trace-to-dataset hook used by the embedded Timeline tab. */
  onAddTraceToDataset?: AddTraceToDatasetHandler;
  /** Trace-membership resolver used by the embedded Timeline tab. */
  getDatasetMembershipsForTrace?: DatasetMembershipsResolver;
  /** Saved views keyed by dataset id. Drives the compact view chips. */
  savedViewsByDatasetId?: Readonly<Record<string, readonly DatasetSavedView[]>>;
  /** Persist a new saved view. When omitted, the manager keeps a
   *  per-session optimistic store so stories work end-to-end. */
  onCreateSavedView?: CreateSavedViewHandler;
  /** Update an existing saved view. Optimistic by default. */
  onUpdateSavedView?: UpdateSavedViewHandler;
  /** Delete a saved view. Optimistic by default. */
  onDeleteSavedView?: DeleteSavedViewHandler;
  /** Eval runs keyed by dataset id. Drives the compact eval-run chips. */
  evalRunsByDatasetId?: Readonly<Record<string, readonly DatasetEvalRun[]>>;
  /** Notification fired whenever the internal dataset list changes. */
  onChange?: (next: readonly Dataset[]) => void;
  className?: string;
}

/** Helpers passed into the `renderDetail` slot so a detail page can
 *  request mutations and navigation without re-implementing them. */
export interface ManagerDetailHelpers {
  goBack: () => void;
  edit: (id: string) => void;
  remove: (id: string) => void;
}

export function DatasetsManager({
  datasets: initialDatasets = datasetsManagerSeed,
  snapshotsById = datasetSnapshotsById,
  initialView = "list",
  workspace = "Chronicle",
  hideToolbarAdd,
  renderDetail,
  renderDetailGraph,
  renderDetailTimeline,
  onCreateDataset,
  onUpdateDataset,
  onDeleteDataset,
  onRemoveTraceFromDataset: _onRemoveTraceFromDataset,
  onUpdateTraces,
  onAddTraceToDataset,
  getDatasetMembershipsForTrace,
  savedViewsByDatasetId,
  onCreateSavedView,
  onUpdateSavedView,
  onDeleteSavedView,
  evalRunsByDatasetId,
  onChange,
  className,
}: DatasetsManagerProps) {
  const [list, setList] = React.useState<Dataset[]>(() => [...initialDatasets]);
  const [query, setQuery] = React.useState("");
  const [scope, setScope] = React.useState<DatasetsScope>("all");
  const [purposes, setPurposes] = React.useState<DatasetPurpose[]>([]);
  const [view, setView] = React.useState<DatasetsView>(initialView);
  const [showStats, setShowStats] = React.useState(false);
  const [panelOpen, setPanelOpen] = React.useState(true);
  const [railWidth, setRailWidth] = React.useState(320);
  const [collapsedGroups, setCollapsedGroups] = React.useState<
    readonly string[]
  >([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createInitialValues, setCreateInitialValues] = React.useState<
    Partial<DatasetFormValues> | undefined
  >(undefined);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [selectedTraceId, setSelectedTraceId] = React.useState<string | null>(
    null
  );

  /* Optimistic snapshot overlay. We don't mutate the consumer-passed
     `snapshotsById` directly; we layer per-dataset deltas on top so
     bulk + inline edits feel real in stories without a backend. */
  const [snapshotOverrides, setSnapshotOverrides] = React.useState<
    Record<string, DatasetSnapshot>
  >({});

  /* Saved views — overlay on top of consumer-provided index so
     create/delete works without a backend in stories. */
  const [savedViewsOverlay, setSavedViewsOverlay] = React.useState<
    Record<string, readonly DatasetSavedView[]>
  >({});

  /* Multi-selection — surfaced to the manager so we can swap the
     inspector drawer for the compare drawer when exactly two rows
     are selected. */
  const [selectedTraceIds, setSelectedTraceIds] = React.useState<
    readonly string[]
  >([]);

  const propagate = React.useCallback(
    (next: Dataset[]) => {
      setList(next);
      onChange?.(next);
    },
    [onChange]
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((dataset) => {
      if (scope === "active" && dataset.traceCount === 0) return false;
      if (scope === "empty" && dataset.traceCount > 0) return false;
      if (
        purposes.length > 0 &&
        !(dataset.purpose && purposes.includes(dataset.purpose))
      ) {
        return false;
      }
      if (!q) return true;
      const haystack = `${dataset.name} ${dataset.description ?? ""} ${
        dataset.tags?.join(" ") ?? ""
      } ${dataset.createdBy ?? ""} ${dataset.id}`;
      return haystack.toLowerCase().includes(q);
    });
  }, [list, query, purposes, scope]);

  const grouped = React.useMemo(
    () => groupDatasetsByPurpose(filtered),
    [filtered]
  );

  const summary = React.useMemo(() => getDatasetSummary(list), [list]);

  const togglePurpose = (purpose: DatasetPurpose) => {
    setPurposes((cur) =>
      cur.includes(purpose)
        ? cur.filter((p) => p !== purpose)
        : [...cur, purpose]
    );
  };

  const showEmpty = list.length === 0;
  const showFilteredEmpty = !showEmpty && filtered.length === 0;

  const selectedDataset = React.useMemo(
    () => (selectedId ? (list.find((d) => d.id === selectedId) ?? null) : null),
    [selectedId, list]
  );

  const selectedSnapshot = React.useMemo<DatasetSnapshot | null>(() => {
    if (!selectedDataset) return null;
    const fromOverlay = snapshotOverrides[selectedDataset.id];
    const fromIndex = fromOverlay ?? snapshotsById[selectedDataset.id];
    if (fromIndex) return { ...fromIndex, dataset: selectedDataset };
    // Fall back to a degenerate empty snapshot so the detail page can
    // still render without crashing.
    return {
      dataset: selectedDataset,
      traces: [],
      clusters: [],
      edges: [],
      events: [],
    };
  }, [selectedDataset, snapshotsById, snapshotOverrides]);

  /* Register the site-header breadcrumb. Detail surface deepens the
     trail with the active dataset's name. */
  const breadcrumbCrumbs = React.useMemo(
    () =>
      selectedDataset
        ? [{ label: "Datasets" }, { label: selectedDataset.name }]
        : [{ label: "Datasets" }],
    [selectedDataset]
  );
  useSetSiteBreadcrumb(breadcrumbCrumbs);

  /* Resolve the working snapshot for a given dataset id (overlay
     ∘ index). Used by the optimistic mutators below. */
  const resolveSnapshot = React.useCallback(
    (datasetId: string): DatasetSnapshot | null => {
      return snapshotOverrides[datasetId] ?? snapshotsById[datasetId] ?? null;
    },
    [snapshotOverrides, snapshotsById]
  );

  /* CRUD request helpers — open the matching dialog. */
  const requestCreate = React.useCallback(() => {
    setCreateInitialValues(undefined);
    setCreateOpen(true);
  }, []);

  const requestCreateForPurpose = React.useCallback(
    (purpose: DatasetPurpose) => {
      setCreateInitialValues({ purpose });
      setCreateOpen(true);
    },
    []
  );

  const toggleGroup = React.useCallback((key: string) => {
    setCollapsedGroups((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    );
  }, []);

  const requestEdit = React.useCallback((id: string) => {
    setEditId(id);
  }, []);

  const requestDelete = React.useCallback((id: string) => {
    setDeleteId(id);
  }, []);

  const requestDuplicate = React.useCallback(
    (id: string) => {
      const source = list.find((d) => d.id === id);
      if (!source) return;
      setCreateInitialValues({
        name: `${source.name} copy`,
        description: source.description ?? "",
        purpose: source.purpose ?? null,
        tagsInput: (source.tags ?? []).join(", "),
      });
      setCreateOpen(true);
    },
    [list]
  );

  const requestCopyId = React.useCallback((id: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(id).catch(() => undefined);
    }
  }, []);

  /* CRUD effect handlers — apply optimistic local-state mutations
   * when no consumer handler is supplied; otherwise delegate to the
   * supplied handler and let it return the canonical result. */
  const handleCreate = React.useCallback<CreateDatasetHandler>(
    async (payload) => {
      if (onCreateDataset) {
        const created = await onCreateDataset(payload);
        propagate([created, ...list]);
        return created;
      }
      const created: Dataset = {
        id: `ds_${Date.now().toString(36)}`,
        name: payload.name,
        description: payload.description,
        purpose: payload.purpose,
        tags: payload.tags ? [...payload.tags] : undefined,
        traceCount: 0,
        eventCount: 0,
        createdBy: "you",
        updatedAt: new Date().toISOString(),
      };
      propagate([created, ...list]);
      return created;
    },
    [list, onCreateDataset, propagate]
  );

  const handleUpdate = React.useCallback<UpdateDatasetHandler>(
    async ({ id, patch }) => {
      const apply = (current: Dataset): Dataset => ({
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      });
      if (onUpdateDataset) {
        const result = await onUpdateDataset({ id, patch });
        propagate(list.map((d) => (d.id === id ? result : d)));
        return result;
      }
      const target = list.find((d) => d.id === id);
      if (!target) {
        throw new Error(`Cannot update unknown dataset: ${id}`);
      }
      const next = apply(target);
      propagate(list.map((d) => (d.id === id ? next : d)));
      return next;
    },
    [list, onUpdateDataset, propagate]
  );

  /* Leaving a dataset (back/delete) also dismisses the trace
     inspector, so re-entering a dataset doesn't surface a stale
     trace selection from the previous one. */
  const exitDetail = React.useCallback(() => {
    setSelectedId(null);
    setSelectedTraceId(null);
    setSelectedTraceIds([]);
  }, []);

  /* ── Saved views — resolve overlay + handlers ─────────── */

  const resolveSavedViews = React.useCallback(
    (datasetId: string): readonly DatasetSavedView[] => {
      const fromOverlay = savedViewsOverlay[datasetId];
      const fromIndex = savedViewsByDatasetId?.[datasetId];
      return fromOverlay ?? fromIndex ?? [];
    },
    [savedViewsByDatasetId, savedViewsOverlay]
  );

  const handleCreateSavedView = React.useCallback<CreateSavedViewHandler>(
    async (payload: CreateSavedViewPayload) => {
      let created: DatasetSavedView;
      if (onCreateSavedView) {
        created = await onCreateSavedView(payload);
      } else {
        created = {
          id: `view_${Date.now().toString(36)}`,
          name: payload.name,
          scope: payload.scope,
          updatedAt: new Date().toISOString(),
          state: payload.state,
        };
      }
      setSavedViewsOverlay((prev) => {
        const current =
          prev[payload.datasetId] ??
          savedViewsByDatasetId?.[payload.datasetId] ??
          [];
        return {
          ...prev,
          [payload.datasetId]: [...current, created],
        };
      });
      return created;
    },
    [onCreateSavedView, savedViewsByDatasetId]
  );

  const handleDeleteSavedView = React.useCallback<DeleteSavedViewHandler>(
    async (payload) => {
      if (onDeleteSavedView) {
        await onDeleteSavedView(payload);
      }
      setSavedViewsOverlay((prev) => {
        const current =
          prev[payload.datasetId] ??
          savedViewsByDatasetId?.[payload.datasetId] ??
          [];
        return {
          ...prev,
          [payload.datasetId]: current.filter((v) => v.id !== payload.viewId),
        };
      });
    },
    [onDeleteSavedView, savedViewsByDatasetId]
  );

  const handleUpdateSavedView = React.useCallback<UpdateSavedViewHandler>(
    async (payload) => {
      const current = resolveSavedViews(payload.datasetId);
      const existing = current.find((view) => view.id === payload.viewId);
      if (!existing) {
        throw new Error(`Saved view ${payload.viewId} was not found`);
      }

      const updated = onUpdateSavedView
        ? await onUpdateSavedView(payload)
        : {
            ...existing,
            ...payload.patch,
            updatedAt: new Date().toISOString(),
          };

      setSavedViewsOverlay((prev) => {
        const latest =
          prev[payload.datasetId] ??
          savedViewsByDatasetId?.[payload.datasetId] ??
          [];
        return {
          ...prev,
          [payload.datasetId]: latest.map((view) =>
            view.id === payload.viewId ? updated : view
          ),
        };
      });

      return updated;
    },
    [onUpdateSavedView, resolveSavedViews, savedViewsByDatasetId]
  );

  /* ── Inline + bulk trace mutations ──────────────────────── */

  const applyTracePatch = React.useCallback(
    (
      datasetId: string,
      traceIds: readonly string[],
      patch: UpdateTracesPayload["patch"]
    ) => {
      const snapshot = resolveSnapshot(datasetId);
      if (!snapshot) return;
      const ids = new Set(traceIds);
      const nextTraces = snapshot.traces.map<TraceSummary>((t) => {
        if (!ids.has(t.traceId)) return t;
        const patched: TraceSummary = { ...t };
        if ("clusterId" in patch) {
          if (patch.clusterId === null) delete patched.clusterId;
          else if (patch.clusterId !== undefined)
            patched.clusterId = patch.clusterId;
        }
        if ("split" in patch) {
          if (patch.split === null) delete patched.split;
          else if (patch.split !== undefined) patched.split = patch.split;
        }
        if ("status" in patch && patch.status !== undefined) {
          patched.status = patch.status;
        }
        if ("note" in patch) {
          if (patch.note === null) delete patched.note;
          else if (patch.note !== undefined) patched.note = patch.note;
        }
        return patched;
      });
      setSnapshotOverrides((prev) => ({
        ...prev,
        [datasetId]: { ...snapshot, traces: nextTraces },
      }));
    },
    [resolveSnapshot]
  );

  const handleUpdateTraces = React.useCallback<UpdateTracesHandler>(
    async (payload) => {
      if (onUpdateTraces) {
        await onUpdateTraces(payload);
      }
      applyTracePatch(payload.datasetId, payload.traceIds, payload.patch);
    },
    [applyTracePatch, onUpdateTraces]
  );

  const handleRemoveTrace = React.useCallback<RemoveTraceFromDatasetHandler>(
    async (payload) => {
      if (_onRemoveTraceFromDataset) {
        await _onRemoveTraceFromDataset(payload);
      }
      const snapshot = resolveSnapshot(payload.datasetId);
      if (!snapshot) return;
      const nextTraces = snapshot.traces.filter(
        (t) => t.traceId !== payload.traceId
      );
      setSnapshotOverrides((prev) => ({
        ...prev,
        [payload.datasetId]: { ...snapshot, traces: nextTraces },
      }));
      if (selectedTraceId === payload.traceId) setSelectedTraceId(null);
    },
    [_onRemoveTraceFromDataset, resolveSnapshot, selectedTraceId]
  );

  const handleDelete = React.useCallback<DeleteDatasetHandler>(
    async (payload) => {
      if (onDeleteDataset) {
        await onDeleteDataset(payload);
      }
      propagate(list.filter((d) => d.id !== payload.id));
      if (selectedId === payload.id) exitDetail();
    },
    [list, onDeleteDataset, propagate, selectedId, exitDetail]
  );

  const helpers: ManagerDetailHelpers = React.useMemo(
    () => ({
      goBack: exitDetail,
      edit: requestEdit,
      remove: requestDelete,
    }),
    [exitDetail, requestEdit, requestDelete]
  );

  const editDataset = editId
    ? (list.find((d) => d.id === editId) ?? null)
    : null;
  const deleteDataset = deleteId
    ? (list.find((d) => d.id === deleteId) ?? null)
    : null;

  return (
    <div
      className={cx(
        "flex h-full min-h-0 flex-col bg-l-surface text-l-ink",
        selectedSnapshot
          ? "gap-0 p-0"
          : "min-h-[calc(100svh-var(--header-height,3.5rem)-2rem)] gap-4 p-4",
        className
      )}
    >
      {selectedSnapshot ? (
        <>
          {/* The dataset canvas owns its right rail. The manager only
              docks the compare drawer, which is intentionally wider
              than the single-trace inspector. */}
          <div className="flex flex-1 min-h-0 flex-row overflow-hidden bg-l-surface-raised">
            <div className="flex min-w-0 flex-1 flex-col">
              {renderDetail ? (
                renderDetail(selectedSnapshot, helpers)
              ) : (
                <DatasetDetailPage
                  snapshot={selectedSnapshot}
                  workspaceLabel={workspace}
                  sectionLabel="Datasets"
                  onBack={exitDetail}
                  selectedTraceId={selectedTraceId}
                  onSelectTrace={setSelectedTraceId}
                  selectedTraceIds={selectedTraceIds}
                  onSelectedTraceIdsChange={setSelectedTraceIds}
                  onUpdateDataset={handleUpdate}
                  onEditDataset={requestEdit}
                  onDeleteDataset={requestDelete}
                  onDuplicateDataset={requestDuplicate}
                  onUpdateTraces={handleUpdateTraces}
                  onRemoveTraces={handleRemoveTrace}
                  savedViews={resolveSavedViews(selectedSnapshot.dataset.id)}
                  onCreateSavedView={handleCreateSavedView}
                  onUpdateSavedView={handleUpdateSavedView}
                  onDeleteSavedView={handleDeleteSavedView}
                  evalRuns={evalRunsByDatasetId?.[selectedSnapshot.dataset.id]}
                  datasetsForAdd={list}
                  onAddTraceToDataset={onAddTraceToDataset}
                  getDatasetMembershipsForTrace={getDatasetMembershipsForTrace}
                  renderGraph={renderDetailGraph}
                  renderTimeline={renderDetailTimeline}
                />
              )}
            </div>

            {selectedTraceIds.length === 2 ? (
              <DatasetTraceCompareDrawer
                isOpen
                onClose={() => setSelectedTraceIds([])}
                left={
                  selectedSnapshot.traces.find(
                    (t) => t.traceId === selectedTraceIds[0]
                  ) ?? null
                }
                right={
                  selectedSnapshot.traces.find(
                    (t) => t.traceId === selectedTraceIds[1]
                  ) ?? null
                }
                clusters={selectedSnapshot.clusters}
                onSwap={() =>
                  setSelectedTraceIds([
                    selectedTraceIds[1]!,
                    selectedTraceIds[0]!,
                  ])
                }
              />
            ) : null}
          </div>
        </>
      ) : (
        <>
          <ListHeader
            count={list.length}
            summary={summary}
            onCreate={requestCreate}
          />

          {showEmpty ? (
            <DatasetEmpty variant="empty" onCreate={requestCreate} />
          ) : (
            <>
              <DatasetsToolbar
                query={query}
                onQueryChange={setQuery}
                selectedScope={scope}
                onScopeChange={setScope}
                view={view}
                onViewChange={setView}
                selectedPurposes={purposes}
                onPurposeToggle={togglePurpose}
                totalCount={list.length}
                hideAdd={hideToolbarAdd ?? true}
                onCreate={requestCreate}
                analyticsActive={showStats && panelOpen}
                onAnalyticsToggle={() => {
                  /* Opening analytics also opens the panel; toggling
                     analytics off while the panel is open just flips
                     back to the facet view. */
                  setShowStats((prev) => {
                    if (!panelOpen) {
                      setPanelOpen(true);
                      return true;
                    }
                    return !prev;
                  });
                }}
                panelOpen={panelOpen}
                onPanelToggle={() => setPanelOpen((prev) => !prev)}
              />

              {showFilteredEmpty ? (
                <DatasetEmpty
                  variant="filtered"
                  onClearFilters={() => {
                    setPurposes([]);
                    setQuery("");
                  }}
                />
              ) : view === "list" ? (
                <div className="flex min-h-0 flex-1 overflow-hidden">
                  <GroupedDatasetsList
                    groups={grouped}
                    collapsedGroups={collapsedGroups}
                    onToggleGroup={toggleGroup}
                    onCreateInPurpose={requestCreateForPurpose}
                    onOpen={(id) => setSelectedId(id)}
                    renderActions={(dataset) => (
                      <DatasetActionsMenu
                        dataset={dataset}
                        onOpen={(id) => setSelectedId(id)}
                        onEdit={requestEdit}
                        onDuplicate={requestDuplicate}
                        onCopyId={requestCopyId}
                        onDelete={requestDelete}
                      />
                    )}
                  />
                  {panelOpen ? (
                    showStats ? (
                      <DatasetsStatsPanel
                        datasets={filtered}
                        onClose={() => setPanelOpen(false)}
                        onOpenDataset={(id) => setSelectedId(id)}
                        width={railWidth}
                        onWidthChange={setRailWidth}
                      />
                    ) : (
                      <DatasetFacetRail
                        datasets={list}
                        selectedPurposes={purposes}
                        onPurposeToggle={togglePurpose}
                        width={railWidth}
                        onWidthChange={setRailWidth}
                      />
                    )
                  ) : null}
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 overflow-hidden">
                  <div className="min-w-0 flex-1 overflow-auto">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {filtered.map((dataset) => (
                        <DatasetCard
                          key={dataset.id}
                          dataset={dataset}
                          onOpen={(id) => setSelectedId(id)}
                          actionsSlot={
                            <DatasetActionsMenu
                              dataset={dataset}
                              onOpen={(id) => setSelectedId(id)}
                              onEdit={requestEdit}
                              onDuplicate={requestDuplicate}
                              onCopyId={requestCopyId}
                              onDelete={requestDelete}
                            />
                          }
                        />
                      ))}
                    </div>
                  </div>
                  {panelOpen ? (
                    showStats ? (
                      <DatasetsStatsPanel
                        datasets={filtered}
                        onClose={() => setPanelOpen(false)}
                        onOpenDataset={(id) => setSelectedId(id)}
                        width={railWidth}
                        onWidthChange={setRailWidth}
                      />
                    ) : (
                      <DatasetFacetRail
                        datasets={list}
                        selectedPurposes={purposes}
                        onPurposeToggle={togglePurpose}
                        width={railWidth}
                        onWidthChange={setRailWidth}
                      />
                    )
                  ) : null}
                </div>
              )}
            </>
          )}
        </>
      )}

      <DatasetCreateDialog
        isOpen={createOpen}
        onOpenChange={setCreateOpen}
        initialValues={createInitialValues}
        onCreate={handleCreate}
      />
      <DatasetEditDialog
        dataset={editDataset}
        isOpen={editId != null}
        onOpenChange={(open) => {
          if (!open) setEditId(null);
        }}
        onUpdate={handleUpdate}
      />
      <DatasetDeleteConfirm
        dataset={deleteDataset}
        isOpen={deleteId != null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        onDelete={handleDelete}
      />
    </div>
  );
}

/* ── Linear-style manager list ───────────────────────────── */

const PURPOSE_ORDER: readonly DatasetPurpose[] = [
  "eval",
  "training",
  "replay",
  "review",
];

interface DatasetSummary {
  activeCount: number;
  traceCount: number;
  eventCount: number;
}

interface DatasetGroup {
  key: string;
  label: string;
  purpose: DatasetPurpose;
  datasets: readonly Dataset[];
}

function groupDatasetsByPurpose(
  datasets: readonly Dataset[]
): readonly DatasetGroup[] {
  const buckets = new Map<DatasetPurpose, Dataset[]>();
  for (const purpose of PURPOSE_ORDER) {
    buckets.set(purpose, []);
  }
  for (const dataset of datasets) {
    const purpose = dataset.purpose ?? "review";
    const bucket = buckets.get(purpose);
    if (bucket) bucket.push(dataset);
  }

  return PURPOSE_ORDER.map((purpose) => ({
    key: purpose,
    label: DATASET_PURPOSE_META[purpose].label,
    purpose,
    datasets: buckets.get(purpose) ?? [],
  })).filter((group) => group.datasets.length > 0);
}

function getDatasetSummary(datasets: readonly Dataset[]): DatasetSummary {
  return datasets.reduce<DatasetSummary>(
    (acc, dataset) => ({
      activeCount: acc.activeCount + (dataset.traceCount > 0 ? 1 : 0),
      traceCount: acc.traceCount + dataset.traceCount,
      eventCount: acc.eventCount + (dataset.eventCount ?? 0),
    }),
    { activeCount: 0, traceCount: 0, eventCount: 0 }
  );
}

interface GroupedDatasetsListProps {
  groups: readonly DatasetGroup[];
  collapsedGroups: readonly string[];
  onToggleGroup: (key: string) => void;
  onCreateInPurpose: (purpose: DatasetPurpose) => void;
  onOpen: (id: string) => void;
  renderActions: (dataset: Dataset) => React.ReactNode;
}

function GroupedDatasetsList({
  groups,
  collapsedGroups,
  onToggleGroup,
  onCreateInPurpose,
  onOpen,
  renderActions,
}: GroupedDatasetsListProps) {
  const collapsed = React.useMemo(
    () => new Set(collapsedGroups),
    [collapsedGroups]
  );

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden">
      <div className="chron-scrollbar-hidden flex h-full w-full flex-col gap-2 overflow-auto">
        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.key);
          const meta = DATASET_PURPOSE_META[group.purpose];
          const PurposeIcon = meta.Icon;
          return (
            <section key={group.key} className="flex flex-col">
              <div className="flex h-9 items-center gap-2 rounded-md border border-transparent bg-l-wash-1 px-3 text-[13px] text-l-ink">
                <button
                  type="button"
                  aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${group.label}`}
                  aria-expanded={!isCollapsed}
                  onClick={() => onToggleGroup(group.key)}
                  className="flex size-5 items-center justify-center rounded-md text-l-ink-dim transition-[background-color,color] duration-fast hover:bg-l-wash-3 hover:text-l-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40"
                >
                  <ChevronDown
                    className={cx(
                      "size-3.5 transition-transform duration-fast",
                      isCollapsed ? "-rotate-90" : null
                    )}
                    strokeWidth={1.75}
                  />
                </button>
                <PurposeIcon
                  aria-hidden
                  className={cx("size-3.5", meta.ink)}
                  strokeWidth={1.75}
                />
                <span className="font-medium">{group.label}</span>
                <span className="font-mono text-[11px] tabular-nums text-l-ink-dim">
                  {group.datasets.length}
                </span>
                <Button
                  variant="icon"
                  size="sm"
                  aria-label={`Create ${group.label.toLowerCase()} dataset`}
                  className="ml-auto"
                  onPress={() => onCreateInPurpose(group.purpose)}
                >
                  <Plus className="size-3.5" strokeWidth={1.75} />
                </Button>
              </div>

              {isCollapsed ? null : (
                <div className="flex flex-col">
                  {group.datasets.map((dataset) => (
                    <DatasetLinearRow
                      key={dataset.id}
                      dataset={dataset}
                      onOpen={onOpen}
                      actionsSlot={renderActions(dataset)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

interface DatasetLinearRowProps {
  dataset: Dataset;
  onOpen: (id: string) => void;
  actionsSlot?: React.ReactNode;
}

function DatasetLinearRow({
  dataset,
  onOpen,
  actionsSlot,
}: DatasetLinearRowProps) {
  const meta = dataset.purpose ? DATASET_PURPOSE_META[dataset.purpose] : null;
  const issueId = toDatasetIssueId(dataset.id);
  const owner = dataset.createdBy ?? "unassigned";
  const ownerInitials = deriveInitials(owner);
  const primaryTag = dataset.tags?.[0] ?? meta?.label ?? "Dataset";
  const extraTagCount = Math.max(0, (dataset.tags?.length ?? 0) - 1);

  return (
    <div
      data-purpose={dataset.purpose ?? undefined}
      className={cx(
        "group relative isolate grid h-[46px] items-center gap-2 px-3",
        "grid-cols-[76px_minmax(180px,1fr)_minmax(120px,260px)_32px_72px_28px]",
        "border-b border-l-border-faint last:border-b-0",
        "font-sans text-[13px] text-l-ink"
      )}
    >
      <button
        type="button"
        aria-label={`Open dataset ${dataset.name}`}
        onClick={() => onOpen(dataset.id)}
        className={cx(
          "absolute inset-0 z-0 rounded-[4px] transition-[background-color] duration-fast",
          "hover:bg-l-surface-hover",
          "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-ember"
        )}
      />

      <span className="pointer-events-none relative z-10 truncate font-mono text-[12px] tabular-nums text-l-ink-dim">
        {issueId}
      </span>

      <span className="pointer-events-none relative z-10 flex min-w-0 items-center gap-2">
        <span className="truncate font-medium text-l-ink">{dataset.name}</span>
        {dataset.traceCount > 0 ? (
          <span className="inline-flex h-5 shrink-0 items-center rounded-pill border border-l-border-faint bg-l-wash-1 px-1.5 font-mono text-[10.5px] tabular-nums text-l-ink-dim">
            {dataset.traceCount.toLocaleString()}
          </span>
        ) : null}
        {extraTagCount > 0 ? (
          <span className="inline-flex h-5 shrink-0 items-center rounded-pill border border-l-border-faint bg-l-wash-1 px-1.5 font-mono text-[10.5px] tabular-nums text-l-ink-dim">
            +{extraTagCount}
          </span>
        ) : null}
      </span>

      <span className="pointer-events-none relative z-10 flex min-w-0 justify-end">
        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-pill border border-l-border-faint bg-l-wash-1 px-2 py-1 text-l-ink-lo">
          <Box className="size-3 shrink-0" strokeWidth={1.75} />
          <span className="truncate">{primaryTag}</span>
        </span>
      </span>

      <span className="pointer-events-none relative z-10 flex justify-end">
        <Avatar size="xs" tone={ownerTone(owner)} title={owner}>
          <AvatarFallback>{ownerInitials}</AvatarFallback>
        </Avatar>
      </span>

      <span className="pointer-events-none relative z-10 text-right font-mono text-[11.5px] tabular-nums text-l-ink-dim">
        {formatDatasetDate(dataset.updatedAt)}
      </span>

      <div
        className="relative z-10 flex items-center justify-end"
        onClick={(e) => e.stopPropagation()}
      >
        {actionsSlot ?? (
          <Button
            variant="icon"
            size="sm"
            aria-label={`Actions for ${dataset.name}`}
          >
            <MoreHorizontal className="size-4" strokeWidth={1.75} />
          </Button>
        )}
      </div>
    </div>
  );
}

type FacetTab = "purpose" | "owners" | "tags";

interface DatasetFacetRailProps {
  datasets: readonly Dataset[];
  selectedPurposes: readonly DatasetPurpose[];
  onPurposeToggle: (purpose: DatasetPurpose) => void;
  width: number;
  onWidthChange: (next: number) => void;
  minWidth?: number;
  maxWidth?: number;
}

function DatasetFacetRail({
  datasets,
  selectedPurposes,
  onPurposeToggle,
  width,
  onWidthChange,
  minWidth = 280,
  maxWidth = 560,
}: DatasetFacetRailProps) {
  const [tab, setTab] = React.useState<FacetTab>("purpose");
  const selectedPurposeSet = React.useMemo(
    () => new Set(selectedPurposes),
    [selectedPurposes]
  );
  const facets = React.useMemo(() => buildDatasetFacets(datasets), [datasets]);
  const { dragging, handleProps } = useRailResize({
    width,
    onWidthChange,
    minWidth,
    maxWidth,
  });

  return (
    <aside
      className={cx(
        "relative hidden shrink-0 self-stretch overflow-hidden border-l border-hairline bg-l-surface-bar p-3 xl:flex xl:flex-col",
        dragging
          ? null
          : "transition-[width] duration-200 ease-out motion-reduce:transition-none"
      )}
      style={{ width }}
    >
      <div
        {...handleProps}
        aria-label="Resize facets panel"
        className={RAIL_HANDLE_CLASSNAME}
      />
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-pill border border-l-border-faint bg-l-wash-1 p-1">
        {(
          [
            ["purpose", "Purpose"],
            ["owners", "Owners"],
            ["tags", "Tags"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            data-active={tab === value || undefined}
            onClick={() => setTab(value)}
            className={cx(
              "h-8 rounded-pill px-3 text-[12px] font-medium text-l-ink-dim transition-[background-color,color] duration-fast",
              "hover:bg-l-wash-3 hover:text-l-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40",
              "data-[active=true]:bg-l-wash-5 data-[active=true]:text-l-ink"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "purpose" ? (
        <div className="flex flex-col gap-1">
          {facets.purposes.map(({ purpose, count }) => {
            const meta = DATASET_PURPOSE_META[purpose];
            const PurposeIcon = meta.Icon;
            return (
              <button
                key={purpose}
                type="button"
                data-active={selectedPurposeSet.has(purpose) || undefined}
                onClick={() => onPurposeToggle(purpose)}
                className={cx(
                  "flex h-10 items-center gap-2 rounded-md px-2 text-left text-[13px] text-l-ink-lo transition-[background-color,color] duration-fast",
                  "hover:bg-l-wash-3 hover:text-l-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40",
                  "data-[active=true]:bg-l-surface-selected data-[active=true]:text-l-ink"
                )}
              >
                <PurposeIcon
                  className={cx("size-3.5", meta.ink)}
                  strokeWidth={1.75}
                />
                <span className="min-w-0 flex-1 truncate">{meta.label}</span>
                <span className="font-mono text-[11px] tabular-nums text-l-ink-dim">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {tab === "owners" ? (
        <div className="flex flex-col gap-1">
          {facets.owners.map(({ owner, count }) => (
            <div
              key={owner}
              className="flex h-10 items-center gap-2 rounded-md px-2 text-[13px] text-l-ink-lo"
            >
              <Avatar size="xs" tone={ownerTone(owner)}>
                <AvatarFallback>{deriveInitials(owner)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate">{owner}</span>
              <span className="font-mono text-[11px] tabular-nums text-l-ink-dim">
                {count}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "tags" ? (
        <div className="flex flex-col gap-1">
          {facets.tags.map(({ tag, count }) => (
            <div
              key={tag}
              className="flex h-10 items-center gap-2 rounded-md px-2 text-[13px] text-l-ink-lo"
            >
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-event-violet"
              />
              <span className="min-w-0 flex-1 truncate">{tag}</span>
              <span className="font-mono text-[11px] tabular-nums text-l-ink-dim">
                {count}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

function buildDatasetFacets(datasets: readonly Dataset[]) {
  const purposeCounts = new Map<DatasetPurpose, number>();
  const ownerCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  for (const purpose of PURPOSE_ORDER) purposeCounts.set(purpose, 0);
  for (const dataset of datasets) {
    if (dataset.purpose) {
      purposeCounts.set(
        dataset.purpose,
        (purposeCounts.get(dataset.purpose) ?? 0) + 1
      );
    }
    const owner = dataset.createdBy ?? "No owner";
    ownerCounts.set(owner, (ownerCounts.get(owner) ?? 0) + 1);
    for (const tag of dataset.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  return {
    purposes: PURPOSE_ORDER.map((purpose) => ({
      purpose,
      count: purposeCounts.get(purpose) ?? 0,
    })),
    owners: Array.from(ownerCounts, ([owner, count]) => ({ owner, count }))
      .sort((a, b) => b.count - a.count || a.owner.localeCompare(b.owner))
      .slice(0, 8),
    tags: Array.from(tagCounts, ([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
      .slice(0, 8),
  };
}

function toDatasetIssueId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % 997;
  }
  return `DS-${String(hash + 1).padStart(3, "0")}`;
}

function formatDatasetDate(iso: string | undefined): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function ownerTone(owner: string): AvatarTone {
  const tones: AvatarTone[] = [
    "green",
    "teal",
    "violet",
    "amber",
    "pink",
    "ember",
  ];
  let hash = 0;
  for (let i = 0; i < owner.length; i += 1) {
    hash = (hash + owner.charCodeAt(i)) % tones.length;
  }
  return tones[hash] ?? "neutral";
}

/* ── Headers ─────────────────────────────────────────────── */

interface ListHeaderProps {
  count: number;
  summary: DatasetSummary;
  onCreate: () => void;
}

function ListHeader({ count, summary, onCreate }: ListHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-l-border-faint pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="font-display text-[34px] font-normal leading-none tracking-[-0.04em] text-l-ink-hi md:text-[44px]">
          Your dataset{" "}
          <em className="font-normal italic text-ember">library.</em>
        </h1>
        <p className="mt-2 max-w-2xl text-[12.5px] leading-5 text-l-ink-dim">
          Curated trace collections for evaluation and replay.{" "}
          {count > 0
            ? `${count} ${count === 1 ? "dataset" : "datasets"} (${summary.activeCount} active) covering ${summary.traceCount.toLocaleString()} traces and ${summary.eventCount.toLocaleString()} events.`
            : "Save traces from the timeline to build evaluation sets and replay scenarios."}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          onPress={onCreate}
          leadingIcon={<Plus className="size-3.5" strokeWidth={1.75} />}
        >
          New dataset
        </Button>
      </div>
    </header>
  );
}
