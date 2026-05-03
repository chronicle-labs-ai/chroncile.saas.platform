"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import {
  DEFAULT_LABEL_WIDTH,
  DEFAULT_ROW_HEIGHT,
  computeTimelineTicks,
} from "./tick-format";
import {
  buildTopicTree,
  getVisibleNodes,
  topicPathDisplay,
  topicPathFromEvent,
  type TopicTreeNode,
} from "./topic-tree";
import {
  buildTraceContext,
  buildTraceEdges,
  groupByTrace,
  resolveEffectiveTraceId,
  resolveTraceId,
  type TraceContext,
} from "./trace";
import { sourceColor } from "./source-color";
import {
  StreamTimelineFilterBar,
  type StreamTimelineFilterBarProps,
} from "./stream-timeline-filter-bar";
import { defaultStreamTimelineColumns } from "./filter-columns";
import {
  useDataTableFilters,
  type ColumnConfig,
  type FilterState,
} from "../product/filters";
import { useTimeView } from "./use-time-view";
import {
  StreamTimelineToolbar,
  type StreamTimelineGroupBy,
} from "./stream-timeline-toolbar";
import { StreamTimelineAxis } from "./stream-timeline-axis";
import {
  StreamTimelineRow,
  type StreamTimelineRowMark,
} from "./stream-timeline-row";
import { StreamEventDetail } from "./stream-event-detail";
import { StreamTimelineConnectors } from "./stream-timeline-connectors";
import type {
  AddTraceToDatasetHandler,
  Dataset,
  DatasetMembershipsResolver,
  StreamPlaybackState,
  StreamPlayheadEvent,
  StreamSelectionEvent,
  StreamTimeRangeEvent,
  StreamTimelineEvent,
  TraceKeyFn,
} from "./types";

export interface StreamTimelineViewerProps {
  events: readonly StreamTimelineEvent[];
  playback?: StreamPlaybackState;
  selectedEventId?: string | null;
  onPlaybackChange?: (state: StreamPlaybackState) => void;
  onSelect?: (e: StreamSelectionEvent) => void;
  onPlayheadChange?: (e: StreamPlayheadEvent) => void;
  onRangeChange?: (e: StreamTimeRangeEvent) => void;
  /** Initial time-window center (ms). Defaults to "now-15min" when paused. */
  initialCenterMs?: number;
  /** Initial half-width (ms). Defaults to 30 minutes. */
  initialHalfWidthMs?: number;
  labelWidth?: number;
  rowHeight?: number;
  className?: string;
  /** Optional toolbar leading slot (eyebrow, breadcrumb, etc.). */
  toolbarLeading?: React.ReactNode;
  /** Optional toolbar trailing slot (filters, etc.). */
  toolbarTrailing?: React.ReactNode;
  /**
   * When true, an inline `StreamEventDetail` sidebar slides in from
   * the right whenever an event is selected. The close button on the
   * sidebar fires `onSelect({ eventId: null, event: null })` to clear
   * the selection. Default `false` — when `false`, the caller is
   * expected to render their own detail surface (see the `Full`
   * Storybook story for the side-by-side composition).
   */
  showDetailPanel?: boolean;
  /** Width of the inline detail sidebar in pixels. Default 360. */
  detailPanelWidth?: number;
  /**
   * Custom renderer for the inline detail sidebar. Receives the
   * resolved event and a close callback. When provided, takes
   * precedence over the built-in `StreamEventDetail`. Useful for
   * apps that need to surface app-specific actions (replay, label,
   * link to trace) alongside the payload.
   */
  renderDetailPanel?: (
    event: StreamTimelineEvent | null,
    close: () => void,
  ) => React.ReactNode;

  /* ── Trace + correlation visualization ──────────────────── */

  /**
   * Resolves a trace id when `event.traceId` is absent. Lets apps
   * derive traces from a payload field (e.g. `conversation_id`)
   * before the backend ships first-class trace ids. The viewer
   * always tries `event.traceId` first, then falls back to this.
   */
  traceKey?: TraceKeyFn;

