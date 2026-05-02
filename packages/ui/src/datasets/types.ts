/*
 * Datasets — types for the Dataset Viewer surface.
 *
 * Builds on the trace + dataset primitives defined in
 * `../stream-timeline/types`. Adds richer per-dataset shape:
 *
 *   - `TraceSummary` — per-trace card data (id, label, sources,
 *     event count, duration, status, split, cluster).
 *   - `DatasetCluster` — group of traces sharing similarity (topical,
 *     embedding, label). Renders as a bubble in the graph view and a
 *     collapsible card in the clusters tab.
 *   - `DatasetSimilarityEdge` — pairwise similarity weight between
 *     two traces. Drives the edge layer in the graph view.
 *   - `DatasetSnapshot` — the "what's in this dataset right now"
 *     shape; carries the parent `Dataset`, all trace summaries,
 *     cluster groupings, similarity edges, and (optionally) the raw
 *     events so the Timeline tab can render them through the
 *     existing `StreamTimelineViewer`.
 *
 * The CRUD payloads (`CreateDatasetPayload`, `UpdateDatasetPayload`,
 * `DeleteDatasetPayload`) and matching handler signatures live here
 * too, plus the `RemoveTraceFromDatasetPayload` that complements the
 * existing `AddTraceToDatasetPayload` from `../stream-timeline/types`.
 */

import type {
  Dataset,
  DatasetPurpose,
  DatasetSplit,
  StreamTimelineEvent,
} from "../stream-timeline/types";

/* ── Per-trace summary ─────────────────────────────────────── */

/** Health status of a trace as judged by the dataset owner. */
export type TraceStatus = "ok" | "warn" | "error";

/**
 * Lightweight summary of a single trace inside a dataset. This is
 * what we render in the Traces table and the Clusters tab — the full
 * event list is loaded lazily through `DatasetSnapshot.events`.
 */
export interface TraceSummary {
  /** Stable trace id — matches `StreamTimelineEvent.traceId` for the
   *  events that compose this trace. */
  traceId: string;
  /** Human-friendly label (defaults to the first event's source/type
   *  in the seed). */
  label: string;
  /** Most-frequent source across the trace. Drives the brand icon. */
  primarySource: string;
  /** All distinct sources represented in the trace, ordered by event
   *  count desc. */
  sources: readonly string[];
  /** Total number of events in this trace. */
  eventCount: number;
  /** ISO timestamp of the trace's first event. */
  startedAt: string;
  /** Wall-clock span between first and last event, in milliseconds. */
  durationMs: number;
  /** Owner-assigned health status. */
  status: TraceStatus;
  /** Train / validation / test split assignment. */
  split?: DatasetSplit;
  /** Cluster id this trace belongs to. */
  clusterId?: string;
  /** ISO timestamp the trace was added to the dataset. */
  addedAt?: string;
  /** Display name of the user who added the trace. */
  addedBy?: string;
  /** Free-form note attached to this membership. */
  note?: string;
  /**
   * Pre-computed 2D embedding in normalized `[-1, 1]` space (driven
   * by an upstream UMAP / t-SNE / similar reducer). When present, the
   * graph view places this trace at the embedding directly — that's
   * how a real UMAP scatter behaves: irregular blobs, anisotropic
   * spread, outliers between clusters. When absent, the layout falls
   * back to a deterministic phyllotaxis around the cluster centroid.
   */
  embedding?: readonly [number, number];
}

/* ── Clusters + edges ──────────────────────────────────────── */

/**
 * Group of traces sharing similarity (topic, embedding, label). The
 * `color` field is a CSS variable reference produced by
 * `cluster-color.ts` — never a raw hex.
 */
export interface DatasetCluster {
  id: string;
  label: string;
  /** CSS color for the cluster (e.g. `"var(--c-event-teal)"`). */
  color: string;
  /** Trace ids that belong to this cluster, ordered by add-time
   *  ascending (so the first added trace is the cluster anchor). */
  traceIds: readonly string[];
  /** Optional one-line description shown in the cluster card. */
  description?: string;
  /**
   * Optional pre-computed centroid hint in normalized [0..1] space.
   * The graph view falls back to circle-packing when absent.
   */
  similarityCenter?: readonly [number, number];
}

/** Pairwise similarity between two traces. Drives the graph edges. */
export interface DatasetSimilarityEdge {
  fromTraceId: string;
  toTraceId: string;
  /** Similarity weight in [0..1]; 0 = unrelated, 1 = duplicate. */
  weight: number;
}

/* ── Snapshot ──────────────────────────────────────────────── */

/**
 * Everything the dataset viewer needs to render one dataset's
 * detail page. The parent `Dataset` is the same shape used by
 * `DatasetPicker` so a snapshot can be reduced back down for the
 * existing add-trace flow.
 */
export interface DatasetSnapshot {
  dataset: Dataset;
  traces: readonly TraceSummary[];
  clusters: readonly DatasetCluster[];
  edges: readonly DatasetSimilarityEdge[];
  /**
   * Optional pre-built event index used by the Timeline tab and the
   * trace detail drawer. When absent, those tabs render the empty
   * state.
   */
  events?: readonly StreamTimelineEvent[];
}

/* ── CRUD: create / update / delete ────────────────────────── */

/**
 * Payload fired when the user submits the "New dataset" dialog.
 * Handlers are async-friendly; the dialog stays open until the
 * returned promise resolves so apps can surface server-side
 * validation.
 */
export interface CreateDatasetPayload {
  name: string;
  description?: string;
  purpose?: DatasetPurpose;
  tags?: readonly string[];
}

/** Handler for `CreateDatasetPayload`; returns the created dataset. */
export type CreateDatasetHandler = (
  payload: CreateDatasetPayload,
) => Promise<Dataset> | Dataset;

/**
 * Patch payload for the Edit dialog. `patch` is intentionally a
 * partial of the editable fields so handlers can apply diffs without
 * having to think about the full `Dataset` shape.
 */
export interface UpdateDatasetPayload {
  id: string;
  patch: Partial<
    Pick<Dataset, "name" | "description" | "purpose" | "tags">
  >;
}

export type UpdateDatasetHandler = (
  payload: UpdateDatasetPayload,
) => Promise<Dataset> | Dataset;

/**
 * Delete payload. `cascade` is set by the destructive confirm
 * dialog when the dataset still has traces — the dialog forces a
 * typed-name confirmation in that case.
 */
export interface DeleteDatasetPayload {
  id: string;
  /** True when the user confirmed deletion of a non-empty dataset. */
  cascade?: boolean;
}

export type DeleteDatasetHandler = (
  payload: DeleteDatasetPayload,
) => void | Promise<void>;

/* ── Trace removal (complements the add flow) ──────────────── */

/**
 * Payload fired when the user confirms removing a trace from a
 * dataset. The matching add path is `AddTraceToDatasetPayload` from
 * `../stream-timeline/types`.
 */
export interface RemoveTraceFromDatasetPayload {
  datasetId: string;
  traceId: string;
  /** Optional reason captured from the confirm dialog. */
  reason?: string;
}

export type RemoveTraceFromDatasetHandler = (
  payload: RemoveTraceFromDatasetPayload,
) => void | Promise<void>;

/* ── Re-exports for ergonomic import ───────────────────────── */

export type {
  Dataset,
  DatasetPurpose,
  DatasetSplit,
  StreamTimelineEvent,
};
