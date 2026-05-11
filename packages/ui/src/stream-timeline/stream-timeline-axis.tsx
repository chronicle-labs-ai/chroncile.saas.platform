"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import {
  DEFAULT_LABEL_WIDTH,
  HEADER_HEIGHT,
  MAJOR_TICK_HEIGHT,
  MINOR_TICK_HEIGHT,
  computeTimelineTicks,
  formatRangeBookend,
  formatTickLabel,
  type TimelineTick,
} from "./tick-format";

export interface StreamTimelineAxisProps {
  startMs: number;
  endMs: number;
  durationMs: number;
  timeAreaWidth: number;
  timeToX: (ms: number, width: number) => number;
  /** Total visible-stream count, shown left-of-axis. */
  streamCount: number;
  labelWidth?: number;
  /** Native click handler — used by the viewer to scrub the playhead. */
  onTimeAreaClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Mouse-down for drag-to-pan. */
  onTimeAreaMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Forwarded ref to the time-area element so the viewer can attach
   *  ResizeObserver and a non-passive wheel listener. */
  timeAreaRef: React.RefObject<HTMLDivElement | null>;
  /** When true, the cursor on the time area becomes `grabbing`. */
  isDragging: boolean;
  /** Pre-computed ticks. When omitted the axis computes its own; the
   *  viewer passes them in so the row guidelines can reuse the list. */
  ticks?: readonly TimelineTick[];
  className?: string;
}

/**
 * StreamTimelineAxis — Chronicle ruler.
 *
 * Renders a two-tier ruler with hanging tick marks (no full-height
 * vertical guides — those are drawn behind the rows by the viewer).
 * Labels sit above the ruler on a `bg-l-surface-bar-2` strip; tick
 * marks hang off the bottom hairline so the axis reads as a proper
 * scale rather than a striped bar.
 *
 * The bookend readouts on the corners give scrolling-by-day context
 * even when the labels show only `HH:MM`.
 */
export function StreamTimelineAxis({
  startMs,
  endMs,
  durationMs,
  timeAreaWidth,
  timeToX,
  streamCount,
  labelWidth = DEFAULT_LABEL_WIDTH,
  onTimeAreaClick,
  onTimeAreaMouseDown,
  timeAreaRef,
  isDragging,
  ticks: ticksProp,
  className,
}: StreamTimelineAxisProps) {
  const durationSecs = durationMs / 1000;

  const ticks = React.useMemo<readonly TimelineTick[]>(() => {
    if (ticksProp) return ticksProp;
    return computeTimelineTicks(startMs, endMs, durationMs);
  }, [ticksProp, startMs, endMs, durationMs]);

  const startLabel = formatRangeBookend(durationMs, startMs);
  const endLabel = formatRangeBookend(durationMs, endMs);

  return (
    <div
      className={cx(
        "flex shrink-0 border-b border-hairline bg-l-surface-bar-2",
        className,
      )}
      style={{ height: HEADER_HEIGHT }}
    >
      {/* ── Left gutter: streams count + range start bookend ── */}
      <div
        className="relative flex flex-col justify-between border-r border-hairline px-s-3 py-s-1"
        style={{ width: labelWidth }}
      >
        <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
          Streams
          <span className="ml-1 text-ink-faint">({streamCount})</span>
        </span>
        <span
          className="font-mono text-mono-xs uppercase tracking-tactical text-ink-faint tabular-nums"
          aria-label="Visible range start"
        >
          {startLabel}
        </span>
      </div>

      {/* ── Ruler ── */}
      <div
        ref={timeAreaRef}
        role="presentation"
        onClick={onTimeAreaClick}
        onMouseDown={onTimeAreaMouseDown}
        className={cx(
          "group relative h-full flex-1 select-none",
          isDragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        {/* Baseline hairline that anchors the tick marks. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-hairline-strong"
        />

        {/* Subtle ember accent at the right edge — signals "now-ward". */}
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 h-px w-s-12 bg-gradient-to-l from-ember/40 to-transparent"
        />

        {ticks.map((tick) => {
          const x = timeToX(tick.ms, timeAreaWidth);
          if (x < -8 || x > timeAreaWidth + 8) return null;
          if (tick.kind === "major") {
            return (
              <React.Fragment key={`maj_${tick.ms}`}>
                <span
                  aria-hidden
                  className="pointer-events-none absolute bottom-0 w-px bg-ink-dim/70"
                  style={{ left: x, height: MAJOR_TICK_HEIGHT }}
                />
                <span
                  className="pointer-events-none absolute top-1.5 -translate-x-1/2 font-mono text-mono-xs uppercase tracking-tactical text-ink-lo tabular-nums"
                  style={{ left: x }}
                >
                  {formatTickLabel(durationSecs, tick.ms)}
                </span>
              </React.Fragment>
            );
          }
          return (
            <span
              key={`min_${tick.ms}`}
              aria-hidden
              className="pointer-events-none absolute bottom-0 w-px bg-ink-dim/30"
              style={{ left: x, height: MINOR_TICK_HEIGHT }}
            />
          );
        })}

        {/* Right-edge bookend readout. */}
        <span
          className="pointer-events-none absolute right-s-2 top-1/2 -translate-y-1/2 font-mono text-mono-xs uppercase tracking-tactical text-ink-faint tabular-nums opacity-0 transition-opacity group-hover:opacity-100"
          aria-label="Visible range end"
        >
          {endLabel}
        </span>
      </div>
    </div>
  );
}
