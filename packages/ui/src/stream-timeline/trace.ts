/*
 * Stream Timeline — trace + correlation helpers.
 *
 * Pure utilities that resolve which events belong to the same trace
 * and provide the lookup tables the viewer needs for highlighting,
 * connector rendering, and trace-mode grouping. Both an explicit
 * `event.traceId` and a caller-supplied `traceKey` callback are
 * supported, so the viewer works whether the backend already emits
 * trace ids or the app derives them client-side from a payload field.
 */

import type { StreamTimelineEvent, TraceKeyFn } from "./types";

/**
 * Returns the trace identifier for an event:
 *   1. `event.traceId` if set (preferred — typed, schema-stable);
 *   2. otherwise the result of the optional `traceKey` callback;
 *   3. otherwise `undefined` (event is not in any trace).
 */
export function resolveTraceId(
  event: StreamTimelineEvent,
  traceKey?: TraceKeyFn,
): string | undefined {
  return event.traceId ?? traceKey?.(event);
}

/**
 * Resolves the *effective* trace id for an event — i.e. the id used
 * everywhere a trace identity is needed, including dataset
 * memberships. When a real trace exists this returns that; when not,
 * it returns the event's own id so a single event still has a stable
 * trace identity (matching the trace-of-one semantics in
 * `AddTraceToDatasetPayload`).
 *
 * Returns `null` when the event itself is null.
 */
export function resolveEffectiveTraceId(
  event: StreamTimelineEvent | null,
  traceEvents: readonly StreamTimelineEvent[] = [],
  traceKey?: TraceKeyFn,
): string | null {
  if (!event) return null;
  return (
    resolveTraceId(event, traceKey) ??
    traceEvents.find((e) => resolveTraceId(e, traceKey))?.traceId ??
    event.id
  );
}

/** Active-trace context derived from the current selection. */
export interface TraceContext {
  /** `null` when no event is selected or the selected event has no trace. */
  activeTraceId: string | null;
  /** Set of event ids on the active trace — fast lookup for row marks. */
  siblings: ReadonlySet<string>;
  /** All trace siblings, sorted by `occurredAt` ascending. */
  sortedEvents: readonly StreamTimelineEvent[];
}

const EMPTY_CONTEXT: TraceContext = Object.freeze({
  activeTraceId: null,
  siblings: new Set<string>(),
  sortedEvents: [],
});

/** Build the trace context for the currently selected event. */
export function buildTraceContext(
  events: readonly StreamTimelineEvent[],
  selectedEvent: StreamTimelineEvent | null,
  traceKey?: TraceKeyFn,
): TraceContext {
  if (!selectedEvent) return EMPTY_CONTEXT;
  const activeTraceId = resolveTraceId(selectedEvent, traceKey);
  if (!activeTraceId) return EMPTY_CONTEXT;

  const sortedEvents = events
    .filter((e) => resolveTraceId(e, traceKey) === activeTraceId)
    .slice()
    .sort(
      (a, b) =>
        new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    );

  return {
    activeTraceId,
    siblings: new Set(sortedEvents.map((e) => e.id)),
    sortedEvents,
  };
}

/**
 * One trace plus its events, sorted. Singletons (events with no
 * resolvable trace) get a synthetic key — either per event id
 * (`__solo__<eventId>`, the default) or per source bucket
 * (`__solo__source__<source>`) when `bucketSoloBySource` is on.
 */
export interface TraceGroup {
  traceId: string;
  isSolo: boolean;
  /** Sorted by `occurredAt` ascending. */
  events: StreamTimelineEvent[];
  /** Resolved label — `traceLabel` of any event in the trace, or
   *  derived from the first event's source/type. */
  label: string;
  /** Earliest `occurredAt` in ms; used for ordering trace rows. */
  startMs: number;
  /** Latest `occurredAt` in ms. */
  endMs: number;
  /** First event's source — drives the trace row's color. */
  firstSource: string;
}

const SOLO_PREFIX = "__solo__";
const SOLO_SOURCE_PREFIX = "__solo__source__";

