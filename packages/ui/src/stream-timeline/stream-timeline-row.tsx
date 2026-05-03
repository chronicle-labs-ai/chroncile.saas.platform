"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { cx } from "../utils/cx";
import { CompanyLogo } from "../icons/brand-icons";
import { DEFAULT_LABEL_WIDTH, DEFAULT_ROW_HEIGHT } from "./tick-format";
import type { StreamTimelineEvent, StreamPlaybackState } from "./types";
import type { TopicTreeNode } from "./topic-tree";
import { sourceTintedBackground } from "./source-color";

export interface StreamTimelineRowMark {
  key: string;
  /** Pixel X (from start of time area). */
  x: number;
  /** Number of events represented by the mark (>1 = bucketed). */
  count: number;
  /** Representative event used for selection/tooltip. */
  ev: StreamTimelineEvent;
}

export interface StreamTimelineRowProps {
  node: TopicTreeNode;
  /** Index used for zebra striping. */
  index: number;
  marks: readonly StreamTimelineRowMark[];
  selectedEventId: string | null;
  collapsed: boolean;
  /** When false, the chevron is hidden (no children). */
  hasChildren: boolean;
  onToggleCollapse: (pathKey: string) => void;
  onSelectEvent: (event: StreamTimelineEvent) => void;
  /** Pixel X for the playhead inside this row's time area. */
  playheadX: number;
  /** Whether the playhead should be drawn on this row. */
  showPlayhead: boolean;
  /** Drives the playhead color (paused vs live/playing). */
  playback: StreamPlaybackState;
  /** Set of event ids on the currently active trace. When `null`, no
   *  trace is active and marks render at full opacity (default). */
  traceSiblingIds?: ReadonlySet<string> | null;
  labelWidth?: number;
  rowHeight?: number;
  className?: string;
}

export function StreamTimelineRow({
  node,
  index,
  marks,
  selectedEventId,
  collapsed,
  hasChildren,
  onToggleCollapse,
  onSelectEvent,
  playheadX,
  showPlayhead,
  playback,
  traceSiblingIds = null,
  labelWidth = DEFAULT_LABEL_WIDTH,
  rowHeight = DEFAULT_ROW_HEIGHT,
  className,
}: StreamTimelineRowProps) {
  const isSourceRow = node.depth === 1;
  const indent = (node.depth - 1) * 16;
  const traceActive = traceSiblingIds !== null && traceSiblingIds.size > 0;

  return (
    <div
      className={cx(
        "relative flex items-center border-b border-hairline transition-colors",
        // Subtle stripe — uses /40 alpha so the major-tick guidelines
        // drawn under the rows show through as a soft grid.
        index % 2 === 0 ? "bg-transparent" : "bg-l-surface/40",
        "hover:bg-l-surface-hover",
        className,
      )}
      style={{ height: rowHeight }}
    >
      <div
        className="relative z-10 flex h-full shrink-0 items-center gap-s-2 bg-page pl-s-2 pr-s-2"
        style={{ width: labelWidth }}
      >
        <span style={{ width: indent }} aria-hidden />
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleCollapse(node.pathKey)}
            aria-label={collapsed ? `Expand ${node.name}` : `Collapse ${node.name}`}
            aria-expanded={!collapsed}
            className="inline-flex h-4 w-4 items-center justify-center rounded-xs text-ink-dim transition-colors hover:bg-l-surface-hover hover:text-ink-lo"
          >
            {collapsed ? (
              <ChevronRight className="h-3 w-3" aria-hidden />
            ) : (
              <ChevronDown className="h-3 w-3" aria-hidden />
            )}
          </button>
        ) : (
          <span className="inline-block h-4 w-4" aria-hidden />
        )}

        {isSourceRow ? (
          <CompanyLogo
            name={node.name}
            size={16}
            radius={3}
            fallbackBackground={sourceTintedBackground(node.color, 22)}
            fallbackColor="var(--c-ink-hi)"
            className="shrink-0"
            aria-hidden
          />
        ) : (
          <span
            aria-hidden
            className="inline-block h-2 w-2 shrink-0 rounded-xs"
            style={{ background: node.color }}
          />
        )}

        <span
          className={cx(
            "min-w-0 truncate font-mono text-mono",
            isSourceRow ? "text-ink-hi" : "text-ink-lo",
          )}
          title={node.pathKey}
        >
          {node.name}
          {hasChildren ? <span className="text-ink-dim"> /</span> : null}
        </span>

        {node.eventCount > 0 ? (
          <span className="ml-auto font-mono text-mono-xs text-ink-dim tabular-nums">
            {node.eventCount}
          </span>
        ) : null}
      </div>

      <div className="relative h-full min-w-0 flex-1">
        {marks.map((mark) => {
          const isSelected = selectedEventId === mark.ev.id;
          const inTrace = traceActive
            ? traceSiblingIds!.has(mark.ev.id)
            : false;
          const dimmed = traceActive && !inTrace;
          const width = mark.count > 1 ? Math.min(16, 6 + mark.count) : 8;
          const baseOpacity =
            mark.count > 1 ? Math.min(1, 0.6 + mark.count * 0.05) : 1;
          return (
            <button
              key={mark.key}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectEvent(mark.ev);
              }}
              title={
                mark.count > 1
                  ? `${mark.count} events`
                  : `${mark.ev.type} · ${mark.ev.occurredAt}`
              }
              aria-label={
                mark.count > 1
                  ? `${mark.count} ${node.name} events`
                  : `${node.name} ${mark.ev.type}`
              }
              data-in-trace={inTrace || undefined}
              className={cx(
                "absolute top-1/2 -translate-y-1/2 rounded-xs transition-[box-shadow,opacity,height]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember",
                isSelected ? "ring-2 ring-ember" : undefined,
                inTrace && !isSelected
                  ? "ring-1 ring-event-violet/80 ring-offset-1 ring-offset-page"
                  : undefined,
                inTrace ? "h-4" : "h-3.5",
              )}
              style={{
                left: mark.x - width / 2,
                width,
                background: node.color,
                opacity: dimmed ? 0.18 : baseOpacity,
              }}
            />
          );
        })}
        {showPlayhead ? (
          <div
            aria-hidden
            className={cx(
              "pointer-events-none absolute inset-y-0 w-0.5",
              playback === "paused" ? "bg-event-teal" : "bg-ember",
            )}
            style={{ left: playheadX - 1 }}
          />
        ) : null}
      </div>
    </div>
  );
}
