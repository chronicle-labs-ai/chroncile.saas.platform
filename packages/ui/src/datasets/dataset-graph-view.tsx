"use client";

import * as React from "react";
import { Maximize2, Minus, Plus } from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import { CompanyLogo } from "../icons";
import { formatNumber } from "../connections/time";

import { DatasetEmpty } from "./dataset-empty";
import { DatasetSplitChip } from "./dataset-split-chip";
import { findNearestNode, type ClusterCentroid, type GraphLayout, type GraphNode } from "./graph-layout";
import { formatTraceDuration } from "./dataset-traces-table-row";
import { useGraphSimulation } from "./use-graph-simulation";
import type { DatasetSnapshot, TraceStatus, TraceSummary } from "./types";

/*
 * DatasetGraphView — Canvas-2D scatter for inspecting traces in a
 * dataset. Inspired by the umap-explorer interaction model: smooth
 * pan/zoom, hover *anywhere* on a point to surface a rich preview
 * card, click to drill in.
 *
 * Why canvas, not SVG: with 60–500 nodes, SVG hover/drag jitters
 * because every node is a real DOM node + listener. Canvas redraws
 * the whole scene per frame in well under 1 ms and uses a single
 * pointer listener on the parent — hover reads as instantaneous.
 *
 * Why no physics any more: positions come from a deterministic
 * phyllotaxis layout in `graph-layout.ts` so reloads don't shuffle
 * the cloud and the canvas can re-draw without re-solving.
 */

export interface DatasetGraphViewProps {
  snapshot: DatasetSnapshot;
  /** Selected trace id — drives the ember selection ring. */
  selectedTraceId?: string | null;
  onSelectTrace?: (traceId: string | null) => void;
  /** Logical layout dimensions. Defaults to (960, 600). */
  width?: number;
  height?: number;
  className?: string;
}

interface ViewState {
  tx: number;
  ty: number;
  zoom: number;
}

const DEFAULT_VIEW: ViewState = { tx: 0, ty: 0, zoom: 1 };
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4;

