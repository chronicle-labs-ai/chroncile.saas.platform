"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cx } from "../utils/cx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../primitives/collapsible";
import { formatNumber } from "../connections/time";

import { DatasetTracesTableRow } from "./dataset-traces-table-row";
import type { DatasetCluster, TraceSummary } from "./types";

/*
 * DatasetClusterCard — collapsible card that lists one cluster's
 * member traces. Used in the Clusters tab and the cluster legend on
 * the Overview tab.
 */

export interface DatasetClusterCardProps {
  cluster: DatasetCluster;
  /** All traces in the dataset; the card filters down to its members. */
  traces: readonly TraceSummary[];
  /** Optional override — when provided, takes precedence over the
   *  filter-by-cluster.traceIds default. */
  members?: readonly TraceSummary[];
  /** Default expansion state. Defaults to true for the first card. */
  defaultOpen?: boolean;
  /** Selection handler propagated to the inner trace rows. */
  onSelectTrace?: (traceId: string) => void;
  /** Currently selected trace id (highlighted). */
  selectedTraceId?: string | null;
  /** Optional cap on visible rows; the rest are surfaced via a
   *  "Show all N traces" button. Defaults to no cap. */
  initialVisible?: number;
  className?: string;
}

export function DatasetClusterCard({
  cluster,
  traces,
  members,
  defaultOpen = true,
  onSelectTrace,
  selectedTraceId,
  initialVisible,
  className,
}: DatasetClusterCardProps) {
  const memberTraces = React.useMemo<readonly TraceSummary[]>(() => {
    if (members) return members;
    const idSet = new Set(cluster.traceIds);
    return traces.filter((t) => idSet.has(t.traceId));
  }, [cluster.traceIds, members, traces]);

  const [showAll, setShowAll] = React.useState(initialVisible == null);
  const visibleTraces =
    initialVisible != null && !showAll
      ? memberTraces.slice(0, initialVisible)
      : memberTraces;
  const hiddenCount = memberTraces.length - visibleTraces.length;

  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className={cx(
        "rounded-[4px] border border-hairline-strong bg-l-surface-raised",
        className,
      )}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cx(
            "group flex w-full items-center gap-3 px-3 py-2",
            "text-left font-sans text-[12.5px] text-l-ink",
            "hover:bg-l-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40",
          )}
        >
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-pill"
            style={{ background: cluster.color }}
          />
          <span className="flex-1 truncate font-medium text-l-ink">
            {cluster.label}
          </span>
          <span className="font-mono text-[11px] text-l-ink-dim">
            {formatNumber(memberTraces.length)}{" "}
            {memberTraces.length === 1 ? "trace" : "traces"}
          </span>
          <ChevronDown
            className="size-3.5 text-l-ink-dim transition-transform duration-fast group-data-[state=open]:rotate-180 group-data-[state=closed]:rotate-0"
            strokeWidth={1.75}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-t border-l-border-faint">
          {cluster.description ? (
            <p className="px-3 py-2 font-sans text-[11.5px] text-l-ink-dim">
              {cluster.description}
            </p>
          ) : null}
          {visibleTraces.length === 0 ? (
            <div className="px-3 py-3 text-center font-mono text-[11px] text-l-ink-dim">
              No traces in this cluster yet.
            </div>
          ) : (
            <div className="divide-y divide-l-border-faint">
              {visibleTraces.map((trace) => (
                <DatasetTracesTableRow
                  key={trace.traceId}
                  trace={trace}
                  cluster={null}
                  rowHeightPx={36}
                  isActive={trace.traceId === selectedTraceId}
                  onSelect={onSelectTrace}
                  asDiv
                />
              ))}
            </div>
          )}
          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className={cx(
                "flex w-full items-center justify-center gap-1.5 px-3 py-2",
                "border-t border-l-border-faint",
                "font-sans text-[11.5px] text-l-ink-lo",
                "hover:bg-l-surface-hover hover:text-l-ink",
              )}
            >
              Show all {formatNumber(memberTraces.length)} traces
            </button>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
