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
  const { startMs, endMs, durationMs, timeToX, xToTime, pan, zoomAt, fitToTimes, setRange, expandToInclude } = timeView;

  const hasInitialCentered = useRef(false);
  useEffect(() => {
    if (events.length === 0) {
      hasInitialCentered.current = false;
      return;
    }
    if (hasInitialCentered.current) return;
    hasInitialCentered.current = true;
    const times = events.map((e) => new Date(e.occurredAt).getTime());
    const latestMs = Math.max(...times);
    const half = 30 * 60 * 1000;
    setRange(latestMs - half, latestMs + half);
  }, [events, setRange]);

  const treeRoots = useMemo(() => buildTopicTree(events), [events]);
  const visibleNodes = useMemo(
    () => getVisibleNodes(treeRoots, collapsedSet),
    [treeRoots, collapsedSet]
  );

  const eventTimesMs = useMemo(
    () => events.map((e) => new Date(e.occurredAt).getTime()),
    [events]
  );

  useEffect(() => {
    if (playback !== "live") return;
    setPlayheadMs(Date.now());
    const interval = setInterval(() => {
      const now = Date.now();
      setPlayheadMs(now);
      expandToInclude(now, 0.1);
    }, 100);
    return () => clearInterval(interval);
  }, [playback, expandToInclude]);

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

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = timeAreaRef.current?.getBoundingClientRect();
      if (!rect) return;

      if (Math.abs(e.deltaY) > 0.1) {
        const x = e.clientX - rect.left;
        const anchorMs = xToTime(x, timeAreaWidth);
        const factor = e.deltaY > 0 ? 1.2 : 1 / 1.2;
        zoomAt(anchorMs, factor);
      }

      if (Math.abs(e.deltaX) > 0.1) {
        const msPerPixel = durationMs / Math.max(1, timeAreaWidth);
        const deltaMs = -e.deltaX * msPerPixel;
        pan(deltaMs);
      }
    },
    [xToTime, zoomAt, timeAreaWidth, durationMs, pan]
  );

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
    const byPath: Record<string, TimelineEvent[]> = {};
    const bySource: Record<string, TimelineEvent[]> = {};
    for (const ev of events) {
      const path = topicPathFromEvent(ev.source, ev.type);
      const pathKey = topicPathDisplay(path);
      if (!byPath[pathKey]) byPath[pathKey] = [];
      byPath[pathKey].push(ev);
      if (!bySource[ev.source]) bySource[ev.source] = [];
      bySource[ev.source].push(ev);
    }
    return { eventsByPath: byPath, eventsBySource: bySource };
  }, [events]);

  const getEventsForNode = useCallback(
    (node: TopicTreeNode): TimelineEvent[] => {
      if (node.path.segments.length === 1) {
        return eventsBySource[node.name] ?? [];
      }
      if (node.children.length === 0) {
        return eventsByPath[node.pathKey] ?? [];
      }
      const result: TimelineEvent[] = [];
      function collect(n: TopicTreeNode) {
        if (eventsByPath[n.pathKey]) result.push(...eventsByPath[n.pathKey]);
        for (const child of n.children) collect(child);
      }
      collect(node);
      return result;
    },
    [eventsByPath, eventsBySource]
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
          onClick={() => onPlaybackChange?.(playback === "playing" ? "paused" : "playing")}
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
          {playback === "playing" ? "⏸ Pause" : "▶ Play"}
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
          onWheel={handleWheel}
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

      <div style={{ flex: 1, overflowY: "auto", minHeight: 200 }}>
        {visibleNodes.map((node, idx) => {
          const pathKey = node.pathKey;
          const hasChildren = node.children.length > 0;
          const rowEvents = getEventsForNode(node);

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
                {rowEvents.map((ev) => {
                  const evMs = new Date(ev.occurredAt).getTime();
                  const x = timeToX(evMs, timeAreaWidth);
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlayheadMs(evMs);
                        onSelect?.({ eventId: ev.id, event: ev });
                        onPlayheadChange?.({ time: ev.occurredAt });
                        onPlaybackChange?.("paused");
                      }}
                      style={{
                        position: "absolute",
                        left: x - 4,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 8,
                        height: 14,
                        borderRadius: 2,
                        background: node.color,
                        border: selectedEventId === ev.id ? `2px solid ${TIMELINE_THEME.accent}` : "none",
                        cursor: "pointer",
                      }}
                      title={`${ev.type} ${ev.occurredAt}`}
                    />
                  );
                })}
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
                        background: playback === "live" ? TIMELINE_THEME.playhead : TIMELINE_THEME.accent,
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
