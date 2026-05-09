/*
 * Datasets — types for the Dataset Viewer surface.
 *
 * Phase A unification: every shape that crosses the wire now lives
 * in `shared/generated` (auto-derived from the matching Rust crates
 * via `cargo run -p gen-contracts`). This file re-exports those for
 * ergonomic imports inside the design system, and keeps the
 * handler-function aliases — those are TS-only since Rust can't
 * express function types over JSON.
 */

import type {
  CreateDatasetPayload,
  Dataset,
  DatasetSavedView,
  DeleteDatasetPayload,
  DeleteSavedViewPayload,
  RemoveTraceFromDatasetPayload,
  UpdateDatasetPayload,
  UpdateSavedViewPayload,
  UpdateTracesPayload,
} from "chronicle/types";

/* ── Re-exports from shared/generated (Rust source-of-truth) ─ */

export type {
  CreateDatasetPayload,
  CreateSavedViewPayload,
  Dataset,
  DatasetCluster,
  DatasetEvalRun,
  DatasetEvalRunStatus,
  DatasetPatch,
  DatasetPurpose,
  DatasetSavedView,
  DatasetSavedViewFilter,
  DatasetSavedViewPatch,
  DatasetSavedViewScope,
  DatasetSavedViewSort,
  DatasetSavedViewState,
  DatasetSimilarityEdge,
  DatasetSnapshot,
  DatasetSplit,
  DeleteDatasetPayload,
  DeleteSavedViewPayload,
  RemoveTraceFromDatasetPayload,
  StreamTimelineEvent,
  TraceStatus,
  TraceSummary,
  UpdateDatasetPayload,
  UpdateSavedViewPayload,
  UpdateTracesPatch,
  UpdateTracesPayload,
} from "chronicle/types";

/* ── Handler aliases (TS-only — function types don't go over JSON) */

export type CreateDatasetHandler = (
  payload: CreateDatasetPayload,
) => Promise<Dataset> | Dataset;

export type UpdateDatasetHandler = (
  payload: UpdateDatasetPayload,
) => Promise<Dataset> | Dataset;

export type DeleteDatasetHandler = (
  payload: DeleteDatasetPayload,
) => void | Promise<void>;

export type RemoveTraceFromDatasetHandler = (
  payload: RemoveTraceFromDatasetPayload,
) => void | Promise<void>;

export type UpdateTracesHandler = (
  payload: UpdateTracesPayload,
) => void | Promise<void>;

export type CreateSavedViewHandler = (
  payload: import("chronicle/types").CreateSavedViewPayload,
) => Promise<DatasetSavedView> | DatasetSavedView;

export type UpdateSavedViewHandler = (
  payload: UpdateSavedViewPayload,
) => Promise<DatasetSavedView> | DatasetSavedView;

export type DeleteSavedViewHandler = (
  payload: DeleteSavedViewPayload,
) => void | Promise<void>;
