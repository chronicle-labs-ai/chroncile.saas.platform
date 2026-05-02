/*
 * Graph layout — turns a `DatasetSnapshot` into 2D positions for the
 * canvas scatter. No physics, no simulation, no d3 — we deliberately
 * lay traces out deterministically so reloads don't shuffle the
 * positions and the canvas can re-draw at 60fps without re-solving.
 *
 * Two positioning strategies, picked per-trace:
 *
 *   1. **Embedding-driven** (preferred). When `TraceSummary.embedding`
 *      is set, the layout maps it from normalized `[-1, 1]` space
 *      directly to canvas pixels. That's what `data.ts` produces for
 *      the seeded snapshots — anisotropic Gaussian blobs with
 *      stragglers and outliers, modelled after a real UMAP run.
 *
 *   2. **Phyllotaxis fallback** for traces without an embedding.
 *      Cluster centroids land on a circle, members spiral outward
 *      via the golden-angle pattern. Used when an upstream caller
 *      passes traces that haven't been embedded yet.
 *
 * Pure helpers, no React, no DOM. Memoized at the call site.
 */

import { clusterColorAlpha, clusterColorHex } from "./cluster-color";
import type {
  DatasetCluster,
  DatasetSimilarityEdge,
  DatasetSnapshot,
  TraceSummary,
} from "./types";

export interface GraphNode {
  id: string;
  trace: TraceSummary;
  cluster: DatasetCluster | null;
  /** Layout-space coordinates. */
  x: number;
  y: number;
  /** Pixel radius rendered at zoom = 1. */
  radius: number;
  /** Resolved hex color for canvas composition. */
  color: string;
}

export interface GraphEdge {
  /** Trace id of the source node. */
  fromId: string;
  /** Trace id of the target node. */
  toId: string;
  /** Similarity weight, in [0..1]. */
  weight: number;
}

export interface ClusterCentroid {
  cluster: DatasetCluster;
  cx: number;
  cy: number;
  /** Tightest radius that still encloses all member nodes. */
  bubbleRadius: number;
  /** Translucent fill for the bubble background. */
  fill: string;
  /** Stroke for the bubble outline. */
  stroke: string;
}

export interface GraphLayoutOptions {
  /** Logical canvas width. Defaults to 960. */
  width?: number;
  /** Logical canvas height. Defaults to 600. */
  height?: number;
  /** Node radius at zoom = 1. Defaults to 6. */
  nodeRadius?: number;
  /** Edge weight threshold below which edges are dropped. */
  edgeWeightThreshold?: number;
  /** Spacing factor for the phyllotaxis spiral (px per √index).
   *  Smaller = denser cluster; larger = sparser. Defaults to 12. */
  spiralSpacing?: number;
  /** Padding around cluster bubbles. Defaults to 18. */
  bubblePadding?: number;
}

export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  centroids: ClusterCentroid[];
  /** Source canvas dimensions used for layout — the renderer should
   *  use these for the `viewBox` / `transform` math so coordinates
   *  align with click/hover targets. */
  width: number;
  height: number;
}

const DEFAULT_OPTIONS: Required<GraphLayoutOptions> = {
  width: 960,
  height: 600,
  nodeRadius: 6,
  edgeWeightThreshold: 0.2,
  spiralSpacing: 12,
  bubblePadding: 18,
};

/** Golden angle, in radians. The classic phyllotaxis constant. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Place N cluster centroids around a circle. */
function packClusterCentroids(
  clusters: readonly DatasetCluster[],
  width: number,
  height: number,
): Map<string, { cx: number; cy: number }> {
  const cx = width / 2;
  const cy = height / 2;
  const map = new Map<string, { cx: number; cy: number }>();
  if (clusters.length === 0) return map;
  if (clusters.length === 1) {
    map.set(clusters[0]!.id, { cx, cy });
    return map;
  }
  const ringRadius = Math.min(width, height) * 0.3;
  clusters.forEach((cluster, i) => {
    const angle = (i / clusters.length) * Math.PI * 2 - Math.PI / 2;
    map.set(cluster.id, {
      cx: cx + Math.cos(angle) * ringRadius,
      cy: cy + Math.sin(angle) * ringRadius,
    });
  });
  return map;
}

/** Distribute member traces inside one cluster using a golden-angle
 *  phyllotaxis spiral. Index 0 lands at the centroid; subsequent
 *  members orbit outward in evenly-spaced pseudo-rings. */
function placeMembers(
  members: readonly TraceSummary[],
  centroid: { cx: number; cy: number },
  spacing: number,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (members.length === 0) return positions;
  if (members.length === 1) {
    positions.set(members[0]!.traceId, { x: centroid.cx, y: centroid.cy });
    return positions;
  }
  // Sort for stability so the same trace always lands on the same
  // ring across reloads.
  const sorted = [...members].sort((a, b) =>
    a.traceId.localeCompare(b.traceId),
  );
  sorted.forEach((trace, i) => {
    const angle = i * GOLDEN_ANGLE;
    const radius = spacing * Math.sqrt(i + 0.5);
    positions.set(trace.traceId, {
      x: centroid.cx + Math.cos(angle) * radius,
      y: centroid.cy + Math.sin(angle) * radius,
    });
  });
  return positions;
}

