"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import type { TraceEdge, TraceEdgeKind } from "./trace";
import type { StreamTimelineEvent } from "./types";

export interface StreamTimelineConnectorsEdge extends TraceEdge {
  /** Trace this edge belongs to — drives stroke color when multiple
   *  traces render simultaneously (`connectorsVisibility="all"`). */
  traceId: string;
}

export interface StreamTimelineConnectorsProps {
  edges: readonly StreamTimelineConnectorsEdge[];
  eventById: ReadonlyMap<string, StreamTimelineEvent>;
  /** Resolves the row index for an event id; events not on a visible
   *  row are skipped (their edges don't render). */
  rowIndexByEventId: ReadonlyMap<string, number>;
  rowHeight: number;
  rowCount: number;
  labelWidth: number;
  timeAreaWidth: number;
  startMs: number;
  endMs: number;
  timeToX: (ms: number, width: number) => number;
  /** When set, this trace's edges render at full intensity; others
   *  fade to a hint. When `null`, all edges share the same intensity. */
  activeTraceId: string | null;
  className?: string;
}

/**
 * StreamTimelineConnectors — SVG overlay that draws bezier arcs
 * between trace siblings.
 *
 * Visual grammar:
 *   • `causal` edges (parentEventId chain) — solid 1.5px stroke with
 *     an arrowhead on the destination side.
 *   • `sequential` edges (time-ordered fallback) — dashed 1px stroke,
 *     no arrowhead.
 *   • Both use `var(--c-event-violet)` so the trace coding stays
 *     consistent with the row highlight ring.
 *
 * The overlay covers the time area (right of the label gutter) and
 * spans the rows scroll content height. It is `pointer-events-none`
 * so it never blocks event-mark clicks below it.
 */
export function StreamTimelineConnectors({
  edges,
  eventById,
  rowIndexByEventId,
  rowHeight,
  rowCount,
  labelWidth,
  timeAreaWidth,
  startMs,
  endMs,
  timeToX,
  activeTraceId,
  className,
}: StreamTimelineConnectorsProps) {
  const totalHeight = Math.max(rowCount * rowHeight, rowHeight);

  const paths = React.useMemo(() => {
    const out: Array<{
      key: string;
      d: string;
      kind: TraceEdgeKind;
      traceId: string;
      faded: boolean;
    }> = [];

    for (const edge of edges) {
      const fromEvent = eventById.get(edge.fromId);
      const toEvent = eventById.get(edge.toId);
      if (!fromEvent || !toEvent) continue;

      const fromMs = new Date(fromEvent.occurredAt).getTime();
      const toMs = new Date(toEvent.occurredAt).getTime();

      // Viewport cull — skip if both endpoints are outside the visible
      // range. (Edges that *cross* the viewport still render, since at
      // least one endpoint is inside.)
      if (
        (fromMs < startMs && toMs < startMs) ||
        (fromMs > endMs && toMs > endMs)
      ) {
        continue;
      }

      const fromRow = rowIndexByEventId.get(edge.fromId);
      const toRow = rowIndexByEventId.get(edge.toId);
      if (fromRow === undefined || toRow === undefined) continue;

      const x1 = timeToX(fromMs, timeAreaWidth);
      const x2 = timeToX(toMs, timeAreaWidth);
      const y1 = fromRow * rowHeight + rowHeight / 2;
      const y2 = toRow * rowHeight + rowHeight / 2;

      const dx = x2 - x1;
      const sameRow = fromRow === toRow;

      // Curve geometry — kept subtle so arcs read as wires, not arcs:
      //
      //   sameRow   — a very gentle quadratic bow upward, capped at
      //               ~30% of the row height. Bow scales with the
      //               horizontal distance so short hops stay almost
      //               flat.
      //   crossRow  — a smooth horizontal S-curve via cubic bezier.
      //               Tangents leave each endpoint horizontally so
      //               the line reads as time-axis-respecting rather
      //               than peaked. Control points sit at 35%/65% of
      //               the horizontal span at each endpoint's row.
      let d: string;
      if (sameRow) {
        const bow = -Math.min(rowHeight * 0.3, Math.abs(dx) * 0.06);
        const midX = (x1 + x2) / 2;
        const midY = y1 + bow;
        d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
      } else {
        const c1x = x1 + dx * 0.35;
        const c2x = x1 + dx * 0.65;
        d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${c1x.toFixed(1)} ${y1.toFixed(1)}, ${c2x.toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
      }
      const faded =
        activeTraceId !== null && edge.traceId !== activeTraceId;

      out.push({ key: edge.id, d, kind: edge.kind, traceId: edge.traceId, faded });
    }

    return out;
  }, [
    edges,
    eventById,
    rowIndexByEventId,
    rowHeight,
    timeAreaWidth,
    startMs,
    endMs,
    timeToX,
    activeTraceId,
  ]);

  if (paths.length === 0) return null;

  return (
    <svg
      aria-hidden
      className={cx(
        "pointer-events-none absolute inset-y-0",
        className,
      )}
      style={{
        left: labelWidth,
        width: timeAreaWidth,
        height: totalHeight,
      }}
      viewBox={`0 0 ${Math.max(1, timeAreaWidth)} ${Math.max(1, totalHeight)}`}
      preserveAspectRatio="none"
    >
      <defs>
        <marker
          id="stl-connector-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path
            d="M 0 0 L 10 5 L 0 10 z"
            fill="var(--c-event-violet)"
          />
        </marker>
      </defs>
      {paths.map((p) => (
        <path
          key={p.key}
          d={p.d}
          fill="none"
          stroke="var(--c-event-violet)"
          strokeWidth={p.kind === "causal" ? 1.75 : 1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={p.faded ? 0.18 : 0.85}
          // Dotted curves — `0 N` with a round linecap renders as
          // perfect circles whose diameter matches strokeWidth, giving
          // a beaded look. Causal edges use a slightly tighter spacing
          // so the path reads as a single continuous arrow.
          strokeDasharray={p.kind === "causal" ? "0 4" : "0 5"}
          markerEnd={
            p.kind === "causal" ? "url(#stl-connector-arrow)" : undefined
          }
        />
      ))}
    </svg>
  );
}
