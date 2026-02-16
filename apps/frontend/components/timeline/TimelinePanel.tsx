"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PlaybackState, SelectionEvent, PlayheadEvent, TimeRangeEvent, TimelineEvent } from "./types";
import {
  DEFAULT_ROW_HEIGHT,
  HEADER_HEIGHT,
  TIMELINE_THEME,
  getTickIntervalMs,
  formatTickLabel,
} from "./constants";
import { useTimeView } from "./useTimeView";
import {
  buildTopicTree,
  getVisibleNodes,
  topicPathFromEvent,
  topicPathDisplay,
  type TopicTreeNode,
} from "./topicTree";

export interface TimelinePanelProps {
  events: TimelineEvent[];
  playback?: PlaybackState;
  selectedEventId: string | null;
  onPlaybackChange?: (state: PlaybackState) => void;
  onSelect?: (e: SelectionEvent) => void;
  onPlayheadChange?: (e: PlayheadEvent) => void;
  onRangeChange?: (e: TimeRangeEvent) => void;
  className?: string;
}

export function TimelinePanel({
  events,
  playback = "paused",
  selectedEventId,
  onPlaybackChange,
  onSelect,
  onPlayheadChange,
  onRangeChange,
  className = "",
}: TimelinePanelProps) {
  const [playheadMs, setPlayheadMs] = useState(() => Date.now());
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const timeAreaRef = useRef<HTMLDivElement>(null);
  const rowsContainerRef = useRef<HTMLDivElement>(null);
  const [timeAreaWidth, setTimeAreaWidth] = useState(600);
  const labelWidth = 200;

  useEffect(() => {
    const el = timeAreaRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 600;
      setTimeAreaWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const timeView = useTimeView();
  const { startMs, endMs, durationMs, timeToX, xToTime, pan, zoomAt, fitToTimes, setRange } = timeView;

  /* Pre-compute event timestamps once */
  const eventsWithMs = useMemo(
    () => events.map((ev) => ({ ev, ms: new Date(ev.occurredAt).getTime() })),
    [events]
  );

  const eventTimesMs = useMemo(
    () => eventsWithMs.map((item) => item.ms),
    [eventsWithMs]
  );

  const hasInitialCentered = useRef(false);
  useEffect(() => {
    if (eventTimesMs.length === 0) {
      hasInitialCentered.current = false;
      return;
    }
    // Don't override range during active playback — the auto-follow handles it
    if (playback !== "paused") return;
    if (hasInitialCentered.current) return;
    hasInitialCentered.current = true;
    const latestMs = Math.max(...eventTimesMs);
    const half = 30 * 60 * 1000;
    setRange(latestMs - half, latestMs + half);
  }, [eventTimesMs, setRange, playback]);

  const treeRoots = useMemo(() => buildTopicTree(events), [events]);
  const visibleNodes = useMemo(
    () => getVisibleNodes(treeRoots, collapsedSet),
    [treeRoots, collapsedSet]
  );

  /* Auto-follow playhead for both "playing" and "live" modes.
     Uses a sliding window: the playhead stays at ~75% of the view width.
     When the playhead would exceed 75%, we pan the window forward (keeping
     the zoom level constant) rather than expanding the range wider. */
  const prevPlaybackRef = useRef<PlaybackState>("paused");
  // Keep a live ref to the current time view so the interval can read it
  // without re-creating the effect on every range change.
  const timeViewRef = useRef({ centerMs: timeView.centerMs, halfWidthMs: timeView.halfWidthMs });
  timeViewRef.current = { centerMs: timeView.centerMs, halfWidthMs: timeView.halfWidthMs };

  useEffect(() => {
    if (playback === "paused") {
      prevPlaybackRef.current = "paused";
      return;
    }

    const wasPaused = prevPlaybackRef.current === "paused";
    prevPlaybackRef.current = playback;

    // When entering playing/live from paused, zoom to a tight window around now
    if (wasPaused) {
      const now = Date.now();
      const half = 10_000; // ±10 seconds = 20 second window
      // Position so playhead is at 75% of the window
      setRange(now - half * 1.5, now + half * 0.5);
      setPlayheadMs(now);
      // Mark initial centering done so it won't override after pause
      hasInitialCentered.current = true;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      setPlayheadMs(now);

      // Sliding window: keep playhead at ~75% of the view.
      const { centerMs: c, halfWidthMs: h } = timeViewRef.current;
      const viewStart = c - h;
      const viewDuration = h * 2;

      // If playhead is past 75% of the view, slide forward
      const threshold = viewStart + viewDuration * 0.75;
      if (now > threshold) {
        // Pan so playhead sits at 75%, keeping same zoom level
        const newStart = now - viewDuration * 0.75;
        setRange(newStart, newStart + viewDuration);
      }
    }, 60);
    return () => clearInterval(interval);
  }, [playback, setRange]);

  const toggleCollapsed = useCallback((pathKey: string) => {
    setCollapsedSet((prev) => {
      const next = new Set(prev);
      if (next.has(pathKey)) next.delete(pathKey);
      else next.add(pathKey);
      return next;
    });
  }, []);

  const handleFit = useCallback(() => {
    if (eventTimesMs.length > 0) fitToTimes(eventTimesMs, 0.1);
    onRangeChange?.({
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
    });
  }, [eventTimesMs, fitToTimes, startMs, endMs, onRangeChange]);

  const handleTimeAreaClick = useCallback(
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
    [xToTime, timeAreaWidth, onPlayheadChange, onPlaybackChange, isDragging]
  );

  const handleTimeAreaMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStartX(e.clientX);
  }, []);

  useEffect(() => {
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

  /* Native wheel handler — must be non-passive so preventDefault works.
     Attached to both the header time area and the rows container so zoom
     works anywhere on the timeline. */
  const wheelDepsRef = useRef({ xToTime, zoomAt, pan, durationMs, timeAreaWidth, labelWidth });
  wheelDepsRef.current = { xToTime, zoomAt, pan, durationMs, timeAreaWidth, labelWidth };

  useEffect(() => {
    const headerEl = timeAreaRef.current;
    const rowsEl = rowsContainerRef.current;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { xToTime: x2t, zoomAt: za, pan: p, durationMs: dur, timeAreaWidth: tw, labelWidth: lw } = wheelDepsRef.current;

      // For the header area, use the element rect directly.
      // For rows, offset by the label column width.
      let rect: DOMRect | undefined;
      let xOffset = 0;
      if (headerEl && headerEl.contains(e.target as Node)) {
        rect = headerEl.getBoundingClientRect();
      } else {
        rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        xOffset = lw; // rows have the label column on the left
      }
      if (!rect) return;

      if (Math.abs(e.deltaY) > 0.1) {
        const x = e.clientX - rect.left - xOffset;
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

    if (headerEl) headerEl.addEventListener("wheel", onWheel, { passive: false });
    if (rowsEl) rowsEl.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      if (headerEl) headerEl.removeEventListener("wheel", onWheel);
      if (rowsEl) rowsEl.removeEventListener("wheel", onWheel);
    };
  }, []);

  const majorIntervalMs = getTickIntervalMs(durationMs);
  const durationSecs = durationMs / 1000;
  const ticks: number[] = useMemo(() => {
    const firstTickMs =
      Math.floor(startMs / majorIntervalMs) * majorIntervalMs + majorIntervalMs;
    const out: number[] = [];
    for (let t = firstTickMs; t <= endMs; t += majorIntervalMs) out.push(t);
    return out;
  }, [startMs, endMs, majorIntervalMs]);


  const { eventsByPath, eventsBySource } = useMemo(() => {
    const byPath: Record<string, typeof eventsWithMs> = {};
    const bySource: Record<string, typeof eventsWithMs> = {};
    for (const item of eventsWithMs) {
      const path = topicPathFromEvent(item.ev.source, item.ev.type);
      const pathKey = topicPathDisplay(path);
      if (!byPath[pathKey]) byPath[pathKey] = [];
      byPath[pathKey].push(item);
      if (!bySource[item.ev.source]) bySource[item.ev.source] = [];
      bySource[item.ev.source].push(item);
    }
    return { eventsByPath: byPath, eventsBySource: bySource };
  }, [eventsWithMs]);

  const getEventsForNode = useCallback(
    (node: TopicTreeNode): typeof eventsWithMs => {
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
    [eventsByPath, eventsBySource]
  );

  /**
   * For a row's events, return only the marks to render:
   * - Cull events outside the visible time range
   * - Bucket nearby events into single marks when zoomed out
   * Returns { key, x, count, ev } for each mark to render.
   */
  const MAX_MARKS_PER_ROW = 200;
  const getRowMarks = useCallback(
    (rowEvents: typeof eventsWithMs, color: string) => {
      // Viewport cull
      const visible = rowEvents.filter(
        (item) => item.ms >= startMs && item.ms <= endMs
      );
      if (visible.length === 0) return [];

      // If few enough, render individually
      if (visible.length <= MAX_MARKS_PER_ROW) {
        return visible.map((item, idx) => ({
          key: `${item.ev.id}_${idx}`,
          x: timeToX(item.ms, timeAreaWidth),
          count: 1,
          ev: item.ev,
        }));
      }

      // Bucket nearby events — merge events that would be < 4px apart
      const pxPerMs = timeAreaWidth / Math.max(1, durationMs);
      const bucketWidthMs = Math.max(1, 4 / pxPerMs);
      const sorted = [...visible].sort((a, b) => a.ms - b.ms);

      const marks: { key: string; x: number; count: number; ev: TimelineEvent }[] = [];
      let bucketStart = sorted[0].ms;
      let bucketEvents: typeof visible = [sorted[0]];

      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].ms - bucketStart < bucketWidthMs) {
          bucketEvents.push(sorted[i]);
        } else {
          // Flush bucket
          const avgMs =
            bucketEvents.reduce((sum, e) => sum + e.ms, 0) / bucketEvents.length;
          marks.push({
            key: `b_${marks.length}_${bucketEvents[0].ev.id}`,
            x: timeToX(avgMs, timeAreaWidth),
            count: bucketEvents.length,
            ev: bucketEvents[bucketEvents.length - 1].ev, // latest event for selection
          });
          bucketStart = sorted[i].ms;
          bucketEvents = [sorted[i]];
        }
      }
      // Flush last bucket
      if (bucketEvents.length > 0) {
        const avgMs =
          bucketEvents.reduce((sum, e) => sum + e.ms, 0) / bucketEvents.length;
        marks.push({
          key: `b_${marks.length}_${bucketEvents[0].ev.id}`,
          x: timeToX(avgMs, timeAreaWidth),
          count: bucketEvents.length,
          ev: bucketEvents[bucketEvents.length - 1].ev,
        });
      }

      return marks;
    },
    [startMs, endMs, timeToX, timeAreaWidth, durationMs]
  );

  return (
    <div
      className={className}
      style={{
        background: TIMELINE_THEME.bg_primary,
        color: TIMELINE_THEME.text_primary,
        borderRadius: 6,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 12px",
          background: TIMELINE_THEME.bg_elevated,
          borderBottom: `1px solid ${TIMELINE_THEME.separator}`,
        }}
      >
        <button
          type="button"
          onClick={() => onPlaybackChange?.(playback === "paused" ? "playing" : "paused")}
          style={{
            background: playback === "playing" ? TIMELINE_THEME.button_active : TIMELINE_THEME.button_bg,
            color: TIMELINE_THEME.text_primary,
            border: "none",
            padding: "4px 10px",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          {playback !== "paused" ? "⏸ Pause" : "▶ Play"}
        </button>
        <button
          type="button"
          onClick={() => onPlaybackChange?.("live")}
          style={{
            background: playback === "live" ? TIMELINE_THEME.button_active : TIMELINE_THEME.button_bg,
            color: TIMELINE_THEME.text_primary,
            border: "none",
            padding: "4px 10px",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Live
        </button>
        <button
          type="button"
          onClick={handleFit}
          style={{
            background: TIMELINE_THEME.button_bg,
            color: TIMELINE_THEME.text_primary,
            border: "none",
            padding: "4px 10px",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Fit
        </button>
        <span style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: 12, color: TIMELINE_THEME.text_muted }}>
          {new Date(playheadMs).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            fractionalSecondDigits: 3,
            hour12: false,
          })}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          height: HEADER_HEIGHT,
          background: TIMELINE_THEME.bg_surface,
          borderBottom: `1px solid ${TIMELINE_THEME.separator}`,
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: labelWidth,
            paddingLeft: 12,
            fontSize: 11,
            textTransform: "uppercase",
            color: TIMELINE_THEME.text_muted,
          }}
        >
          STREAMS ({visibleNodes.length})
        </div>
        <div
          ref={timeAreaRef}
          style={{
            flex: 1,
            position: "relative",
            height: "100%",
            cursor: isDragging ? "grabbing" : "grab",
          }}
          onClick={handleTimeAreaClick}
          onMouseDown={handleTimeAreaMouseDown}
          role="presentation"
        >
            {ticks.map((t) => {
              const x = timeToX(t, timeAreaWidth);
              return (
                <div
                  key={t}
                  style={{
                    position: "absolute",
                    left: x,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: TIMELINE_THEME.separator,
                  }}
                />
              );
            })}
            {ticks.map((t) => {
              const x = timeToX(t, timeAreaWidth);
              const label = formatTickLabel(durationSecs, t);
              return (
                <span
                  key={t}
                  style={{
                    position: "absolute",
                    left: x + 4,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 10,
                    fontFamily: "monospace",
                    color: TIMELINE_THEME.text_muted,
                  }}
                >
                  {label}
                </span>
              );
            })}
        </div>
      </div>

      <div ref={rowsContainerRef} style={{ flex: 1, overflowY: "auto", minHeight: 200 }}>
        {visibleNodes.map((node, idx) => {
          const pathKey = node.pathKey;
          const hasChildren = node.children.length > 0;
          const rowEvents = getEventsForNode(node);
          const marks = getRowMarks(rowEvents, node.color);

          return (
            <div
              key={pathKey}
              style={{
                display: "flex",
                height: DEFAULT_ROW_HEIGHT,
                background: idx % 2 === 0 ? TIMELINE_THEME.bg_primary : TIMELINE_THEME.bg_row_alt,
                alignItems: "center",
                borderBottom: `1px solid ${TIMELINE_THEME.separator}`,
                cursor: "default",
              }}
            >
              <div
                style={{
                  width: labelWidth,
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: 8,
                  gap: 4,
                }}
              >
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(pathKey)}
                    style={{
                      background: "none",
                      border: "none",
                      color: TIMELINE_THEME.chevron,
                      cursor: "pointer",
                      padding: 0,
                      fontSize: 10,
                    }}
                  >
                    {collapsedSet.has(pathKey) ? "▶" : "▼"}
                  </button>
                ) : (
                  <span style={{ width: 14 }} />
                )}
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: node.color,
                  }}
                />
                <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {node.name}
                  {hasChildren ? " /" : ""}
                </span>
              </div>
              <div
                style={{
                  flex: 1,
                  position: "relative",
                  height: "100%",
                  minWidth: 0,
                }}
              >
                {marks.map((mark) => (
                  <button
                    key={mark.key}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const evMs = new Date(mark.ev.occurredAt).getTime();
                      setPlayheadMs(evMs);
                      onSelect?.({ eventId: mark.ev.id, event: mark.ev });
                      onPlayheadChange?.({ time: mark.ev.occurredAt });
                      onPlaybackChange?.("paused");
                    }}
                    style={{
                      position: "absolute",
                      left: mark.x - 4,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: mark.count > 1 ? Math.min(16, 6 + mark.count) : 8,
                      height: 14,
                      borderRadius: 2,
                      background: node.color,
                      opacity: mark.count > 1 ? Math.min(1, 0.6 + mark.count * 0.05) : 1,
                      border: selectedEventId === mark.ev.id ? `2px solid ${TIMELINE_THEME.accent}` : "none",
                      cursor: "pointer",
                    }}
                    title={mark.count > 1 ? `${mark.count} events` : `${mark.ev.type} ${mark.ev.occurredAt}`}
                  />
                ))}
                {(() => {
                  const px = timeToX(playheadMs, timeAreaWidth);
                  return (
                    <div
                      style={{
                        position: "absolute",
                        left: px - 1,
                        top: 0,
                        bottom: 0,
                        width: 2,
                        background: playback === "paused" ? TIMELINE_THEME.accent : TIMELINE_THEME.playhead,
                        pointerEvents: "none",
                      }}
                    />
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
