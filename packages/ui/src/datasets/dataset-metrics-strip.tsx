"use client";

import * as React from "react";

import { formatNumber, RelativeTime } from "../connections/time";
import { cx } from "../utils/cx";

import type { DatasetSnapshot } from "./types";

/*
 * DatasetMetricsStrip — compact Linear-density tile row showing
 * top-level dataset numbers on the Overview tab. Each tile is a
 * 1px-bordered card with a mono uppercase label and a sans-medium
 * value — no Kalice display, no shadow.
 */

export interface DatasetMetricsStripProps {
  snapshot: DatasetSnapshot;
  className?: string;
}

export function DatasetMetricsStrip({
  snapshot,
  className,
}: DatasetMetricsStripProps) {
  const { dataset, traces, clusters } = snapshot;

  const splitCounts = React.useMemo(() => {
    let train = 0;
    let validation = 0;
    let test = 0;
    let unassigned = 0;
    for (const trace of traces) {
      switch (trace.split) {
        case "train":
          train++;
          break;
        case "validation":
          validation++;
          break;
        case "test":
          test++;
          break;
        default:
          unassigned++;
      }
    }
    return { train, validation, test, unassigned };
  }, [traces]);

  return (
    <div
      className={cx(
        "grid grid-cols-2 gap-2 md:grid-cols-4",
        className,
      )}
    >
      <Tile
        label="Traces"
        value={formatNumber(traces.length)}
        sub={
          dataset.eventCount != null
            ? `${formatNumber(dataset.eventCount)} events`
            : undefined
        }
      />
      <Tile
        label="Clusters"
        value={formatNumber(clusters.length)}
        sub={
          clusters.length > 0
            ? `${formatNumber(
                Math.round(
                  traces.length / Math.max(clusters.length, 1),
                ),
              )} avg per cluster`
            : "no clusters yet"
        }
      />
      <Tile
        label="Splits"
        value={
          <span className="flex items-baseline gap-2">
            <span className="text-l-ink">{splitCounts.train}</span>
            <span className="text-[11px] font-normal text-l-ink-dim">/</span>
            <span className="text-l-ink-lo">{splitCounts.validation}</span>
            <span className="text-[11px] font-normal text-l-ink-dim">/</span>
            <span className="text-event-teal">{splitCounts.test}</span>
          </span>
        }
        sub={`train · validation · test${
          splitCounts.unassigned > 0
            ? ` · ${splitCounts.unassigned} unassigned`
            : ""
        }`}
      />
      <Tile
        label="Last updated"
        value={
          <RelativeTime iso={dataset.updatedAt ?? new Date(0).toISOString()} fallback="—" />
        }
        sub={dataset.createdBy ? `by ${dataset.createdBy}` : undefined}
      />
    </div>
  );
}

interface TileProps {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
}

function Tile({ label, value, sub }: TileProps) {
  return (
    <div className="flex flex-col gap-1 rounded-[4px] border border-hairline-strong bg-l-surface-raised px-3 py-2.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-l-ink-dim">
        {label}
      </span>
      <span className="font-sans text-[18px] font-medium leading-tight text-l-ink">
        {value}
      </span>
      {sub ? (
        <span className="font-mono text-[10px] tracking-[0.04em] text-l-ink-dim">
          {sub}
        </span>
      ) : null}
    </div>
  );
}
