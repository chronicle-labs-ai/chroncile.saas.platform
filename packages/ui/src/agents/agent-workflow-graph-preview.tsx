"use client";

import * as React from "react";

import { cx } from "../utils/cx";

import type {
  AgentWorkflowGraph,
  AgentWorkflowNodeKind,
} from "./types";

/*
 * AgentWorkflowGraphPreview — compact 5–7 node SVG rendered inside
 * the Capabilities pane to give the user a structural sense of the
 * agent's runtime path:
 *
 *    [input] ──► [tool] ──► [model] ──► [branch] ─yes─► [tool]
 *                                            └─no──► [output]
 *
 * The graph is a narrative device, not a debugger — so the layout is
 * a deterministic layered DAG (longest-path → x slot, breadth → y
 * slot) and edges are simple cubic Béziers between layer slots.
 *
 * Visual language:
 *   - input/output  → ember outline + ember ink (the "boundary")
 *   - tool          → event-teal tile (work)
 *   - model         → event-violet tile (thinking)
 *   - branch        → event-amber tile (decision)
 *
 * Animation: no entrance animation. Edge dasharray is fixed; nothing
 * about this component re-renders on hover/focus, so there's nothing
 * for `prefers-reduced-motion` to suppress. Future enhancements that
 * add motion must respect `motion-reduce:` Tailwind variants.
 */

export interface AgentWorkflowGraphPreviewProps {
  graph: AgentWorkflowGraph;
  /** Optional click-handler for tool nodes. Lets the parent deep-link
   *  the node back to its tool card. */
  onSelectTool?: (toolName: string) => void;
  /** Tighter row spacing for the right-rail variant. */
  density?: "default" | "compact";
  /** ARIA label for the SVG. Defaults to a generic description. */
  ariaLabel?: string;
  className?: string;
}

interface PlacedNode {
  id: string;
  kind: AgentWorkflowNodeKind;
  label: string;
  toolName?: string;
  layer: number;
  slot: number;
  x: number;
  y: number;
}

interface PlacedEdge {
  from: string;
  to: string;
  label?: string;
  d: string;
  labelX: number;
  labelY: number;
}

const NODE_W = 116;
const NODE_H = 28;
const LAYER_GAP_DEFAULT = 36;
const LAYER_GAP_COMPACT = 24;
const ROW_GAP_DEFAULT = 20;
const ROW_GAP_COMPACT = 16;
const PADDING_X = 12;
const PADDING_Y = 8;

const NODE_TONE: Record<
  AgentWorkflowNodeKind,
  { tone: string; rectFillOpacity: number; rectStrokeOpacity: number }
> = {
  input: { tone: "text-ember", rectFillOpacity: 0.1, rectStrokeOpacity: 0.55 },
  output: { tone: "text-ember", rectFillOpacity: 0.1, rectStrokeOpacity: 0.55 },
  tool: {
    tone: "text-event-teal",
    rectFillOpacity: 0.1,
    rectStrokeOpacity: 0.55,
  },
  model: {
    tone: "text-event-violet",
    rectFillOpacity: 0.1,
    rectStrokeOpacity: 0.55,
  },
  branch: {
    tone: "text-event-amber",
    rectFillOpacity: 0.1,
    rectStrokeOpacity: 0.55,
  },
};