export function DatasetGraphView({
  snapshot,
  selectedTraceId,
  onSelectTrace,
  width = 960,
  height = 600,
  className,
}: DatasetGraphViewProps) {
  const { layout } = useGraphSimulation(snapshot, { width, height });
  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const labelsRef = React.useRef<HTMLCanvasElement>(null);
  const [hoveredNode, setHoveredNode] = React.useState<GraphNode | null>(null);
  const [hoverPos, setHoverPos] = React.useState<{ x: number; y: number } | null>(
    null,
  );
  const [view, setView] = React.useState<ViewState>(DEFAULT_VIEW);
  const [revealed, setRevealed] = React.useState(false);
  const dragRef = React.useRef<{
    startX: number;
    startY: number;
    origView: ViewState;
    moved: boolean;
  } | null>(null);

  React.useEffect(() => {
    setRevealed(false);
    const id = window.setTimeout(() => setRevealed(true), 30);
    return () => window.clearTimeout(id);
  }, [snapshot.dataset.id]);

  // Adjacency lookup for hover dimming and edge highlight.
  const adjacency = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const edge of layout.edges) {
      if (!map.has(edge.fromId)) map.set(edge.fromId, new Set());
      if (!map.has(edge.toId)) map.set(edge.toId, new Set());
      map.get(edge.fromId)!.add(edge.toId);
      map.get(edge.toId)!.add(edge.fromId);
    }
    return map;
  }, [layout.edges]);

  const focusId = hoveredNode?.id ?? selectedTraceId ?? null;

  const isFocused = React.useCallback(
    (nodeId: string): boolean => {
      if (!focusId) return true;
      if (nodeId === focusId) return true;
      return adjacency.get(focusId)?.has(nodeId) ?? false;
    },
    [focusId, adjacency],
  );

  /* ── Drawing ──────────────────────────────────────────────── */

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const labels = labelsRef.current;
    if (!canvas || !labels) return;

    drawScene(canvas, layout, view, {
      hoveredId: hoveredNode?.id ?? null,
      selectedId: selectedTraceId ?? null,
      focusId,
      isFocused,
    });
    drawClusterLabels(labels, layout, view);
  }, [layout, view, hoveredNode, selectedTraceId, focusId, isFocused]);

  // Resize observer keeps the canvas pixel buffer in sync with
  // the CSS-rendered size + DPR.
  React.useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const labels = labelsRef.current;
    if (!container || !canvas || !labels) return;

    const sync = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const cssW = Math.max(rect.width, 1);
      const cssH = Math.max(rect.height, 1);
      [canvas, labels].forEach((el) => {
        el.width = Math.floor(cssW * dpr);
        el.height = Math.floor(cssH * dpr);
        el.style.width = `${cssW}px`;
        el.style.height = `${cssH}px`;
      });
      // Re-draw immediately after a resize.
      drawScene(canvas, layout, view, {
        hoveredId: hoveredNode?.id ?? null,
        selectedId: selectedTraceId ?? null,
        focusId,
        isFocused,
      });
      drawClusterLabels(labels, layout, view);
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(container);
    return () => ro.disconnect();
  }, [layout, view, hoveredNode, selectedTraceId, focusId, isFocused]);

  /* ── Coordinate helpers ────────────────────────────────────── */

  const screenToLayout = React.useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container) return { x: 0, y: 0 };
      const rect = container.getBoundingClientRect();
      const scale = computeScale(rect, layout, view);
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;
      return {
        x: (cx - scale.offsetX - view.tx) / (scale.fit * view.zoom),
        y: (cy - scale.offsetY - view.ty) / (scale.fit * view.zoom),
      };
    },
    [layout, view],
  );

  /* ── Pointer interactions ──────────────────────────────────── */

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      if (dragRef.current) {
        const dx = event.clientX - dragRef.current.startX;
        const dy = event.clientY - dragRef.current.startY;
        if (!dragRef.current.moved && Math.hypot(dx, dy) > 4) {
          dragRef.current.moved = true;
          setHoveredNode(null);
        }
        if (dragRef.current.moved) {
          setView({
            tx: dragRef.current.origView.tx + dx,
            ty: dragRef.current.origView.ty + dy,
            zoom: dragRef.current.origView.zoom,
          });
        }
        return;
      }
      const rect = container.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const layoutPoint = screenToLayout(event.clientX, event.clientY);
      const node = findNearestNode(
        layout,
        layoutPoint.x,
        layoutPoint.y,
        // Pick radius scales with zoom so it always feels generous on
        // screen, no matter how zoomed-out we are.
        18 / view.zoom,
      );
      setHoveredNode(node);
      setHoverPos({ x: localX, y: localY });
    },
    [layout, screenToLayout, view.zoom],
  );

  const handlePointerLeave = React.useCallback(() => {
    setHoveredNode(null);
    setHoverPos(null);
  }, []);

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        origView: view,
        moved: false,
      };
      (event.target as Element).setPointerCapture(event.pointerId);
    },
    [view],
  );

  const handlePointerUp = React.useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      try {
        (event.target as Element).releasePointerCapture(event.pointerId);
      } catch {
        /* not captured — click without drag */
      }
      if (!drag || drag.moved) return;
      // Click without drag — toggle selection on the hovered node.
      const node = hoveredNode;
      if (!node) {
        onSelectTrace?.(null);
        return;
      }
      onSelectTrace?.(node.id === selectedTraceId ? null : node.id);
    },
    [hoveredNode, onSelectTrace, selectedTraceId],
  );

  const handleWheel = React.useCallback(
    (event: React.WheelEvent) => {
      event.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const scale = computeScale(rect, layout, view);
      // Zoom around the cursor so points stay visually anchored.
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const direction = event.deltaY > 0 ? -1 : 1;
      const factor = Math.exp(direction * 0.18);
      setView((prev) => {
        const nextZoom = clamp(prev.zoom * factor, MIN_ZOOM, MAX_ZOOM);
        if (nextZoom === prev.zoom) return prev;
        const ratio = nextZoom / prev.zoom;
        // Keep the world-point under the cursor stable.
        const tx =
          localX -
          scale.offsetX -
          (localX - scale.offsetX - prev.tx) * ratio;
        const ty =
          localY -
          scale.offsetY -
          (localY - scale.offsetY - prev.ty) * ratio;
        return { tx, ty, zoom: nextZoom };
      });
    },
    [layout, view],
  );

  const resetView = React.useCallback(() => {
    setView(DEFAULT_VIEW);
  }, []);

  const zoomBy = React.useCallback(
    (factor: number) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const scale = computeScale(rect, layout, view);
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      setView((prev) => {
        const nextZoom = clamp(prev.zoom * factor, MIN_ZOOM, MAX_ZOOM);
        if (nextZoom === prev.zoom) return prev;
        const ratio = nextZoom / prev.zoom;
        const tx = cx - scale.offsetX - (cx - scale.offsetX - prev.tx) * ratio;
        const ty = cy - scale.offsetY - (cy - scale.offsetY - prev.ty) * ratio;
        return { tx, ty, zoom: nextZoom };
      });
    },
    [layout, view],
  );

  /* ── Render ────────────────────────────────────────────────── */

  if (snapshot.traces.length === 0) {
    return (
      <div
        className={cx(
          "flex h-full min-h-[280px] items-center justify-center bg-l-surface",
          className,
        )}
      >
        <DatasetEmpty variant="detail" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cx(
        "relative flex h-full min-h-[320px] flex-col overflow-hidden bg-l-surface",
        revealed
          ? "opacity-100 transition-opacity duration-200"
          : "opacity-0",
        className,
      )}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      role="application"
      aria-label="Dataset trace graph"
    >
      <canvas
        ref={canvasRef}
        className={cx(
          "absolute inset-0 select-none",
          dragRef.current?.moved ? "cursor-grabbing" : hoveredNode ? "cursor-pointer" : "cursor-grab",
        )}
      />
      <canvas
        ref={labelsRef}
        className="pointer-events-none absolute inset-0"
      />

      {/* Overlay legend — top-left */}
      <div className="pointer-events-none absolute left-3 top-3 z-[2] flex flex-col gap-2">
        <div className="pointer-events-auto inline-flex flex-wrap items-center gap-2 rounded-[3px] border border-hairline-strong bg-l-surface-raised/95 px-2.5 py-1.5 backdrop-blur">
          {layout.centroids.length === 0 ? (
            <span className="font-mono text-[10.5px] text-l-ink-dim">
              No clusters
            </span>
          ) : (
            layout.centroids.map(({ cluster }) => (
              <span
                key={cluster.id}
                className="inline-flex items-center gap-1.5 font-sans text-[11px] text-l-ink-lo"
              >
                <span
                  aria-hidden
                  className="size-1.5 rounded-pill"
                  style={{ background: cluster.color }}
                />
                <span>{cluster.label}</span>
                <span className="font-mono text-[10px] text-l-ink-dim">
                  {cluster.traceIds.length}
                </span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Zoom controls — top-right */}
      <div className="absolute right-3 top-3 z-[2] flex items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          aria-label="Zoom in"
          onPress={() => zoomBy(1.25)}
        >
          <Plus className="size-3.5" strokeWidth={1.75} />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          aria-label="Zoom out"
          onPress={() => zoomBy(0.8)}
        >
          <Minus className="size-3.5" strokeWidth={1.75} />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          aria-label="Reset view"
          onPress={resetView}
          leadingIcon={<Maximize2 className="size-3.5" strokeWidth={1.75} />}
        >
          Reset
        </Button>
      </div>

      {/* Footnote — bottom-left */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[2] font-mono text-[10px] text-l-ink-dim">
        {formatNumber(layout.nodes.length)} traces · scroll to zoom · drag to pan
      </div>

      {/* Hover preview card */}
      {hoveredNode && hoverPos ? (
        <HoverInspectCard node={hoveredNode} pos={hoverPos} />
      ) : null}
    </div>
  );
}

/* ── Drawing helpers ────────────────────────────────────────── */

function computeScale(
  rect: DOMRect,
  layout: GraphLayout,
  _view: ViewState,
): { fit: number; offsetX: number; offsetY: number } {
  const fit = Math.min(rect.width / layout.width, rect.height / layout.height);
  const scaledW = layout.width * fit;
  const scaledH = layout.height * fit;
  return {
    fit,
    offsetX: (rect.width - scaledW) / 2,
    offsetY: (rect.height - scaledH) / 2,
  };
}

interface DrawState {
  hoveredId: string | null;
  selectedId: string | null;
  focusId: string | null;
  isFocused: (id: string) => boolean;
}

function drawScene(
  canvas: HTMLCanvasElement,
  layout: GraphLayout,
  view: ViewState,
  state: DrawState,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.width / dpr;
  const cssH = canvas.height / dpr;

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  // 1. Subtle dot grid background.
  drawGrid(ctx, cssW, cssH);

  // 2. Center the layout in the canvas + apply user pan/zoom.
  const fit = Math.min(cssW / layout.width, cssH / layout.height);
  const offsetX = (cssW - layout.width * fit) / 2 + view.tx;
  const offsetY = (cssH - layout.height * fit) / 2 + view.ty;
  ctx.translate(offsetX, offsetY);
  ctx.scale(fit * view.zoom, fit * view.zoom);

  // 3. Cluster bubbles (back layer).
  for (const centroid of layout.centroids) {
    drawClusterBubble(ctx, centroid);
  }

  // 4. Edges — only when there's a focus, to avoid hairball noise.
  if (state.focusId) {
    drawEdges(ctx, layout, state);
  }

  // 5. Nodes (front layer).
  drawNodes(ctx, layout, state, view.zoom * fit);

  ctx.restore();
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const spacing = 14;
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  for (let x = 0; x < width; x += spacing) {
    for (let y = 0; y < height; y += spacing) {
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawClusterBubble(
  ctx: CanvasRenderingContext2D,
  centroid: ClusterCentroid,
) {
  ctx.beginPath();
  ctx.arc(centroid.cx, centroid.cy, centroid.bubbleRadius, 0, Math.PI * 2);
  ctx.fillStyle = centroid.fill;
  ctx.fill();
  ctx.strokeStyle = centroid.stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawEdges(
  ctx: CanvasRenderingContext2D,
  layout: GraphLayout,
  state: DrawState,
) {
  const nodeById = new Map(layout.nodes.map((n) => [n.id, n]));
  ctx.lineWidth = 1;
  for (const edge of layout.edges) {
    const source = nodeById.get(edge.fromId);
    const target = nodeById.get(edge.toId);
    if (!source || !target) continue;
    const focused = state.isFocused(edge.fromId) && state.isFocused(edge.toId);
    if (!focused) continue;
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.strokeStyle = `rgba(168, 166, 161, ${0.3 + edge.weight * 0.4})`;
    ctx.stroke();
  }
}

function drawNodes(
  ctx: CanvasRenderingContext2D,
  layout: GraphLayout,
  state: DrawState,
  effectiveScale: number,
) {
  // Two-pass render so selected/hovered nodes always paint on top.
  const baseRadius = 6;
  const focusedRadius = 8;
  const selectedRadius = 9;

  // Pass 1: faded non-focused nodes.
  ctx.globalAlpha = 0.35;
  for (const node of layout.nodes) {
    if (state.isFocused(node.id)) continue;
    const radius = baseRadius;
    drawNode(ctx, node.x, node.y, radius / Math.max(effectiveScale, 0.4), node.color);
  }

  // Pass 2: focused (non-selected) nodes.
  ctx.globalAlpha = 1;
  for (const node of layout.nodes) {
    if (!state.isFocused(node.id)) continue;
    if (node.id === state.selectedId) continue;
    const isHovered = node.id === state.hoveredId;
    const radius = (isHovered ? focusedRadius : baseRadius) / Math.max(effectiveScale, 0.4);
    drawNode(ctx, node.x, node.y, radius, node.color);
    if (isHovered) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 3 / effectiveScale, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
      ctx.lineWidth = 1.5 / effectiveScale;
      ctx.stroke();
    }
  }

  // Pass 3: selected node — ember ring on top.
  if (state.selectedId) {
    const node = layout.nodes.find((n) => n.id === state.selectedId);
    if (node) {
      const radius = selectedRadius / Math.max(effectiveScale, 0.4);
      drawNode(ctx, node.x, node.y, radius, node.color);
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 3.5 / effectiveScale, 0, Math.PI * 2);
      ctx.strokeStyle = "#d8430a";
      ctx.lineWidth = 2 / effectiveScale;
      ctx.stroke();
    }
  }
}

function drawNode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fill: string,
) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
  ctx.lineWidth = Math.max(radius * 0.16, 0.4);
  ctx.stroke();
}

function drawClusterLabels(
  canvas: HTMLCanvasElement,
  layout: GraphLayout,
  view: ViewState,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.width / dpr;
  const cssH = canvas.height / dpr;

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  const fit = Math.min(cssW / layout.width, cssH / layout.height);
  const offsetX = (cssW - layout.width * fit) / 2 + view.tx;
  const offsetY = (cssH - layout.height * fit) / 2 + view.ty;
  const effective = fit * view.zoom;

  ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  ctx.textBaseline = "top";
  for (const centroid of layout.centroids) {
    const sx = offsetX + centroid.cx * effective;
    const sy = offsetY + centroid.cy * effective;
    const labelX = sx - centroid.bubbleRadius * effective + 6;
    const labelY = sy - centroid.bubbleRadius * effective + 6;
    ctx.fillStyle = "rgba(168, 166, 161, 0.85)";
    ctx.fillText(centroid.cluster.label, labelX, labelY);
    ctx.fillStyle = "rgba(168, 166, 161, 0.55)";
    ctx.fillText(
      `${centroid.cluster.traceIds.length}`,
      labelX,
      labelY + 12,
    );
  }
  ctx.restore();
}

/* ── Hover inspect card ────────────────────────────────────── */

interface HoverInspectCardProps {
  node: GraphNode;
  pos: { x: number; y: number };
}

const HOVER_OFFSET = 14;

function HoverInspectCard({ node, pos }: HoverInspectCardProps) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [adjusted, setAdjusted] = React.useState<{
    left: number;
    top: number;
  }>({ left: pos.x + HOVER_OFFSET, top: pos.y + HOVER_OFFSET });

  React.useLayoutEffect(() => {
    const card = cardRef.current;
    const parent = card?.parentElement;
    if (!card || !parent) return;
    const parentRect = parent.getBoundingClientRect();
    let left = pos.x + HOVER_OFFSET;
    let top = pos.y + HOVER_OFFSET;
    const rect = card.getBoundingClientRect();
    if (left + rect.width > parentRect.width - 8) {
      left = pos.x - rect.width - HOVER_OFFSET;
    }
    if (top + rect.height > parentRect.height - 8) {
      top = pos.y - rect.height - HOVER_OFFSET;
    }
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    setAdjusted({ left, top });
  }, [pos.x, pos.y, node.id]);

  return (
    <div
      ref={cardRef}
      style={{
        left: adjusted.left,
        top: adjusted.top,
      }}
      className={cx(
        "pointer-events-none absolute z-[3] flex w-[260px] flex-col gap-2",
        "rounded-[4px] border border-hairline-strong bg-l-surface-raised/95 p-2.5 backdrop-blur",
        "shadow-[0_8px_24px_rgba(0,0,0,0.45)]",
        "transition-opacity duration-100",
      )}
    >
      <HoverHeader trace={node.trace} clusterLabel={node.cluster?.label ?? null} clusterColor={node.cluster?.color ?? "var(--l-ink-dim)"} />
      <HoverStats trace={node.trace} />
      <HoverFooter trace={node.trace} />
    </div>
  );
}

function HoverHeader({
  trace,
  clusterLabel,
  clusterColor,
}: {
  trace: TraceSummary;
  clusterLabel: string | null;
  clusterColor: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-[3px] border border-l-border-faint bg-l-surface-input"
      >
        <CompanyLogo
          name={trace.primarySource}
          size={14}
          radius={2}
          fallbackBackground="transparent"
          fallbackColor="var(--l-ink-dim)"
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span className="truncate font-sans text-[12.5px] font-medium text-l-ink">
          {trace.label}
        </span>
        <span className="flex items-center gap-1.5 truncate font-mono text-[10px] text-l-ink-dim">
          {clusterLabel ? (
            <>
              <span
                aria-hidden
                className="size-1.5 rounded-pill"
                style={{ background: clusterColor }}
              />
              <span className="truncate">{clusterLabel}</span>
              <span aria-hidden>·</span>
            </>
          ) : null}
          <span className="truncate">{trace.traceId}</span>
        </span>
      </div>
    </div>
  );
}

function HoverStats({ trace }: { trace: TraceSummary }) {
  return (
    <dl className="grid grid-cols-3 gap-1.5 rounded-[3px] border border-l-border-faint bg-l-surface-input px-2 py-1.5">
      <Cell label="Events">{formatNumber(trace.eventCount)}</Cell>
      <Cell label="Duration">{formatTraceDuration(trace.durationMs)}</Cell>
      <Cell label="Status">
        <StatusInline status={trace.status} />
      </Cell>
    </dl>
  );
}

function HoverFooter({ trace }: { trace: TraceSummary }) {
  return (
    <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-l-ink-dim">
      <span className="flex items-center gap-1.5">
        {trace.split ? <DatasetSplitChip split={trace.split} compact /> : null}
        {trace.addedBy ? <span>by {trace.addedBy}</span> : null}
      </span>
      <span>Click to inspect</span>
    </div>
  );
}

function Cell({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[1px] min-w-0">
      <dt className="font-mono text-[9px] uppercase tracking-[0.06em] text-l-ink-dim">
        {label}
      </dt>
      <dd className="truncate font-sans text-[11.5px] text-l-ink">{children}</dd>
    </div>
  );
}

function StatusInline({ status }: { status: TraceStatus }) {
  const meta = {
    ok: { label: "OK", color: "bg-l-status-done", text: "text-l-status-done" },
    warn: {
      label: "Warn",
      color: "bg-l-status-inprogress",
      text: "text-l-status-inprogress",
    },
    error: {
      label: "Error",
      color: "bg-l-p-urgent",
      text: "text-l-p-urgent",
    },
  }[status];
  return (
    <span className={cx("inline-flex items-center gap-1 font-medium", meta.text)}>
      <span aria-hidden className={cx("size-1.5 rounded-pill", meta.color)} />
      {meta.label}
    </span>
  );
}

/* ── Math helpers ──────────────────────────────────────────── */

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
