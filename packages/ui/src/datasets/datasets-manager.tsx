"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";

import { DatasetActionsMenu } from "./dataset-actions-menu";
import { DatasetCard } from "./dataset-card";
import { DatasetCreateDialog } from "./dataset-create-dialog";
import { DatasetDeleteConfirm } from "./dataset-delete-confirm";
import { DatasetDetailPage } from "./dataset-detail-page";
import { DatasetEditDialog } from "./dataset-edit-dialog";
import { DatasetEmpty } from "./dataset-empty";
import { DatasetRow } from "./dataset-row";
import { DatasetTraceCompareDrawer } from "./dataset-trace-compare";
import { DatasetTraceDetailDrawer } from "./dataset-trace-detail-drawer";
import {
  DatasetsToolbar,
  type DatasetsView,
} from "./datasets-toolbar";
import { datasetSnapshotsById, datasetsManagerSeed } from "./data";
import type { DatasetFormValues } from "./dataset-form";
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
    helpers: ManagerDetailHelpers,
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
  /** Saved views keyed by dataset id. Drives the canvas left rail. */
  savedViewsByDatasetId?: Readonly<Record<string, readonly DatasetSavedView[]>>;
  /** Persist a new saved view. When omitted, the manager keeps a
   *  per-session optimistic store so stories work end-to-end. */
  onCreateSavedView?: CreateSavedViewHandler;
  /** Delete a saved view. Optimistic by default. */
  onDeleteSavedView?: DeleteSavedViewHandler;
  /** Eval runs keyed by dataset id. Drives the canvas left rail's
   *  Eval-runs section. */
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
  initialView = "grid",
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
  onDeleteSavedView,
  evalRunsByDatasetId,
  onChange,
  className,
}: DatasetsManagerProps) {
  const [list, setList] = React.useState<Dataset[]>(() => [...initialDatasets]);
  const [query, setQuery] = React.useState("");
  const [purposes, setPurposes] = React.useState<DatasetPurpose[]>([]);
  const [view, setView] = React.useState<DatasetsView>(initialView);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createInitialValues, setCreateInitialValues] = React.useState<
    Partial<DatasetFormValues> | undefined
  >(undefined);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [selectedTraceId, setSelectedTraceId] = React.useState<string | null>(null);

  /* Optimistic snapshot overlay. We don't mutate the consumer-passed
     `snapshotsById` directly; we layer per-dataset deltas on top so
     bulk + inline edits feel real in stories without a backend. */
  const [snapshotOverrides, setSnapshotOverrides] = React.useState<
    Record<string, DatasetSnapshot>
  >({});
  const baseSnapshotsRef = React.useRef(snapshotsById);
  baseSnapshotsRef.current = snapshotsById;

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
    [onChange],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((dataset) => {
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
  }, [list, query, purposes]);

  const togglePurpose = (purpose: DatasetPurpose) => {
    setPurposes((cur) =>
      cur.includes(purpose)
        ? cur.filter((p) => p !== purpose)
        : [...cur, purpose],
    );
  };

  const showEmpty = list.length === 0;
  const showFilteredEmpty = !showEmpty && filtered.length === 0;

  const selectedDataset = React.useMemo(
    () => (selectedId ? list.find((d) => d.id === selectedId) ?? null : null),
    [selectedId, list],
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

  /* Resolve the working snapshot for a given dataset id (overlay
     ∘ index). Used by the optimistic mutators below. */
  const resolveSnapshot = React.useCallback(
    (datasetId: string): DatasetSnapshot | null => {
      return (
        snapshotOverrides[datasetId] ?? baseSnapshotsRef.current[datasetId] ?? null
      );
    },
    [snapshotOverrides],
  );

  /* CRUD request helpers — open the matching dialog. */
  const requestCreate = React.useCallback(() => {
    setCreateInitialValues(undefined);
    setCreateOpen(true);
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
    [list],
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
    [list, onCreateDataset, propagate],
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
    [list, onUpdateDataset, propagate],
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
    [savedViewsByDatasetId, savedViewsOverlay],
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
        const current = prev[payload.datasetId] ?? savedViewsByDatasetId?.[payload.datasetId] ?? [];
        return {
          ...prev,
          [payload.datasetId]: [...current, created],
        };
      });
      return created;
    },
    [onCreateSavedView, savedViewsByDatasetId],
  );

  const handleDeleteSavedView = React.useCallback<DeleteSavedViewHandler>(
    async (payload) => {
      if (onDeleteSavedView) {
        await onDeleteSavedView(payload);
      }
      setSavedViewsOverlay((prev) => {
        const current = prev[payload.datasetId] ?? savedViewsByDatasetId?.[payload.datasetId] ?? [];
        return {
          ...prev,
          [payload.datasetId]: current.filter((v) => v.id !== payload.viewId),
        };
      });
    },
    [onDeleteSavedView, savedViewsByDatasetId],
  );

  /* ── Inline + bulk trace mutations ──────────────────────── */

  const applyTracePatch = React.useCallback(
    (
      datasetId: string,
      traceIds: readonly string[],
      patch: UpdateTracesPayload["patch"],
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
    [resolveSnapshot],
  );

  const handleUpdateTraces = React.useCallback<UpdateTracesHandler>(
    async (payload) => {
      if (onUpdateTraces) {
        await onUpdateTraces(payload);
      }
      applyTracePatch(payload.datasetId, payload.traceIds, payload.patch);
    },
    [applyTracePatch, onUpdateTraces],
  );

  const handleRemoveTrace = React.useCallback<RemoveTraceFromDatasetHandler>(
    async (payload) => {
      if (_onRemoveTraceFromDataset) {
        await _onRemoveTraceFromDataset(payload);
      }
      const snapshot = resolveSnapshot(payload.datasetId);
      if (!snapshot) return;
      const nextTraces = snapshot.traces.filter(
        (t) => t.traceId !== payload.traceId,
      );
      setSnapshotOverrides((prev) => ({
        ...prev,
        [payload.datasetId]: { ...snapshot, traces: nextTraces },
      }));
      if (selectedTraceId === payload.traceId) setSelectedTraceId(null);
    },
    [_onRemoveTraceFromDataset, resolveSnapshot, selectedTraceId],
  );

  const handleDelete = React.useCallback<DeleteDatasetHandler>(
    async (payload) => {
      if (onDeleteDataset) {
        await onDeleteDataset(payload);
      }
      propagate(list.filter((d) => d.id !== payload.id));
      if (selectedId === payload.id) exitDetail();
    },
    [list, onDeleteDataset, propagate, selectedId, exitDetail],
  );

  const helpers: ManagerDetailHelpers = React.useMemo(
    () => ({
      goBack: exitDetail,
      edit: requestEdit,
      remove: requestDelete,
    }),
    [exitDetail, requestEdit, requestDelete],
  );

  const editDataset = editId ? list.find((d) => d.id === editId) ?? null : null;
  const deleteDataset = deleteId
    ? list.find((d) => d.id === deleteId) ?? null
    : null;

  return (
    <div
      className={cx(
        "flex min-h-[calc(100svh-var(--header-height,3.5rem)-2rem)] flex-col gap-4 bg-l-surface p-4 text-l-ink",
        className,
      )}
    >
      {selectedSnapshot ? (
        <>
          <DetailHeader
            workspace={workspace}
            datasetName={selectedSnapshot.dataset.name}
            onBack={exitDetail}
          />
          {/* Row layout so the trace inspector slides in as a sibling
              column, not as a viewport-attached overlay. Mirrors the
              StreamTimelineViewer's `showDetailPanel` aside pattern so
              the dataset detail and the trace inspector read as one
              unified surface. */}
          <div className="flex flex-1 min-h-0 flex-row overflow-hidden rounded-[4px] border border-hairline-strong bg-l-surface-raised">
            <div className="flex min-w-0 flex-1 flex-col">
              {renderDetail
                ? renderDetail(selectedSnapshot, helpers)
                : (
                  <DatasetDetailPage
                    snapshot={selectedSnapshot}
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
                    (t) => t.traceId === selectedTraceIds[0],
                  ) ?? null
                }
                right={
                  selectedSnapshot.traces.find(
                    (t) => t.traceId === selectedTraceIds[1],
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
            ) : (
              <DatasetTraceDetailDrawer
                isOpen={selectedTraceId != null}
                onClose={() => setSelectedTraceId(null)}
                snapshot={selectedSnapshot}
                trace={
                  selectedTraceId
                    ? selectedSnapshot.traces.find(
                        (t) => t.traceId === selectedTraceId,
                      ) ?? null
                    : null
                }
                onRemoveTrace={handleRemoveTrace}
              />
            )}
          </div>
        </>
      ) : (
        <>
          <ListHeader
            workspace={workspace}
            count={list.length}
            onCreate={requestCreate}
          />

          {showEmpty ? (
            <DatasetEmpty variant="empty" onCreate={requestCreate} />
          ) : (
            <>
              <DatasetsToolbar
                query={query}
                onQueryChange={setQuery}
                view={view}
                onViewChange={setView}
                selectedPurposes={purposes}
                onPurposeToggle={togglePurpose}
                totalCount={list.length}
                hideAdd={hideToolbarAdd}
                onCreate={requestCreate}
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
                <div className="rounded-[4px] border border-hairline-strong bg-l-surface-raised">
                  {filtered.map((dataset) => (
                    <DatasetRow
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
              ) : (
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

/* ── Headers ─────────────────────────────────────────────── */

interface ListHeaderProps {
  workspace: string;
  count: number;
  onCreate: () => void;
}

function ListHeader({ workspace, count, onCreate }: ListHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-l-border-faint pb-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="mb-1 flex items-center gap-2 font-mono text-[10.5px] tracking-[0.04em] text-l-ink-dim">
          <span>{workspace}</span>
          <span aria-hidden>/</span>
          <span className="text-l-ink-lo">Validation</span>
          <span aria-hidden>/</span>
          <span className="text-ember">Datasets</span>
        </div>
        <h1 className="font-sans text-[18px] font-medium leading-tight text-l-ink">
          Datasets
        </h1>
        <p className="mt-1 max-w-2xl text-[12.5px] leading-5 text-l-ink-dim">
          {count === 0
            ? "Create a dataset to start grouping traces for evals, training, replay, or review."
            : `${count} ${count === 1 ? "dataset" : "datasets"} · curate traces for evals, training, replay, and review.`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onPress={onCreate}
        >
          + New dataset
        </Button>
      </div>
    </header>
  );
}

interface DetailHeaderProps {
  workspace: string;
  datasetName: string;
  onBack: () => void;
}

function DetailHeader({ workspace, datasetName, onBack }: DetailHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-l-border-faint pb-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="mb-1 flex items-center gap-2 font-mono text-[10.5px] tracking-[0.04em] text-l-ink-dim">
          <span>{workspace}</span>
          <span aria-hidden>/</span>
          <button
            type="button"
            onClick={onBack}
            className="text-l-ink-lo hover:text-l-ink"
          >
            Datasets
          </button>
          <span aria-hidden>/</span>
          <span className="text-ember truncate">{datasetName}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onPress={onBack}
          leadingIcon={<ArrowLeft className="size-3.5" strokeWidth={1.75} />}
        >
          Back
        </Button>
      </div>
    </header>
  );
}

