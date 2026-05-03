"use client";

import * as React from "react";

import { CompanyLogo } from "../icons";
import {
  sourceColor,
  sourceTintedBackground,
} from "../stream-timeline/source-color";
import { cx } from "../utils/cx";
import { formatNumber } from "../connections/time";

import { DatasetMetricsStrip } from "./dataset-metrics-strip";
import type { DatasetCluster, TraceSummary } from "./types";

/*
 * DatasetCoverageLens — surfaces "what is actually in this dataset"
 * as the agent builder needs it before promoting to an eval set:
 *
 *   - Source distribution (which integrations dominate?)
 *   - Cluster distribution (which failure modes are well-covered?)
 *   - Status mix (how much of the set is broken?)
 *   - Split balance (is train / val / test ratio sane?)
 *
 * Each row is a single horizontal stacked bar — no nested charts, no
 * overlapping color systems. Coverage is a triage tool: it answers
 * "is anything under-represented?" in one glance.
 *
 * Bars are computed from the *filtered* trace list passed in; the
 * lens is reactive to filter rail changes the same way the List and
 * Cluster lenses are.
 */

export interface DatasetCoverageLensProps {
  /** Already-filtered traces for this dataset. */
  traces: readonly TraceSummary[];
  /** Total before filters — surfaces "X of Y traces" subhead. */
  totalCount: number;
  /** Clusters from the snapshot, used to label cluster rows + colors. */
  clusters: readonly DatasetCluster[];
  /** Optional click handler — clicking a bucket adds the matching
   *  filter chip (the canvas wires this through). */
  onBucketSelect?: (bucket: CoverageBucketSelection) => void;
  /** Persistent metrics tile row. Defaults to off — the canvas
   *  shows it once at the top of all lenses. */
  showMetricsStrip?: boolean;
  className?: string;
}

export type CoverageBucketSelection =
  | { kind: "source"; value: string }
  | { kind: "cluster"; value: string }
  | { kind: "status"; value: TraceSummary["status"] }
  | { kind: "split"; value: NonNullable<TraceSummary["split"]> | "unassigned" };