export function buildGraphLayout(
  snapshot: DatasetSnapshot,
  optionsInput: GraphLayoutOptions = {},
): GraphLayout {
  const options = { ...DEFAULT_OPTIONS, ...optionsInput };
  const {
    width,
    height,
    nodeRadius,
    edgeWeightThreshold,
    spiralSpacing,
    bubblePadding,
  } = options;

  const clusterById = new Map(snapshot.clusters.map((c) => [c.id, c]));
  const fallbackByCluster = new Map<string, TraceSummary[]>();
  const fallbackOrphans: TraceSummary[] = [];

  // Bucket traces that don't carry their own embedding so we can spin
  // up phyllotaxis only for them.
  for (const trace of snapshot.traces) {
    if (trace.embedding) continue;
    if (trace.clusterId && clusterById.has(trace.clusterId)) {
      const list = fallbackByCluster.get(trace.clusterId) ?? [];
      list.push(trace);
      fallbackByCluster.set(trace.clusterId, list);
    } else {
      fallbackOrphans.push(trace);
    }
  }

  const centroidSeeds = packClusterCentroids(
    snapshot.clusters,
    width,
    height,
  );

  const fallbackPositions = new Map<string, { x: number; y: number }>();
  fallbackByCluster.forEach((members, clusterId) => {
    const seed = centroidSeeds.get(clusterId) ?? {
      cx: width / 2,
      cy: height / 2,
    };
    const positions = placeMembers(members, seed, spiralSpacing);
    positions.forEach((p, traceId) => fallbackPositions.set(traceId, p));
  });
  if (fallbackOrphans.length > 0) {
    const seed = { cx: width * 0.85, cy: height * 0.85 };
    const positions = placeMembers(fallbackOrphans, seed, spiralSpacing);
    positions.forEach((p, traceId) => fallbackPositions.set(traceId, p));
  }

  // Map embeddings from `[-1, 1]` to canvas pixels with a small gutter
  // so points hug the canvas without clipping.
  const margin = Math.min(width, height) * 0.06;
  const halfW = (width - margin * 2) / 2;
  const halfH = (height - margin * 2) / 2;
  const cx0 = width / 2;
  const cy0 = height / 2;
  const fromEmbedding = (e: readonly [number, number]) => ({
    x: cx0 + clamp(e[0], -1, 1) * halfW,
    y: cy0 + clamp(e[1], -1, 1) * halfH,
  });

  const nodes: GraphNode[] = snapshot.traces.map((trace) => {
    const cluster = trace.clusterId
      ? clusterById.get(trace.clusterId) ?? null
      : null;
    const pos = trace.embedding
      ? fromEmbedding(trace.embedding)
      : fallbackPositions.get(trace.traceId) ?? { x: width / 2, y: height / 2 };
    return {
      id: trace.traceId,
      trace,
      cluster,
      x: pos.x,
      y: pos.y,
      radius: nodeRadius,
      color: cluster ? clusterColorHex(cluster.id) : "#6b6a66",
    };
  });

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const edges: GraphEdge[] = snapshot.edges
    .filter((e) => e.weight >= edgeWeightThreshold)
    .filter((e) => nodeById.has(e.fromTraceId) && nodeById.has(e.toTraceId))
    .map<GraphEdge>((edge: DatasetSimilarityEdge) => ({
      fromId: edge.fromTraceId,
      toId: edge.toTraceId,
      weight: edge.weight,
    }));

  // Tight bubble radius per cluster from member footprint.
  const centroids: ClusterCentroid[] = snapshot.clusters.map((cluster) => {
    const members = nodes.filter((n) => n.cluster?.id === cluster.id);
    if (members.length === 0) {
      const seed = centroidSeeds.get(cluster.id) ?? {
        cx: width / 2,
        cy: height / 2,
      };
      return {
        cluster,
        cx: seed.cx,
        cy: seed.cy,
        bubbleRadius: 36,
        fill: clusterColorAlpha(cluster.id, 0.1),
        stroke: clusterColorAlpha(cluster.id, 0.35),
      };
    }
    const cx = members.reduce((sum, m) => sum + m.x, 0) / members.length;
    const cy = members.reduce((sum, m) => sum + m.y, 0) / members.length;
    const maxRadius = members.reduce((max, m) => {
      const dx = m.x - cx;
      const dy = m.y - cy;
      return Math.max(max, Math.sqrt(dx * dx + dy * dy) + m.radius);
    }, 0);
    return {
      cluster,
      cx,
      cy,
      bubbleRadius: Math.max(maxRadius + bubblePadding, 36),
      fill: clusterColorAlpha(cluster.id, 0.1),
      stroke: clusterColorAlpha(cluster.id, 0.35),
    };
  });

  return { nodes, edges, centroids, width, height };
}

/** Lookup helper exported for tests / Storybook visualization. */
export function nodeAt(
  layout: GraphLayout,
  traceId: string,
): GraphNode | null {
  return layout.nodes.find((n) => n.id === traceId) ?? null;
}

/** Find the nearest node to a layout-space point within `maxDist`.
 *  Brute-force; fine for our scale (≤ 500 nodes). */
export function findNearestNode(
  layout: GraphLayout,
  x: number,
  y: number,
  maxDist: number,
): GraphNode | null {
  let best: GraphNode | null = null;
  let bestDist = maxDist;
  for (const node of layout.nodes) {
    const dx = node.x - x;
    const dy = node.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= bestDist) {
      best = node;
      bestDist = dist;
    }
  }
  return best;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
