"use client";

import * as React from "react";
import { ArrowLeftRight, X } from "lucide-react";

import { cx } from "../utils/cx";
import { CompanyLogo } from "../icons";
import { formatNumber, formatStableDateTime } from "../connections/time";

import { DatasetSplitChip } from "./dataset-split-chip";
import { formatTraceDuration } from "./trace-summary-row";
import type { DatasetCluster, TraceStatus, TraceSummary } from "./types";

/*
 * DatasetTraceCompareDrawer — inline compare panel that swaps in
 * for the single-trace inspector when the user has exactly two
 * traces multi-selected. Mirrors the inspector's slide-in shape so
 * the parent layout doesn't shift (same width, same animation
 * properties, same close affordance).
 *
 * Surfaces the metadata fields builders look at first when
 * triaging dataset cleanups: status, cluster, split, source,
 * duration, event count, addedAt, addedBy, note. Cells with
 * differing values get an ember accent so the eye lands on
 * differences immediately. Anything that's identical is muted.
 */

const DEFAULT_WIDTH = 720;

export interface DatasetTraceCompareDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  left: TraceSummary | null;
  right: TraceSummary | null;
  clusters: readonly DatasetCluster[];
  /** Optional handler to swap left ↔ right with a single click. */
  onSwap?: () => void;
  width?: number;
  className?: string;
}

interface FieldRow {
  label: string;
  leftValue: React.ReactNode;
  rightValue: React.ReactNode;
  /** Raw form used for diff comparison. When omitted, derives from
   *  the React node value (best-effort). */
  diffKey: string | null;
}

