"use client";

import * as React from "react";

import {
  buildGraphLayout,
  type GraphLayout,
  type GraphLayoutOptions,
} from "./graph-layout";
import type { DatasetSnapshot } from "./types";

/*
 * useGraphSimulation — memoized layout for a `DatasetSnapshot`.
 *
 * The "simulation" name is historical: there's no physics any more.
 * The hook just runs `buildGraphLayout` once per (snapshot structure,
 * size) pair and returns the result. Cosmetic dataset edits (rename,
 * tag changes) don't trigger a re-layout.
 */

export interface UseGraphSimulationOptions extends GraphLayoutOptions {}

export interface UseGraphSimulationReturn {
  layout: GraphLayout;
  /** Increments whenever the layout was rebuilt — drives the canvas
   *  fade-in. */
  buildId: number;
  /** Force a fresh layout — invalidates memoization. */
  bumpKey: () => void;
}

function structureKey(snapshot: DatasetSnapshot): string {
  const traces = snapshot.traces
    .map((t) => `${t.traceId}@${t.clusterId ?? ""}`)
    .join(",");
  const clusters = snapshot.clusters
    .map((c) => `${c.id}#${c.traceIds.length}`)
    .join(",");
  const edges = snapshot.edges
    .map((e) => `${e.fromTraceId}->${e.toTraceId}@${e.weight.toFixed(2)}`)
    .join(",");
  return `${traces}|${clusters}|${edges}`;
}

export function useGraphSimulation(
  snapshot: DatasetSnapshot,
  options: UseGraphSimulationOptions = {},
): UseGraphSimulationReturn {
  const key = structureKey(snapshot);
  const dimsKey = JSON.stringify({
    w: options.width,
    h: options.height,
    r: options.nodeRadius,
    s: options.spiralSpacing,
    p: options.bubblePadding,
    t: options.edgeWeightThreshold,
  });
  const [reseed, setReseed] = React.useState(0);

  const layout = React.useMemo(
    () => buildGraphLayout(snapshot, options),
    // We deliberately key off the structural shape + dimensions, not
    // the snapshot identity — cosmetic dataset edits should never
    // re-layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, dimsKey, reseed],
  );

  const bumpKey = React.useCallback(() => {
    setReseed((n) => n + 1);
  }, []);

  return { layout, buildId: reseed, bumpKey };
}