  /**
   * Row grouping strategy.
   *
   *   `"topic"` (default) — events organized by `source/type` topic
   *                          tree (the firehose view).
   *   `"trace"` — collapse rows to one per trace; events on a single
   *               trace render as a connected sequence on the same
   *               row, sorted by time.
   *
   * Pass `onGroupByChange` to render the Topic / Trace toggle in the
   * toolbar. Otherwise the viewer is uncontrolled.
   */
  groupBy?: StreamTimelineGroupBy;
  onGroupByChange?: (next: StreamTimelineGroupBy) => void;

  /**
   * When true, draws bezier arcs between events on the active trace
   * (or all traces, see `connectorsVisibility`). Solid + arrow-end
   * for `parentEventId` chains; dashed otherwise. Default `false`.
   */
  showConnectors?: boolean;

  /**
   * Whether connectors render only for the selected trace or for
   * every trace in view. Default `"selected"`.
   */
  connectorsVisibility?: "selected" | "all";

  /* ── Filter rail ────────────────────────────────────────── */

  /**
   * When true, renders a Linear-density filter bar between the
   * toolbar and the time axis. The bar wires through to the
   * underlying event list — only events matching all active
   * filters render as marks.
   *
   * Default `false`.
   */
  showFilters?: boolean;

  /**
   * Column descriptors that drive the filter rail. When omitted,
   * `defaultStreamTimelineColumns(events)` derives source / type /
   * actor / trace columns from the live data set.
   */
  filterColumns?: ColumnConfig<StreamTimelineEvent>[];

  /** Controlled filter state. Pass with `onFiltersChange`. */
  filters?: FilterState[];
  onFiltersChange?: (next: FilterState[]) => void;

  /** Slot rendered as the right-side "Display" button on the filter
   *  rail. When `onOpenDisplay` is provided, the bar shows a Display
   *  trigger that calls this on press. */
  onOpenDisplay?: StreamTimelineFilterBarProps["onOpenDisplay"];
  displayChanged?: boolean;

  /* ── Dataset building ───────────────────────────────────── */

  /**
   * Datasets the user can add the active trace (or single event) to.
   * Combined with `onAddTraceToDataset`, drives the bottom-right
   * "Add to dataset" CTA in the inline event-detail sidebar. The
   * picker hides when either prop is missing.
   */
  datasets?: readonly Dataset[];
  /**
   * Handler fired when the user confirms adding to a dataset. May
   * return a Promise; the picker shows a pending state on the action
   * button while the promise resolves and closes itself on success.
   */
  onAddTraceToDataset?: AddTraceToDatasetHandler;

  /**
   * Resolves dataset memberships for a given trace id. Called with
   * the *effective* trace id — i.e. `event.traceId` for trace
   * events, or `event.id` for solo trace-of-one selections.
   *
   * When provided and a result is non-empty, the inline detail
   * sidebar grows an `In datasets` section, the dataset CTA shows a
   * membership count, and the picker tags those datasets with an
   * `Added` check.
   */
  getDatasetMembershipsForTrace?: DatasetMembershipsResolver;
}

const MAX_MARKS_PER_ROW = 200;

/**
 * StreamTimelineViewer — composes the toolbar, time axis, and per-topic
 * rows into the full event-stream timeline. State for pan/zoom lives
 * in `useTimeView`; the viewer owns playback, selection, collapse,
 * and drag/wheel orchestration.
 */
