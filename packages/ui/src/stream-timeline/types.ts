/*
 * Stream Timeline — types for the event-stream timeline viewer that
 * organizes a flat list of events into a topic tree (source / type)
 * and renders them along a shared time axis with playhead, drag-pan
 * and wheel-zoom.
 *
 * Distinct from `product/timeline-lane.tsx` which is a *trace + span*
 * timeline (calls grouped by `traceId`). This module models the
 * *event firehose* surface — many independent sources, no traces.
 *
 * Names are prefixed `Stream*` to avoid colliding with the existing
 * `TimelineEvent` / `TimelineSpan` exports from `product/`.
 */

/** A single event rendered as a mark on the timeline. */
export interface StreamTimelineEvent {
  id: string;
  /** Source/system the event came from (e.g. `intercom`, `stripe`). */
  source: string;
  /** Event type within the source (e.g. `conversation.created`). */
  type: string;
  /** ISO timestamp. */
  occurredAt: string;
  /** Optional actor display name or id. */
  actor?: string;
  /** Optional human-readable preview (first line of body etc.). */
  message?: string;
  /** Raw payload — shown JSON-pretty in the detail panel. */
  payload?: Record<string, unknown>;
  /** Optional grouping (capture stream id) — currently informational. */
  stream?: string;
  /** Optional explicit color override; falls back to the source color. */
  color?: string;
  /**
   * Trace this event belongs to. Events sharing a `traceId` are
   * connected — they highlight together, render with arcs in
   * connector mode, and collapse into a single row in
   * `groupBy="trace"` mode. Optional; when absent, the viewer can
   * derive a key via the `traceKey` callback prop.
   */
  traceId?: string;
  /**
   * Direct causal predecessor — drives solid arrows in the connector
   * overlay. Both events must share a `traceId` (or derived trace key)
   * for the arrow to render.
   */
  parentEventId?: string;
  /**
   * Looser, app-defined grouping key (e.g. `conversation_id`,
   * `customer_id`). Currently informational — surfaces in the meta
   * strip of the detail panel; reserved for richer correlation views.
   */
  correlationKey?: string;
  /**
   * Human-friendly label for the trace. Shown as the row title in
   * `groupBy="trace"` mode and as the trace chip in the toolbar. When
   * absent, the viewer falls back to the source/type of the trace's
   * first event.
   */
  traceLabel?: string;
}

/**
 * Resolves a trace key for an event when `event.traceId` is absent.
 * Lets apps integrate before backend `trace_id` ships — e.g.
 * `(e) => e.payload?.conversation_id as string | undefined`.
 */
export type TraceKeyFn = (
  event: StreamTimelineEvent,
) => string | undefined;

/* ── Dataset building ─────────────────────────────────────── */

/**
 * Intended use of a dataset — drives the colored badge on the
 * picker and lets apps route additions to the right backend
 * (eval suite, training set, replay corpus, manual review queue).
 */
export type DatasetPurpose = "eval" | "training" | "replay" | "review";

export interface Dataset {
  id: string;
  name: string;
  description?: string;
  purpose?: DatasetPurpose;
  /** Number of traces currently in the dataset. */
  traceCount: number;
  /** Optional total event count across all traces. */
  eventCount?: number;
  /** ISO timestamp of the most recent addition. */
  updatedAt?: string;
  /** Display name of the dataset owner / creator. */
  createdBy?: string;
  /** Free-form pinned tags. */
  tags?: readonly string[];
}

/** Train / validation / test split assignment. */
export type DatasetSplit = "train" | "validation" | "test";

/**
 * Payload fired when the user confirms adding a trace to a dataset.
 *
 * Every addition is a *trace* — even a single event is treated as a
 * trace of one. The picker never emits a "single event" payload; if
 * the source event has no resolvable `traceId`, the viewer
 * synthesizes one from the event id (so callers always have a stable
 * trace identity to dedupe against).
 *
 * Either `datasetId` (existing) or `newDataset` (create-and-add) is
 * set, never both.
 */