export function DatasetCoverageLens({
  traces,
  totalCount,
  clusters,
  onBucketSelect,
  showMetricsStrip,
  className,
}: DatasetCoverageLensProps) {
  const groups = React.useMemo(
    () => buildCoverageGroups(traces, clusters),
    [traces, clusters],
  );

  if (traces.length === 0) {
    return (
      <div
        className={cx(
          "flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center",
          className,
        )}
      >
        <span className="font-sans text-[12.5px] text-l-ink-lo">
          No traces match the current filters
        </span>
        <span className="font-mono text-[11px] text-l-ink-dim">
          Coverage updates as you change the filter rail.
        </span>
      </div>
    );
  }

  return (
    <div className={cx("flex flex-col gap-4", className)}>
      {showMetricsStrip ? (
        <DatasetMetricsStrip
          snapshot={{
            dataset: { id: "__coverage__", name: "" } as never,
            traces,
            clusters,
            edges: [],
          }}
        />
      ) : null}

      <div className="flex items-center justify-between">
        <h2 className="font-sans text-[12px] font-medium text-l-ink">
          Coverage
        </h2>
        <span
          className="font-mono text-[10.5px] tabular-nums text-l-ink-dim"
          aria-label={`${traces.length} of ${totalCount} traces`}
        >
          {formatNumber(traces.length)} / {formatNumber(totalCount)} traces
        </span>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
        {groups.map((group) => (
          <CoverageGroup
            key={group.id}
            group={group}
            onBucketSelect={onBucketSelect}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Group renderer ──────────────────────────────────────── */

interface CoverageGroup {
  id: "source" | "cluster" | "status" | "split";
  title: string;
  buckets: CoverageBucket[];
  /** Optional warning emitted when a critical bucket is empty
   *  (e.g. zero `test` traces in an eval-bound dataset). */
  warning?: string;
}

interface CoverageBucket {
  /** Stable id used for keys + click payloads. */
  key: string;
  label: string;
  count: number;
  ratio: number;
  /** Tailwind background color class. */
  bar: string;
  /** Tailwind text color class for the label dot. */
  dot: string;
  /** Optional CSS-variable fill (used for cluster colors which
   *  come in as CSS variables). */
  fill?: string;
  /** Optional pre-rendered leading glyph that replaces the colored
   *  dot. The Source group uses this slot to render a `<CompanyLogo>`
   *  so each row carries the brand mark instead of a generic dot —
   *  GitHub becomes the octocat, Stripe becomes the Stripe S, etc.
   *  Other groups (cluster / status / split) leave it unset and fall
   *  back to the colored dot. */
  iconNode?: React.ReactNode;
  selection: CoverageBucketSelection;
  warn?: boolean;
}

function CoverageGroup({
  group,
  onBucketSelect,
}: {
  group: CoverageGroup;
  onBucketSelect?: (bucket: CoverageBucketSelection) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-baseline justify-between">
        <h3 className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-l-ink-dim">
          {group.title}
        </h3>
        <span className="font-mono text-[10px] tabular-nums text-l-ink-dim">
          {group.buckets.length}{" "}
          {group.buckets.length === 1 ? "bucket" : "buckets"}
        </span>
      </header>

      {group.warning ? (
        <p className="rounded-[3px] border border-hairline-strong bg-l-surface-input px-2 py-1.5 font-mono text-[10.5px] text-l-status-inprogress">
          {group.warning}
        </p>
      ) : null}

      <ul className="flex flex-col gap-1.5">
        {group.buckets.map((bucket) => (
          <li key={bucket.key}>
            <CoverageBar
              bucket={bucket}
              onSelect={
                onBucketSelect
                  ? () => onBucketSelect(bucket.selection)
                  : undefined
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CoverageBar({
  bucket,
  onSelect,
}: {
  bucket: CoverageBucket;
  onSelect?: () => void;
}) {
  const interactive = !!onSelect;
  const widthPct = `${Math.max(bucket.ratio * 100, 1.5)}%`;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!interactive}
      data-warn={bucket.warn || undefined}
      className={cx(
        "group flex w-full flex-col gap-1 rounded-[3px] px-1.5 py-1 text-left",
        interactive
          ? "hover:bg-l-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40"
          : "cursor-default",
      )}
      aria-label={`${bucket.label}: ${bucket.count} traces, ${Math.round(
        bucket.ratio * 100,
      )} percent${interactive ? ". Click to filter to this bucket." : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {bucket.iconNode ?? (
            <span
              aria-hidden
              className={cx("size-1.5 shrink-0 rounded-pill", bucket.dot)}
              style={bucket.fill ? { background: bucket.fill } : undefined}
            />
          )}
          <span className="truncate font-sans text-[12px] text-l-ink">
            {bucket.label}
          </span>
        </div>
        <span className="font-mono text-[10.5px] tabular-nums text-l-ink-dim">
          {bucket.count}
          <span className="ml-1 text-l-ink-dim">
            ({Math.round(bucket.ratio * 100)}%)
          </span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-[2px] bg-l-surface-input motion-reduce:transition-none">
        <div
          className={cx("h-full transition-[width] duration-200 ease-out", bucket.bar)}
          style={{ width: widthPct, ...(bucket.fill ? { background: bucket.fill } : {}) }}
        />
      </div>
    </button>
  );
}

/* ── Aggregation ─────────────────────────────────────────── */

function buildCoverageGroups(
  traces: readonly TraceSummary[],
  clusters: readonly DatasetCluster[],
): CoverageGroup[] {
  const total = traces.length;
  if (total === 0) return [];

  /* Source — primary source per trace, sorted desc, top 8.
     Each row renders the brand's `<CompanyLogo>` in the leading slot
     and the bar fills with the brand's `sourceColor()` so the row
     reads as the brand at a glance. The same `sourceTintedBackground`
     fallback is used elsewhere (timeline, trace summary) so unknown
     sources still get a deterministic hue + tinted backstop while
     the logo loads or if logo.dev fails. */
  const sourceCounts = countBy(traces, (t) => t.primarySource);
  const sourceBuckets = topN(sourceCounts, 8).map<CoverageBucket>(
    ([value, count]) => {
      const color = sourceColor(value);
      const tint = sourceTintedBackground(color, 22);
      return {
        key: `source:${value}`,
        label: value || "unknown",
        count,
        ratio: count / total,
        bar: "",
        dot: "",
        fill: color,
        iconNode: (
          <CompanyLogo
            name={value}
            size={14}
            radius={3}
            fallbackBackground={tint}
            fallbackColor="var(--c-ink-hi)"
            aria-hidden
            className="shrink-0"
          />
        ),
        selection: { kind: "source", value },
      };
    },
  );

  /* Cluster — uses the snapshot's cluster colors. Includes an
     "Unclustered" bucket when traces lack a clusterId. */
  const clusterById = new Map(clusters.map((c) => [c.id, c] as const));
  const clusterCounts = new Map<string | null, number>();
  for (const t of traces) {
    const key = t.clusterId ?? null;
    clusterCounts.set(key, (clusterCounts.get(key) ?? 0) + 1);
  }
  const clusterBuckets: CoverageBucket[] = Array.from(clusterCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map<CoverageBucket>(([id, count]) => {
      const cluster = id ? clusterById.get(id) ?? null : null;
      return {
        key: `cluster:${id ?? "__none__"}`,
        label: cluster?.label ?? "Unclustered",
        count,
        ratio: count / total,
        bar: "bg-l-ink-lo/40",
        dot: "bg-l-ink-dim",
        fill: cluster?.color,
        selection: id
          ? { kind: "cluster", value: id }
          : { kind: "cluster", value: "__unclustered__" },
        warn: cluster ? count <= 1 : false,
      };
    });

  /* Status — fixed buckets so empty ones still appear. */
  const statusCounts = countBy(traces, (t) => t.status);
  const statusBuckets: CoverageBucket[] = (
    [
      ["ok", "OK", "bg-l-status-done", "bg-l-status-done"],
      ["warn", "Warn", "bg-l-status-inprogress", "bg-l-status-inprogress"],
      ["error", "Error", "bg-l-p-urgent", "bg-l-p-urgent"],
    ] as const
  ).map(([value, label, bar, dot]) => {
    const count = statusCounts.get(value) ?? 0;
    return {
      key: `status:${value}`,
      label,
      count,
      ratio: count / total,
      bar,
      dot,
      selection: { kind: "status", value },
    };
  });

  /* Split — fixed buckets including Unassigned. */
  const splitBuckets: CoverageBucket[] = (
    [
      ["train", "Train", "bg-event-violet"],
      ["validation", "Validation", "bg-event-teal"],
      ["test", "Test", "bg-event-amber"],
      ["unassigned", "Unassigned", "bg-l-ink-dim"],
    ] as const
  ).map(([value, label, bar]) => {
    const count =
      value === "unassigned"
        ? traces.reduce((acc, t) => (t.split ? acc : acc + 1), 0)
        : traces.reduce((acc, t) => (t.split === value ? acc + 1 : acc), 0);
    return {
      key: `split:${value}`,
      label,
      count,
      ratio: count / total,
      bar,
      dot: bar,
      selection:
        value === "unassigned"
          ? { kind: "split", value: "unassigned" }
          : { kind: "split", value },
    };
  });

  const splitWarning = (() => {
    const train = splitBuckets.find((b) => b.key === "split:train")?.count ?? 0;
    const test = splitBuckets.find((b) => b.key === "split:test")?.count ?? 0;
    const validation =
      splitBuckets.find((b) => b.key === "split:validation")?.count ?? 0;
    if (train > 0 && test === 0 && validation === 0) {
      return "No validation or test traces — promote a few before running an eval.";
    }
    return undefined;
  })();

  return [
    { id: "source", title: "Source", buckets: sourceBuckets },
    { id: "cluster", title: "Cluster", buckets: clusterBuckets },
    { id: "status", title: "Status", buckets: statusBuckets },
    {
      id: "split",
      title: "Split",
      buckets: splitBuckets,
      warning: splitWarning,
    },
  ];
}

function countBy<T>(
  list: readonly T[],
  key: (t: T) => string | undefined | null,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const item of list) {
    const k = key(item);
    if (!k) continue;
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

function topN<K>(
  counts: Map<K, number>,
  n: number,
): Array<[K, number]> {
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (sorted.length <= n) return sorted;
  return sorted.slice(0, n);
}