export function StreamTimelineViewer({
  events,
  playback = "paused",
  selectedEventId = null,
  onPlaybackChange,
  onSelect,
  onPlayheadChange,
  onRangeChange,
  initialCenterMs,
  initialHalfWidthMs,
  labelWidth = DEFAULT_LABEL_WIDTH,
  rowHeight = DEFAULT_ROW_HEIGHT,
  className,
  toolbarLeading,
  toolbarTrailing,
  showDetailPanel = false,
  detailPanelWidth = 360,
  renderDetailPanel,
  traceKey,
  groupBy = "topic",
  onGroupByChange,
  showConnectors = false,
  connectorsVisibility = "selected",
  showFilters = false,
  filterColumns,
  filters: filtersProp,
  onFiltersChange,
  onOpenDisplay,
  displayChanged,
  datasets,
  onAddTraceToDataset,
  getDatasetMembershipsForTrace,
}: StreamTimelineViewerProps) {
  const [playheadMs, setPlayheadMs] = React.useState(() =>
    initialCenterMs ?? Date.now(),
  );
  const [collapsedSet, setCollapsedSet] = React.useState<Set<string>>(
    () => new Set<string>(),
  );
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStartX, setDragStartX] = React.useState(0);
  const [timeAreaWidth, setTimeAreaWidth] = React.useState(600);

  const timeAreaRef = React.useRef<HTMLDivElement | null>(null);
  const rowsContainerRef = React.useRef<HTMLDivElement | null>(null);

  /* Resize observer for the time-area width. */
  React.useEffect(() => {
    const el = timeAreaRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 600;
      setTimeAreaWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const timeView = useTimeView(initialCenterMs, initialHalfWidthMs);
  const {
    startMs,
    endMs,
    durationMs,
    timeToX,
    xToTime,
    pan,
    zoomAt,
    fitToTimes,
    setRange,
  } = timeView;

  /* ── Filter rail ─────────────────────────────────────────── */

  const resolvedColumns = React.useMemo(
    () =>
      filterColumns ?? defaultStreamTimelineColumns(events, { traceKey }),
    [filterColumns, events, traceKey],
  );

  const filterStore = useDataTableFilters<StreamTimelineEvent>({
    columns: resolvedColumns,
    filters: filtersProp,
    onFiltersChange,
  });

  const filteredEvents = React.useMemo(() => {
    if (!showFilters || filterStore.filters.length === 0) return events;
    return events.filter(filterStore.predicate);
  }, [showFilters, filterStore.filters.length, filterStore.predicate, events]);

  const eventsWithMs = React.useMemo(
    () =>
      filteredEvents.map((ev) => ({
        ev,
        ms: new Date(ev.occurredAt).getTime(),
      })),
    [filteredEvents],
  );

  const eventTimesMs = React.useMemo(
    () => eventsWithMs.map((item) => item.ms),
    [eventsWithMs],
  );

  /* Center on the latest event the first time we receive any (and we're
     paused). After that, leave the user's pan/zoom alone. */
  const hasInitialCentered = React.useRef(false);
  React.useEffect(() => {
    if (eventTimesMs.length === 0) {
      hasInitialCentered.current = false;
      return;
    }
    if (playback !== "paused") return;
    if (hasInitialCentered.current) return;
    hasInitialCentered.current = true;
    const latestMs = Math.max(...eventTimesMs);
    const half = 30 * 60 * 1000;
    setRange(latestMs - half, latestMs + half);
    setPlayheadMs(latestMs);
  }, [eventTimesMs, setRange, playback]);

  /* Tree of rows. In `topic` mode this is the source/type hierarchy;
     in `trace` mode it's a flat list of trace rows (one per resolved
     trace, with singletons for events that have no trace).
     Built from `filteredEvents` so the filter rail constrains the
     rows + event marks. The selection / trace inspector below still
     reads from the full `events` list so the user can keep an event
     selected after filtering it off the chart. */
  const traceGroups = React.useMemo(
    () =>
      groupByTrace(filteredEvents, {
        traceKey,
        // In trace mode, collapse solo events into one row per source
        // so the named traces stay primary. In topic mode this list
        // isn't rendered as rows so the bucketing setting doesn't
        // matter visually — it only affects connector + lookup math.
        bucketSoloBySource: groupBy === "trace",
      }),
    [filteredEvents, traceKey, groupBy],
  );

  const treeRoots = React.useMemo<TopicTreeNode[]>(() => {
    if (groupBy === "trace") {
      return traceGroups.map<TopicTreeNode>((group) => ({
        path: { segments: [group.traceId] },
        name: group.label,
        pathKey: group.traceId,
        expanded: true,
        children: [],
        eventCount: group.events.length,
        color: sourceColor(group.firstSource),
        depth: 1,
      }));
    }
    return buildTopicTree(filteredEvents);
  }, [groupBy, traceGroups, filteredEvents]);

  const visibleNodes = React.useMemo(
    () =>
      groupBy === "trace"
        ? treeRoots
        : getVisibleNodes(treeRoots, collapsedSet),
    [groupBy, treeRoots, collapsedSet],
  );

  /* Auto-follow during play/live. Sliding window keeps playhead at ~75%. */
  const prevPlaybackRef = React.useRef<StreamPlaybackState>("paused");
  const timeViewRef = React.useRef({
    centerMs: timeView.centerMs,
    halfWidthMs: timeView.halfWidthMs,
  });
  timeViewRef.current = {
    centerMs: timeView.centerMs,
    halfWidthMs: timeView.halfWidthMs,
  };

  React.useEffect(() => {
    if (playback === "paused") {
      prevPlaybackRef.current = "paused";
      return;
    }

    const wasPaused = prevPlaybackRef.current === "paused";
    prevPlaybackRef.current = playback;

    if (wasPaused) {
      const now = Date.now();
      const half = 10_000;
      setRange(now - half * 1.5, now + half * 0.5);
      setPlayheadMs(now);
      hasInitialCentered.current = true;
    }

    const interval = window.setInterval(() => {
      const now = Date.now();
      setPlayheadMs(now);

      const { centerMs: c, halfWidthMs: h } = timeViewRef.current;
      const viewStart = c - h;
      const viewDuration = h * 2;
      const threshold = viewStart + viewDuration * 0.75;
      if (now > threshold) {
        const newStart = now - viewDuration * 0.75;
        setRange(newStart, newStart + viewDuration);
      }
    }, 60);
    return () => window.clearInterval(interval);
  }, [playback, setRange]);

  const toggleCollapsed = React.useCallback((pathKey: string) => {
    setCollapsedSet((prev) => {
      const next = new Set(prev);
      if (next.has(pathKey)) next.delete(pathKey);
      else next.add(pathKey);
      return next;
    });
  }, []);

  const handleFit = React.useCallback(() => {
    if (eventTimesMs.length > 0) fitToTimes(eventTimesMs, 0.1);
    onRangeChange?.({
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
    });
  }, [eventTimesMs, fitToTimes, startMs, endMs, onRangeChange]);

  const handleTimeAreaClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDragging) return;
      const rect = timeAreaRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const t = xToTime(x, timeAreaWidth);
      setPlayheadMs(t);
      onPlayheadChange?.({ time: new Date(t).toISOString() });
      onPlaybackChange?.("paused");
    },
    [xToTime, timeAreaWidth, onPlayheadChange, onPlaybackChange, isDragging],
  );

  const handleTimeAreaMouseDown = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      setIsDragging(true);
      setDragStartX(e.clientX);
    },
    [],
  );

  React.useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const dx = dragStartX - e.clientX;
      const msPerPx = durationMs / Math.max(1, timeAreaWidth);
      const deltaMs = dx * msPerPx;
      pan(deltaMs);
      setDragStartX(e.clientX);
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, dragStartX, pan, durationMs, timeAreaWidth]);

  /* Native, non-passive wheel handler so we can preventDefault and
     intercept horizontal scroll for zoom and pan. Refs keep the
     listener stable.
     
     Behaviour:
       • Wheel over the *axis header* — always zoom on `deltaY`,
         pan on `deltaX`. The header has no vertical scroll content,
         so plain wheel reading as zoom matters most there.
       • Wheel over the *rows container* — vertical scroll wins by
         default (we don't preventDefault), so users can browse the
         topic list. Hold ⌘/Ctrl (or use a trackpad's horizontal
         delta) to switch into zoom/pan. */
  const wheelDepsRef = React.useRef({
    xToTime,
    zoomAt,
    pan,
    durationMs,
    timeAreaWidth,
    labelWidth,
  });
  wheelDepsRef.current = {
    xToTime,
    zoomAt,
    pan,
    durationMs,
    timeAreaWidth,
    labelWidth,
  };

  React.useEffect(() => {
    const headerEl = timeAreaRef.current;
    const rowsEl = rowsContainerRef.current;

    const onHeaderWheel = (e: WheelEvent) => {
      e.preventDefault();
      const {
        xToTime: x2t,
        zoomAt: za,
        pan: p,
        durationMs: dur,
        timeAreaWidth: tw,
      } = wheelDepsRef.current;
      const rect = headerEl?.getBoundingClientRect();
      if (!rect) return;

      if (Math.abs(e.deltaY) > 0.1) {
        const x = e.clientX - rect.left;
        const anchorMs = x2t(Math.max(0, x), tw);
        const factor = e.deltaY > 0 ? 1.2 : 1 / 1.2;
        za(anchorMs, factor);
      }

      if (Math.abs(e.deltaX) > 0.1) {
        const msPerPixel = dur / Math.max(1, tw);
        const deltaMs = -e.deltaX * msPerPixel;
        p(deltaMs);
      }
    };

    const onRowsWheel = (e: WheelEvent) => {
      const {
        xToTime: x2t,
        zoomAt: za,
        pan: p,
        durationMs: dur,
        timeAreaWidth: tw,
        labelWidth: lw,
      } = wheelDepsRef.current;
      const rect = rowsEl?.getBoundingClientRect();
      if (!rect) return;

      const wantsZoom = e.ctrlKey || e.metaKey;
      const wantsPan = Math.abs(e.deltaX) > Math.abs(e.deltaY);

      if (wantsZoom && Math.abs(e.deltaY) > 0.1) {
        e.preventDefault();
        const x = e.clientX - rect.left - lw;
        const anchorMs = x2t(Math.max(0, x), tw);
        const factor = e.deltaY > 0 ? 1.2 : 1 / 1.2;
        za(anchorMs, factor);
        return;
      }

      if (wantsPan && Math.abs(e.deltaX) > 0.1) {
        e.preventDefault();
        const msPerPixel = dur / Math.max(1, tw);
        const deltaMs = -e.deltaX * msPerPixel;
        p(deltaMs);
        return;
      }

      // Plain wheel — let the browser scroll the rows list vertically.
    };

    headerEl?.addEventListener("wheel", onHeaderWheel, { passive: false });
    rowsEl?.addEventListener("wheel", onRowsWheel, { passive: false });
    return () => {
      headerEl?.removeEventListener("wheel", onHeaderWheel);
      rowsEl?.removeEventListener("wheel", onRowsWheel);
    };
  }, []);

  const { eventsByPath, eventsBySource } = React.useMemo(() => {
    const byPath: Record<string, typeof eventsWithMs> = {};
    const bySource: Record<string, typeof eventsWithMs> = {};
    for (const item of eventsWithMs) {
      const path = topicPathFromEvent(item.ev.source, item.ev.type);
      const pathKey = topicPathDisplay(path);
      (byPath[pathKey] ??= []).push(item);
      (bySource[item.ev.source] ??= []).push(item);
    }
    return { eventsByPath: byPath, eventsBySource: bySource };
  }, [eventsWithMs]);

  /* In trace mode, the row's pathKey is the traceId; pre-build a
     lookup so getEventsForNode is O(1). */
  const eventsByTrace = React.useMemo(() => {
    const map: Record<string, typeof eventsWithMs> = {};
    for (const group of traceGroups) {
      const items: typeof eventsWithMs = [];
      const ids = new Set(group.events.map((e) => e.id));
      for (const item of eventsWithMs) {
        if (ids.has(item.ev.id)) items.push(item);
      }
      map[group.traceId] = items;
    }
    return map;
  }, [traceGroups, eventsWithMs]);

  const getEventsForNode = React.useCallback(
    (node: TopicTreeNode): typeof eventsWithMs => {
      if (groupBy === "trace") {
        return eventsByTrace[node.pathKey] ?? [];
      }
      if (node.path.segments.length === 1) {
        return eventsBySource[node.name] ?? [];
      }
      if (node.children.length === 0) {
        return eventsByPath[node.pathKey] ?? [];
      }
      const seen = new Set<string>();
      const result: typeof eventsWithMs = [];
      function collect(n: TopicTreeNode) {
        const items = eventsByPath[n.pathKey];
        if (items) {
          for (const item of items) {
            if (!seen.has(item.ev.id)) {
              seen.add(item.ev.id);
              result.push(item);
            }
          }
        }
        for (const child of n.children) collect(child);
      }
      collect(node);
      return result;
    },
    [groupBy, eventsByPath, eventsBySource, eventsByTrace],
  );

  /**
   * Bucket nearby events when zoomed out so a row never tries to render
   * thousands of marks. Marks within ~4 pixels collapse into a single
   * thicker bar; the most recent event in the bucket is the one used
   * for selection.
   */
  const getRowMarks = React.useCallback(
    (rowEvents: typeof eventsWithMs): StreamTimelineRowMark[] => {
      const visible = rowEvents.filter(
        (item) => item.ms >= startMs && item.ms <= endMs,
      );
      if (visible.length === 0) return [];

      if (visible.length <= MAX_MARKS_PER_ROW) {
        return visible.map((item, idx) => ({
          key: `${item.ev.id}_${idx}`,
          x: timeToX(item.ms, timeAreaWidth),
          count: 1,
          ev: item.ev,
        }));
      }

      const pxPerMs = timeAreaWidth / Math.max(1, durationMs);
      const bucketWidthMs = Math.max(1, 4 / pxPerMs);
      const sorted = [...visible].sort((a, b) => a.ms - b.ms);

      const marks: StreamTimelineRowMark[] = [];
      let bucketStart = sorted[0]!.ms;
      let bucketEvents = [sorted[0]!];

      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i]!.ms - bucketStart < bucketWidthMs) {
          bucketEvents.push(sorted[i]!);
        } else {
          const avgMs =
            bucketEvents.reduce((sum, e) => sum + e.ms, 0) / bucketEvents.length;
          marks.push({
            key: `b_${marks.length}_${bucketEvents[0]!.ev.id}`,
            x: timeToX(avgMs, timeAreaWidth),
            count: bucketEvents.length,
            ev: bucketEvents[bucketEvents.length - 1]!.ev,
          });
          bucketStart = sorted[i]!.ms;
          bucketEvents = [sorted[i]!];
        }
      }
      if (bucketEvents.length > 0) {
        const avgMs =
          bucketEvents.reduce((sum, e) => sum + e.ms, 0) / bucketEvents.length;
        marks.push({
          key: `b_${marks.length}_${bucketEvents[0]!.ev.id}`,
          x: timeToX(avgMs, timeAreaWidth),
          count: bucketEvents.length,
          ev: bucketEvents[bucketEvents.length - 1]!.ev,
        });
      }

      return marks;
    },
    [startMs, endMs, timeToX, timeAreaWidth, durationMs],
  );

  const handleSelectEvent = React.useCallback(
    (event: StreamTimelineEvent) => {
      const evMs = new Date(event.occurredAt).getTime();
      setPlayheadMs(evMs);
      onSelect?.({ eventId: event.id, event });
      onPlayheadChange?.({ time: event.occurredAt });
      onPlaybackChange?.("paused");
    },
    [onSelect, onPlayheadChange, onPlaybackChange],
  );

  const playheadX = timeToX(playheadMs, timeAreaWidth);
  const showPlayhead =
    playheadMs >= startMs && playheadMs <= endMs && timeAreaWidth > 0;

  /* Compute the tick set once per range so the axis and the row
     guideline overlay render perfectly aligned without each one
     re-deriving the layout. */
  const timelineTicks = React.useMemo(
    () => computeTimelineTicks(startMs, endMs, durationMs),
    [startMs, endMs, durationMs],
  );
  const majorTicks = React.useMemo(
    () => timelineTicks.filter((t) => t.kind === "major"),
    [timelineTicks],
  );

  const selectedEvent = React.useMemo<StreamTimelineEvent | null>(() => {
    if (!selectedEventId) return null;
    return events.find((e) => e.id === selectedEventId) ?? null;
  }, [events, selectedEventId]);

  const closeDetail = React.useCallback(() => {
    onSelect?.({ eventId: null, event: null });
  }, [onSelect]);

  const detailVisible =
    showDetailPanel && selectedEvent !== null && timeAreaWidth > 0;

  /* Derive the active-trace context from the current selection. Used
     by row highlighting (Layer 1), the toolbar chip, the detail
     sidebar's Trace tab (Layer 3), and the connector overlay (Layer 2). */
  const traceContext: TraceContext = React.useMemo(
    () => buildTraceContext(events, selectedEvent, traceKey),
    [events, selectedEvent, traceKey],
  );

  /* Effective trace id for membership lookups + dataset payloads.
     Resolves to `event.traceId` when present, otherwise the event's
     own id (trace-of-one). Same logic the picker uses when
     synthesizing the payload, so memberships line up either way. */
  const effectiveTraceId = React.useMemo(
    () =>
      resolveEffectiveTraceId(
        selectedEvent,
        traceContext.sortedEvents,
        traceKey,
      ),
    [selectedEvent, traceContext.sortedEvents, traceKey],
  );

  const traceDatasetMemberships = React.useMemo(() => {
    if (!getDatasetMembershipsForTrace || !effectiveTraceId) return [];
    return getDatasetMembershipsForTrace(effectiveTraceId);
  }, [getDatasetMembershipsForTrace, effectiveTraceId]);

  const activeTraceLabel = React.useMemo(() => {
    if (!traceContext.activeTraceId) return undefined;
    const labelled = traceContext.sortedEvents.find((e) => e.traceLabel);
    return (
      labelled?.traceLabel ??
      traceContext.activeTraceId.replace(/^trace_/, "Trace ")
    );
  }, [traceContext]);

  const clearActiveTrace = React.useCallback(() => {
    onSelect?.({ eventId: null, event: null });
  }, [onSelect]);

  const handleSelectTraceEvent = React.useCallback(
    (event: StreamTimelineEvent) => {
      handleSelectEvent(event);
    },
    [handleSelectEvent],
  );

  /* eventId → row index lookup, used by the connector overlay to
     position arc endpoints. Topic mode walks up the topic path until
     a visible row matches; trace mode is a direct trace-id lookup.
     Iterates `filteredEvents` since arcs only render for events that
     have a corresponding mark on the chart. */
  const rowIndexByEventId = React.useMemo(() => {
    const idx = new Map<string, number>();
    if (groupBy === "trace") {
      const rowByTrace = new Map<string, number>();
      visibleNodes.forEach((node, i) => rowByTrace.set(node.pathKey, i));
      for (const e of filteredEvents) {
        // Mirror the bucketing in `groupByTrace({ bucketSoloBySource })`
        // — solo events live in `__solo__source__<source>` rows now.
        const traceId =
          resolveTraceId(e, traceKey) ?? `__solo__source__${e.source}`;
        const rowIdx = rowByTrace.get(traceId);
        if (rowIdx !== undefined) idx.set(e.id, rowIdx);
      }
      return idx;
    }
    const rowByPath = new Map<string, number>();
    visibleNodes.forEach((node, i) => rowByPath.set(node.pathKey, i));
    for (const e of filteredEvents) {
      const path = topicPathFromEvent(e.source, e.type);
      const segments = path.segments.slice();
      let found: number | undefined;
      while (segments.length > 0) {
        const key = segments.join("/");
        const i = rowByPath.get(key);
        if (i !== undefined) {
          found = i;
          break;
        }
        segments.pop();
      }
      if (found !== undefined) idx.set(e.id, found);
    }
    return idx;
  }, [groupBy, visibleNodes, filteredEvents, traceKey]);

  /* Connector edges to render. When `connectorsVisibility="selected"`
     we only draw the active trace; with `"all"` we draw every trace
     in the dataset (capped by viewport culling inside the component). */
  const connectorEdges = React.useMemo(() => {
    if (!showConnectors) return [];
    if (connectorsVisibility === "selected") {
      if (!traceContext.activeTraceId) return [];
      return buildTraceEdges(traceContext.sortedEvents).map((edge) => ({
        ...edge,
        traceId: traceContext.activeTraceId!,
      }));
    }
    const out: Array<ReturnType<typeof buildTraceEdges>[number] & {
      traceId: string;
    }> = [];
    for (const group of traceGroups) {
      if (group.isSolo) continue;
      for (const edge of buildTraceEdges(group.events)) {
        out.push({ ...edge, traceId: group.traceId });
      }
    }
    return out;
  }, [showConnectors, connectorsVisibility, traceContext, traceGroups]);

  const eventByIdMap = React.useMemo(() => {
    const m = new Map<string, StreamTimelineEvent>();
    for (const e of filteredEvents) m.set(e.id, e);
    return m;
  }, [filteredEvents]);

  return (
    <div
      className={cx(
        "flex overflow-hidden rounded-md border border-hairline bg-page text-ink",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <StreamTimelineToolbar
          playback={playback}
          playheadMs={playheadMs}
          onPlaybackChange={onPlaybackChange}
          onFit={handleFit}
          leading={toolbarLeading}
          trailing={toolbarTrailing}
          activeTraceLabel={activeTraceLabel}
          activeTraceCount={
            traceContext.activeTraceId
              ? traceContext.sortedEvents.length
              : undefined
          }
          onClearActiveTrace={
            traceContext.activeTraceId ? clearActiveTrace : undefined
          }
          groupBy={onGroupByChange ? groupBy : undefined}
          onGroupByChange={onGroupByChange}
        />

        {showFilters ? (
          <StreamTimelineFilterBar
            columns={resolvedColumns}
            filters={filterStore.filters}
            actions={filterStore.actions}
            shownCount={filteredEvents.length}
            totalCount={events.length}
            onOpenDisplay={onOpenDisplay}
            displayChanged={displayChanged}
          />
        ) : null}

        <StreamTimelineAxis
          startMs={startMs}
          endMs={endMs}
          durationMs={durationMs}
          timeAreaWidth={timeAreaWidth}
          timeToX={timeToX}
          streamCount={visibleNodes.length}
          labelWidth={labelWidth}
          onTimeAreaClick={handleTimeAreaClick}
          onTimeAreaMouseDown={handleTimeAreaMouseDown}
          timeAreaRef={timeAreaRef}
          isDragging={isDragging}
          ticks={timelineTicks}
        />

        <div
          ref={rowsContainerRef}
          className="min-h-[200px] flex-1 overflow-y-auto"
        >
          <div className="relative min-h-full">
            {/* Major-tick guidelines — sit behind the rows and span the
                full content height so they scroll with the list. The
                row label gutter uses an opaque `bg-page` so guidelines
                stay confined to the time area visually. */}
            {timeAreaWidth > 0 ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0"
                style={{ left: labelWidth }}
              >
                {majorTicks.map((tick) => {
                  const x = timeToX(tick.ms, timeAreaWidth);
                  if (x < 0 || x > timeAreaWidth) return null;
                  return (
                    <span
                      key={tick.ms}
                      className="absolute inset-y-0 w-px bg-hairline/60"
                      style={{ left: x }}
                    />
                  );
                })}
              </div>
            ) : null}

            {visibleNodes.length === 0 ? (
              <div className="flex h-40 items-center justify-center font-mono text-mono-sm text-ink-dim">
                No events in the current view.
              </div>
            ) : (
              visibleNodes.map((node, idx) => {
                const hasChildren = node.children.length > 0;
                const rowEvents = getEventsForNode(node);
                const marks = getRowMarks(rowEvents);
                return (
                  <StreamTimelineRow
                    key={node.pathKey}
                    node={node}
                    index={idx}
                    marks={marks}
                    selectedEventId={selectedEventId}
                    collapsed={collapsedSet.has(node.pathKey)}
                    hasChildren={hasChildren}
                    onToggleCollapse={toggleCollapsed}
                    onSelectEvent={handleSelectEvent}
                    playheadX={playheadX}
                    showPlayhead={showPlayhead}
                    playback={playback}
                    traceSiblingIds={
                      traceContext.activeTraceId ? traceContext.siblings : null
                    }
                    labelWidth={labelWidth}
                    rowHeight={rowHeight}
                  />
                );
              })
            )}

            {/* Layer 2 — connector arcs between trace events. */}
            {showConnectors && timeAreaWidth > 0 ? (
              <StreamTimelineConnectors
                edges={connectorEdges}
                eventById={eventByIdMap}
                rowIndexByEventId={rowIndexByEventId}
                rowHeight={rowHeight}
                rowCount={visibleNodes.length}
                labelWidth={labelWidth}
                timeAreaWidth={timeAreaWidth}
                startMs={startMs}
                endMs={endMs}
                timeToX={timeToX}
                activeTraceId={traceContext.activeTraceId}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Inline detail sidebar — slides in when an event is selected. */}
      {showDetailPanel ? (
        <aside
          aria-label="Event detail"
          aria-hidden={!detailVisible}
          className={cx(
            "shrink-0 overflow-hidden border-l border-hairline bg-l-surface-bar transition-[width,opacity] duration-200 ease-out",
            detailVisible ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          style={{ width: detailVisible ? detailPanelWidth : 0 }}
        >
          <div className="flex h-full flex-col" style={{ width: detailPanelWidth }}>
            {renderDetailPanel ? (
              renderDetailPanel(selectedEvent, closeDetail)
            ) : (
              <StreamEventDetail
                event={selectedEvent}
                onClose={closeDetail}
                traceEvents={traceContext.sortedEvents}
                onSelectTraceEvent={handleSelectTraceEvent}
                datasets={datasets}
                onAddTraceToDataset={onAddTraceToDataset}
                traceDatasetMemberships={traceDatasetMemberships}
                className="h-full"
              />
            )}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