export interface AddTraceToDatasetPayload {
  /**
   * Trace identifier the events are being added under. When the
   * source event had no explicit `traceId`, this is the event id —
   * trace-of-one semantics. Always defined.
   */
  traceId: string;
  /** True when `traceId` was synthesized from a single event id (no
   *  multi-event trace existed). Useful for callers that want to
   *  bucket "real traces" vs. ad-hoc one-offs server-side. */
  traceSynthesized: boolean;
  /** Display label for the trace; defaults to `<source>/<type>` for
   *  trace-of-one additions. */
  traceLabel?: string;
  /** Every event id in the trace, sorted by `occurredAt` ascending. */
  eventIds: string[];
  /** Mirrors `eventIds.length`. */
  count: number;
  /** Existing dataset selected by the user. */
  datasetId?: string;
  /** Create-new request — viewer doesn't synthesize the id. */
  newDataset?: {
    name: string;
    description?: string;
    purpose?: DatasetPurpose;
  };
  /** Split tag, when the user assigned one. */
  split?: DatasetSplit;
  /** Free-form notes typed by the user. */
  notes?: string;
}

/**
 * Handler signature for dataset additions. May be sync or async; the
 * picker shows a pending state while the returned promise resolves.
 */
export type AddTraceToDatasetHandler = (
  payload: AddTraceToDatasetPayload,
) => void | Promise<void>;

/**
 * Membership of one trace in one dataset. Drives the "In datasets"
 * section in the event-detail sidebar and the "Added" tag in the
 * dataset picker. Apps look up memberships by `traceId` (or by the
 * synthesized solo trace id, see `resolveEffectiveTraceId`).
 */
export interface TraceDatasetMembership {
  datasetId: string;
  datasetName: string;
  /** Drives the color pip on the chip. */
  purpose?: DatasetPurpose;
  /** When the trace was assigned to a split (train/validation/test). */
  split?: DatasetSplit;
  /** ISO timestamp the membership was created. */
  addedAt?: string;
  /** Optional human-readable note attached to the membership. */
  note?: string;
}

/**
 * Resolves the dataset memberships for a given trace id. Apps wire
 * this from a local cache, a query result, or a server lookup.
 */
export type DatasetMembershipsResolver = (
  traceId: string,
) => readonly TraceDatasetMembership[];

/** Toolbar playback state. */
export type StreamPlaybackState = "live" | "playing" | "paused";

/** Selection event payload. */
export interface StreamSelectionEvent {
  eventId: string | null;
  event: StreamTimelineEvent | null;
}

/** Time-range change event payload (ISO strings on the wire). */
export interface StreamTimeRangeEvent {
  start: string;
  end: string;
}

/** Playhead change event payload (ISO string). */
export interface StreamPlayheadEvent {
  time: string;
}

/* ── Streams panel (recording controls) ─────────────────────── */

export type StreamId = string;

export interface RecordingStream {
  id: StreamId;
  name: string;
  color?: string;
  enabled: boolean;
  /** Free-form status text (`online`, `paused`, `pending`). */
  status: string;
  /** Capture kind. */
  kind: "LiveApi" | "McapFile" | (string & {});
  event_count: number;
}

export type RecordingState =
  | { kind: "Idle" }
  | { kind: "SelectingStreams" }
  | {
      kind: "Recording";
      startedAt: number;
      eventCount: number;
      recordingStreamIds: StreamId[];
    }
  | {
      kind: "PendingSave";
      eventCount: number;
      durationSecs: number;
      recordedStreamIds: StreamId[];
    };

export const REC_IDLE: RecordingState = { kind: "Idle" };
export const REC_SELECTING: RecordingState = { kind: "SelectingStreams" };

export function recRecording(
  startedAt: number,
  eventCount: number,
  recordingStreamIds: StreamId[],
): RecordingState {
  return { kind: "Recording", startedAt, eventCount, recordingStreamIds };
}

export function recPendingSave(
  eventCount: number,
  durationSecs: number,
  recordedStreamIds: StreamId[],
): RecordingState {
  return { kind: "PendingSave", eventCount, durationSecs, recordedStreamIds };
}
