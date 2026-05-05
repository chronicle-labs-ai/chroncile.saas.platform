/*
 * Column configs for the dataset trace canvas's filter rail.
 *
 * Wraps `useDataTableFilters` from `product/filters` so the dataset
 * filter chips reuse the same machinery, value editors, and operator
 * menus as Connections / Agents / Stream timeline. New filterable
 * fields go here, keyed by id; the canvas wires them through.
 *
 * Static columns (cluster, split, source, addedBy) read their options
 * from `defaultDatasetTraceColumns(snapshot)` so each dataset
 * advertises only the values it actually contains.
 */

import type { ColumnConfig, ColumnOption } from "../product/filters";

import type {
  DatasetCluster,
  DatasetSnapshot,
  TraceSummary,
} from "./types";

/* ── Static option pickers ─────────────────────────────────── */

const SPLIT_OPTIONS: ColumnOption[] = [
  { value: "train", label: "Train", tone: "violet" },
  { value: "validation", label: "Validation", tone: "teal" },
  { value: "test", label: "Test", tone: "amber" },
];

/* ── Per-snapshot column options ───────────────────────────── */

function clusterOptions(
  clusters: readonly DatasetCluster[],
  traces: readonly TraceSummary[]
): ColumnOption[] {
  const options = clusters.map<ColumnOption>((c) => ({
    value: c.id,
    label: c.label,
    tone: "neutral",
  }));
  if (traces.some((trace) => !trace.clusterId)) {
    options.push({ value: "", label: "Unclustered", tone: "neutral" });
  }
  return options;
}

function splitOptions(traces: readonly TraceSummary[]): ColumnOption[] {
  const options = [...SPLIT_OPTIONS];
  if (traces.some((trace) => !trace.split)) {
    options.push({ value: "", label: "Unassigned", tone: "neutral" });
  }
  return options;
}

function distinctSourceOptions(
  traces: readonly TraceSummary[]
): ColumnOption[] {
  const seen = new Set<string>();
  for (const t of traces) {
    if (t.primarySource) seen.add(t.primarySource);
    for (const s of t.sources) seen.add(s);
  }
  return Array.from(seen)
    .sort()
    .map<ColumnOption>((value) => ({ value, label: value, tone: "neutral" }));
}

function distinctAddedByOptions(
  traces: readonly TraceSummary[]
): ColumnOption[] {
  const seen = new Set<string>();
  for (const t of traces) {
    if (t.addedBy) seen.add(t.addedBy);
  }
  return Array.from(seen)
    .sort()
    .map<ColumnOption>((value) => ({ value, label: value, tone: "neutral" }));
}

/**
 * Builds the filter-rail columns for a dataset snapshot. The canvas
 * passes the result into `useDataTableFilters`; the bar surfaces one
 * pill per added filter and a Selector to add more.
 *
 * Columns are keyed by stable string ids so URL state survives
 * snapshot refreshes. Accessors return the raw `TraceSummary` field —
 * the predicate machinery handles option matching, multi-option,
 * text contains, and number compares.
 */
export function defaultDatasetTraceColumns(
  snapshot: DatasetSnapshot
): ColumnConfig<TraceSummary>[] {
  const clusters = clusterOptions(snapshot.clusters, snapshot.traces);
  const splits = splitOptions(snapshot.traces);
  const sources = distinctSourceOptions(snapshot.traces);
  const addedBy = distinctAddedByOptions(snapshot.traces);

  const columns: ColumnConfig<TraceSummary>[] = [
    {
      id: "label",
      label: "Label",
      type: "text",
      accessor: (row) => row.label,
      placeholder: "Search trace label",
    },
    {
      id: "traceId",
      label: "Trace id",
      type: "text",
      accessor: (row) => row.traceId,
      placeholder: "trace_…",
    },
    {
      id: "split",
      label: "Split",
      type: "multiOption",
      accessor: (row) => row.split ?? null,
      options: splits,
    },
    {
      id: "source",
      label: "Source",
      type: "multiOption",
      accessor: (row) =>
        row.sources.length > 0 ? row.sources : [row.primarySource],
      options: sources,
    },
    {
      id: "eventCount",
      label: "Events",
      type: "number",
      accessor: (row) => row.eventCount,
      placeholder: "≥",
    },
    {
      id: "durationMs",
      label: "Duration (ms)",
      type: "number",
      accessor: (row) => row.durationMs,
      placeholder: "≥",
    },
  ];

  if (clusters.length > 0) {
    columns.splice(2, 0, {
      id: "cluster",
      label: "Cluster",
      type: "multiOption",
      accessor: (row) => row.clusterId ?? null,
      options: clusters,
    });
  }

  if (addedBy.length > 0) {
    columns.push({
      id: "addedBy",
      label: "Added by",
      type: "multiOption",
      accessor: (row) => row.addedBy ?? null,
      options: addedBy,
    });
  }

  return columns;
}