export interface GroupByTraceOptions {
  traceKey?: TraceKeyFn;
  /**
   * When true, events without a resolvable trace are bucketed into
   * one row per source instead of one row per event. Useful in
   * `groupBy="trace"` mode so the real, named traces stay primary
   * and the firehose collapses into a small set of `Untraced ·
   * <source>` rows below them. Default `false`.
   */
  bucketSoloBySource?: boolean;
}

export function groupByTrace(
  events: readonly StreamTimelineEvent[],
  traceKeyOrOptions?: TraceKeyFn | GroupByTraceOptions,
): TraceGroup[] {
  // Backwards compat: accept either a `TraceKeyFn` (legacy) or an
  // options object.
  const options: GroupByTraceOptions =
    typeof traceKeyOrOptions === "function"
      ? { traceKey: traceKeyOrOptions }
      : traceKeyOrOptions ?? {};
  const { traceKey, bucketSoloBySource = false } = options;

  const groups = new Map<string, StreamTimelineEvent[]>();
  for (const e of events) {
    const traceId = resolveTraceId(e, traceKey);
    const id =
      traceId ??
      (bucketSoloBySource
        ? `${SOLO_SOURCE_PREFIX}${e.source}`
        : `${SOLO_PREFIX}${e.id}`);
    let arr = groups.get(id);
    if (!arr) {
      arr = [];
      groups.set(id, arr);
    }
    arr.push(e);
  }

  const out: TraceGroup[] = [];
  for (const [traceId, bucket] of groups) {
    bucket.sort(
      (a, b) =>
        new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    );
    const first = bucket[0]!;
    const last = bucket[bucket.length - 1]!;
    const isSolo = traceId.startsWith(SOLO_PREFIX);
    const isSourceBucket = traceId.startsWith(SOLO_SOURCE_PREFIX);
    let label: string;
    if (isSourceBucket) {
      label = `Untraced · ${first.source}`;
    } else if (isSolo) {
      label = `${first.source}/${first.type}`;
    } else {
      label =
        bucket.find((e) => e.traceLabel)?.traceLabel ??
        `${first.source} · ${bucket.length}`;
    }
    out.push({
      traceId,
      isSolo,
      events: bucket,
      label,
      startMs: new Date(first.occurredAt).getTime(),
      endMs: new Date(last.occurredAt).getTime(),
      firstSource: first.source,
    });
  }

  // Real traces sort to the top by start time; untraced buckets fall
  // to the bottom sorted alphabetically by source so they stay
  // findable but don't push the named traces off-screen.
  out.sort((a, b) => {
    if (a.isSolo !== b.isSolo) return a.isSolo ? 1 : -1;
    if (a.isSolo && b.isSolo) return a.firstSource.localeCompare(b.firstSource);
    return a.startMs - b.startMs;
  });
  return out;
}

/**
 * Connector edges between events in a trace.
 *
 * `causal` edges follow `parentEventId` — solid line + arrowhead.
 * `sequential` edges fall back to time-order between siblings when
 * no parent is set — dashed, no arrowhead. The viewer uses these
 * to drive the SVG overlay.
 */
export type TraceEdgeKind = "causal" | "sequential";

export interface TraceEdge {
  id: string;
  fromId: string;
  toId: string;
  kind: TraceEdgeKind;
}

export function buildTraceEdges(
  sortedEvents: readonly StreamTimelineEvent[],
): TraceEdge[] {
  if (sortedEvents.length < 2) return [];
  const ids = new Set(sortedEvents.map((e) => e.id));
  const edges: TraceEdge[] = [];
  let prev: StreamTimelineEvent | null = null;

  for (const e of sortedEvents) {
    if (e.parentEventId && ids.has(e.parentEventId)) {
      edges.push({
        id: `c_${e.parentEventId}_${e.id}`,
        fromId: e.parentEventId,
        toId: e.id,
        kind: "causal",
      });
    } else if (prev) {
      edges.push({
        id: `s_${prev.id}_${e.id}`,
        fromId: prev.id,
        toId: e.id,
        kind: "sequential",
      });
    }
    prev = e;
  }

  return edges;
}