export function AgentWorkflowGraphPreview({
  graph,
  onSelectTool,
  density = "default",
  ariaLabel,
  className,
}: AgentWorkflowGraphPreviewProps) {
  const layout = React.useMemo(
    () => computeLayout(graph, density),
    [graph, density],
  );

  if (graph.nodes.length === 0) {
    return (
      <div
        className={cx(
          "rounded-[4px] border border-l-border-faint bg-l-wash-1 p-4 text-center font-sans text-[12px] text-l-ink-dim",
          className,
        )}
      >
        No workflow graph attached to this version.
      </div>
    );
  }

  return (
    <div
      className={cx(
        "rounded-[4px] border border-hairline-strong bg-l-surface-raised p-3",
        className,
      )}
    >
      <svg
        role="img"
        aria-label={
          ariaLabel ??
          `Agent workflow with ${graph.nodes.length} nodes and ${graph.edges.length} edges`
        }
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ maxHeight: "100%" }}
      >
        <defs>
          <marker
            id="agent-graph-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path
              d="M 0 0 L 8 4 L 0 8 z"
              fill="currentColor"
              className="text-l-ink-dim"
            />
          </marker>
        </defs>

        <g className="text-l-ink-dim">
          {layout.edges.map((edge) => (
            <g key={`${edge.from}-${edge.to}`}>
              <path
                d={edge.d}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.5}
                strokeWidth={1}
                markerEnd="url(#agent-graph-arrow)"
              />
              {edge.label ? (
                <text
                  x={edge.labelX}
                  y={edge.labelY}
                  textAnchor="middle"
                  fill="currentColor"
                  className="font-mono text-[9px] tabular-nums"
                >
                  {edge.label}
                </text>
              ) : null}
            </g>
          ))}
        </g>

        {layout.nodes.map((node) => {
          const tile = NODE_TONE[node.kind];
          const interactive =
            node.kind === "tool" &&
            typeof onSelectTool === "function" &&
            node.toolName;
          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              className={tile.tone}
              {...(interactive
                ? {
                    role: "button",
                    tabIndex: 0,
                    onClick: () => onSelectTool!(node.toolName!),
                    onKeyDown: (e: React.KeyboardEvent<SVGGElement>) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectTool!(node.toolName!);
                      }
                    },
                    style: { cursor: "pointer" },
                  }
                : {})}
            >
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={3}
                ry={3}
                fill="currentColor"
                fillOpacity={tile.rectFillOpacity}
                stroke="currentColor"
                strokeOpacity={tile.rectStrokeOpacity}
                strokeWidth={1}
              />
              <text
                x={NODE_W / 2}
                y={NODE_H / 2 + 3.5}
                textAnchor="middle"
                fill="currentColor"
                className="font-sans text-[10px] font-medium"
              >
                {truncate(node.label, 20)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

interface Layout {
  nodes: readonly PlacedNode[];
  edges: readonly PlacedEdge[];
  width: number;
  height: number;
}

function computeLayout(
  graph: AgentWorkflowGraph,
  density: "default" | "compact",
): Layout {
  const layerGap = density === "compact" ? LAYER_GAP_COMPACT : LAYER_GAP_DEFAULT;
  const rowGap = density === "compact" ? ROW_GAP_COMPACT : ROW_GAP_DEFAULT;

  // Build adjacency for longest-path layering.
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const node of graph.nodes) {
    incoming.set(node.id, []);
    outgoing.set(node.id, []);
  }
  for (const edge of graph.edges) {
    if (!incoming.has(edge.to) || !outgoing.has(edge.from)) continue;
    incoming.get(edge.to)!.push(edge.from);
    outgoing.get(edge.from)!.push(edge.to);
  }

  // Longest-path layering — depth = max(depth(parents)) + 1.
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const visit = (id: string): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (visiting.has(id)) {
      depth.set(id, 0);
      return 0;
    }
    visiting.add(id);
    const parents = incoming.get(id) ?? [];
    const d =
      parents.length === 0
        ? 0
        : Math.max(...parents.map((p) => visit(p) + 1));
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };
  for (const n of graph.nodes) visit(n.id);

  const layerMembers = new Map<number, string[]>();
  for (const n of graph.nodes) {
    const d = depth.get(n.id) ?? 0;
    const arr = layerMembers.get(d) ?? [];
    arr.push(n.id);
    layerMembers.set(d, arr);
  }

  // Place nodes column-by-column.
  const placed = new Map<string, PlacedNode>();
  const layerCount = layerMembers.size;
  const maxRow = Math.max(...Array.from(layerMembers.values()).map((m) => m.length));

  const layerWidth = NODE_W + layerGap;
  const rowHeight = NODE_H + rowGap;

  const totalW = PADDING_X * 2 + layerCount * layerWidth - layerGap;
  const totalH = PADDING_Y * 2 + maxRow * rowHeight - rowGap;

  for (const [layer, ids] of layerMembers.entries()) {
    const layerH = ids.length * rowHeight - rowGap;
    const offsetY = (totalH - PADDING_Y * 2 - layerH) / 2 + PADDING_Y;
    ids.forEach((id, index) => {
      const node = graph.nodes.find((n) => n.id === id);
      if (!node) return;
      placed.set(id, {
        id,
        kind: node.kind,
        label: node.label,
        toolName: node.toolName,
        layer,
        slot: index,
        x: PADDING_X + layer * layerWidth,
        y: offsetY + index * rowHeight,
      });
    });
  }

  // Build edge paths.
  const edges: PlacedEdge[] = [];
  for (const edge of graph.edges) {
    const a = placed.get(edge.from);
    const b = placed.get(edge.to);
    if (!a || !b) continue;
    const x1 = a.x + NODE_W;
    const y1 = a.y + NODE_H / 2;
    const x2 = b.x;
    const y2 = b.y + NODE_H / 2;
    const cx1 = x1 + (x2 - x1) / 2;
    const cx2 = x2 - (x2 - x1) / 2;
    const d = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
    edges.push({
      from: edge.from,
      to: edge.to,
      label: edge.label,
      d,
      labelX: (x1 + x2) / 2,
      labelY: (y1 + y2) / 2 - 4,
    });
  }

  return {
    nodes: Array.from(placed.values()),
    edges,
    width: Math.max(totalW, NODE_W + PADDING_X * 2),
    height: Math.max(totalH, NODE_H + PADDING_Y * 2),
  };
}

function truncate(label: string, max: number): string {
  if (label.length <= max) return label;
  return `${label.slice(0, Math.max(0, max - 1))}…`;
}