export function DatasetTraceCompareDrawer({
  isOpen,
  onClose,
  left,
  right,
  clusters,
  onSwap,
  width = DEFAULT_WIDTH,
  className,
}: DatasetTraceCompareDrawerProps) {
  const visible = isOpen && left !== null && right !== null;

  /* Sticky last-pair so the panel slides closed with content rather
     than collapsing to empty mid-animation. */
  const [stickyPair, setStickyPair] = React.useState<{
    left: TraceSummary;
    right: TraceSummary;
  } | null>(null);
  React.useEffect(() => {
    if (left && right) setStickyPair({ left, right });
  }, [left, right]);

  /* Esc-to-close, scoped to when the panel is showing. */
  React.useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  const renderLeft = left ?? stickyPair?.left ?? null;
  const renderRight = right ?? stickyPair?.right ?? null;

  const clusterById = React.useMemo(
    () => new Map(clusters.map((c) => [c.id, c] as const)),
    [clusters],
  );

  return (
    <aside
      aria-label="Compare traces"
      aria-hidden={!visible}
      data-state={visible ? "open" : "closed"}
      className={cx(
        "shrink-0 self-stretch overflow-hidden border-l border-hairline-strong bg-l-surface-raised",
        "transition-[width,opacity] duration-200 ease-out motion-reduce:transition-none",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
        className,
      )}
      style={{ width: visible ? width : 0 }}
    >
      <div className="flex h-full flex-col" style={{ width }}>
        <header className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-hairline bg-l-surface-bar px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <ArrowLeftRight
              className="size-3.5 shrink-0 text-ember"
              strokeWidth={1.75}
              aria-hidden
            />
            <span className="font-sans text-[13px] font-medium text-l-ink">
              Compare 2 traces
            </span>
          </div>
          <div className="flex items-center gap-1">
            {onSwap ? (
              <button
                type="button"
                onClick={onSwap}
                aria-label="Swap left and right"
                className={cx(
                  "inline-flex h-7 items-center gap-1 rounded-md px-2 text-l-ink-dim",
                  "font-sans text-[11.5px]",
                  "hover:bg-l-surface-hover hover:text-l-ink",
                  "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
                  "[@media(pointer:coarse)]:h-9",
                )}
              >
                Swap
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Close compare"
              onClick={onClose}
              className={cx(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-l-ink-dim",
                "touch-manipulation [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11",
                "transition-colors duration-fast ease-out",
                "hover:bg-l-surface-hover hover:text-l-ink",
                "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
              )}
            >
              <X className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            </button>
          </div>
        </header>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {renderLeft && renderRight ? (
            <CompareGrid
              left={renderLeft}
              right={renderRight}
              clusters={clusterById}
            />
          ) : null}
        </div>
      </div>
    </aside>
  );
}

/* ── Grid ────────────────────────────────────────────────── */

function CompareGrid({
  left,
  right,
  clusters,
}: {
  left: TraceSummary;
  right: TraceSummary;
  clusters: ReadonlyMap<string, DatasetCluster>;
}) {
  const rows = React.useMemo<FieldRow[]>(
    () => buildFieldRows(left, right, clusters),
    [left, right, clusters],
  );
  /* Precompute differ flags so both columns agree on which rows
     to tint and screen readers can pick up "differs" on the row. */
  const diffSet = React.useMemo<ReadonlySet<string>>(() => {
    const set = new Set<string>();
    if (left.status !== right.status) set.add("Status");
    if ((left.clusterId ?? null) !== (right.clusterId ?? null)) set.add("Cluster");
    if ((left.split ?? null) !== (right.split ?? null)) set.add("Split");
    if (left.primarySource !== right.primarySource) set.add("Source");
    if (left.eventCount !== right.eventCount) set.add("Events");
    if (left.durationMs !== right.durationMs) set.add("Duration");
    if (left.startedAt !== right.startedAt) set.add("Started");
    if ((left.addedBy ?? null) !== (right.addedBy ?? null)) set.add("Added by");
    if ((left.note ?? null) !== (right.note ?? null)) set.add("Note");
    return set;
  }, [left, right]);

  return (
    <div className="grid grid-cols-2 divide-x divide-l-border-faint flex-1 min-h-0 overflow-auto">
      <CompareColumn trace={left} side="left" rows={rows} diffSet={diffSet} />
      <CompareColumn trace={right} side="right" rows={rows} diffSet={diffSet} />
    </div>
  );
}

function CompareColumn({
  trace,
  side,
  rows,
  diffSet,
}: {
  trace: TraceSummary;
  side: "left" | "right";
  rows: readonly FieldRow[];
  diffSet: ReadonlySet<string>;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex items-center gap-2 border-b border-l-border-faint px-3 py-2">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-[3px] border border-l-border-faint bg-l-surface-input"
          aria-hidden
        >
          <CompanyLogo
            name={trace.primarySource}
            size={14}
            radius={2}
            fallbackBackground="transparent"
            fallbackColor="var(--l-ink-dim)"
          />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-sans text-[12.5px] font-medium text-l-ink">
            {trace.label}
          </span>
          <span className="truncate font-mono text-[10.5px] text-l-ink-dim">
            {trace.traceId}
          </span>
        </div>
      </div>
      <dl className="flex flex-1 min-h-0 flex-col">
        {rows.map((row) => {
          const value = side === "left" ? row.leftValue : row.rightValue;
          const differs = diffSet.has(row.label);
          return (
            <div
              key={row.label}
              data-differs={differs || undefined}
              className={cx(
                "flex items-baseline gap-2 px-3 py-1.5",
                "border-b border-l-border-faint last:border-b-0",
                "min-h-[32px]",
                differs ? "bg-ember/[0.04]" : null,
              )}
            >
              <dt className="w-[88px] shrink-0 font-mono text-[10px] uppercase tracking-[0.06em] text-l-ink-dim">
                {row.label}
              </dt>
              <dd
                className={cx(
                  "flex-1 truncate font-sans text-[12px]",
                  differs ? "text-l-ink" : "text-l-ink-lo",
                )}
              >
                {value}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

/* ── Field rows ──────────────────────────────────────────── */

function buildFieldRows(
  left: TraceSummary,
  right: TraceSummary,
  clusters: ReadonlyMap<string, DatasetCluster>,
): FieldRow[] {
  return [
    {
      label: "Status",
      leftValue: <StatusInline status={left.status} />,
      rightValue: <StatusInline status={right.status} />,
      diffKey: "status",
    },
    {
      label: "Cluster",
      leftValue: <ClusterCell trace={left} clusters={clusters} />,
      rightValue: <ClusterCell trace={right} clusters={clusters} />,
      diffKey: `${left.clusterId ?? ""}|${right.clusterId ?? ""}`,
    },
    {
      label: "Split",
      leftValue: left.split ? (
        <DatasetSplitChip split={left.split} compact />
      ) : (
        <span className="text-l-ink-dim">—</span>
      ),
      rightValue: right.split ? (
        <DatasetSplitChip split={right.split} compact />
      ) : (
        <span className="text-l-ink-dim">—</span>
      ),
      diffKey: `${left.split ?? ""}|${right.split ?? ""}`,
    },
    {
      label: "Source",
      leftValue: <span>{left.primarySource}</span>,
      rightValue: <span>{right.primarySource}</span>,
      diffKey: "primarySource",
    },
    {
      label: "Events",
      leftValue: (
        <span className="font-mono tabular-nums">
          {formatNumber(left.eventCount)}
        </span>
      ),
      rightValue: (
        <span className="font-mono tabular-nums">
          {formatNumber(right.eventCount)}
        </span>
      ),
      diffKey: "eventCount",
    },
    {
      label: "Duration",
      leftValue: (
        <span className="font-mono tabular-nums">
          {formatTraceDuration(left.durationMs)}
        </span>
      ),
      rightValue: (
        <span className="font-mono tabular-nums">
          {formatTraceDuration(right.durationMs)}
        </span>
      ),
      diffKey: "durationMs",
    },
    {
      label: "Started",
      leftValue: (
        <span className="font-mono text-[11px]">
          {formatStableDateTime(left.startedAt)}
        </span>
      ),
      rightValue: (
        <span className="font-mono text-[11px]">
          {formatStableDateTime(right.startedAt)}
        </span>
      ),
      diffKey: "startedAt",
    },
    {
      label: "Added by",
      leftValue: <span className="font-mono text-[11px]">{left.addedBy ?? "—"}</span>,
      rightValue: <span className="font-mono text-[11px]">{right.addedBy ?? "—"}</span>,
      diffKey: "addedBy",
    },
    {
      label: "Note",
      leftValue: left.note ? (
        <span className="line-clamp-3 whitespace-pre-wrap text-[12px] text-l-ink-lo">
          {left.note}
        </span>
      ) : (
        <span className="text-l-ink-dim">—</span>
      ),
      rightValue: right.note ? (
        <span className="line-clamp-3 whitespace-pre-wrap text-[12px] text-l-ink-lo">
          {right.note}
        </span>
      ) : (
        <span className="text-l-ink-dim">—</span>
      ),
      diffKey: "note",
    },
  ];
}

/* ── Cells ───────────────────────────────────────────────── */

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
    <span className={cx("inline-flex items-center gap-1.5 font-medium", meta.text)}>
      <span aria-hidden className={cx("size-1.5 rounded-pill", meta.color)} />
      {meta.label}
    </span>
  );
}

function ClusterCell({
  trace,
  clusters,
}: {
  trace: TraceSummary;
  clusters: ReadonlyMap<string, DatasetCluster>;
}) {
  if (!trace.clusterId) {
    return <span className="text-l-ink-dim">—</span>;
  }
  const cluster = clusters.get(trace.clusterId);
  if (!cluster) return <span className="text-l-ink-dim">{trace.clusterId}</span>;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-pill"
        style={{ background: cluster.color }}
      />
      <span className="truncate">{cluster.label}</span>
    </span>
  );
}
