"use client";

import * as React from "react";
import { AlertTriangle, Check, X } from "lucide-react";

import { formatNumber, RelativeTime } from "../connections/time";
import { cx } from "../utils/cx";

import { AgentModelLabel } from "./agent-model-label";
import { AgentVersionBadge } from "./agent-version-badge";
import type { AgentSnapshot } from "./types";

/*
 * AgentMetricsStrip — Linear-density tile row at the top of the agent
 * detail Overview tab. Each tile is a 1px-bordered card with a mono
 * uppercase label and a sans-medium value.
 *
 *   [ Current version ] [ Success rate ] [ Latency p50/p95 ] [ Last run ]
 *
 * Mirrors `DatasetMetricsStrip` exactly — same grid, same density,
 * same chrome.
 */

export interface AgentMetricsStripProps {
  snapshot: AgentSnapshot;
  className?: string;
}

export function AgentMetricsStrip({
  snapshot,
  className,
}: AgentMetricsStripProps) {
  const { summary, versions, runs } = snapshot;

  const currentVersion =
    versions.find((v) => v.status === "current") ?? versions[0];

  const successPct = Math.round(summary.successRate * 100);
  const errorRuns = runs.filter((r) => r.status === "error").length;

  const successDurations = runs
    .filter((r) => r.status === "success" && typeof r.durationMs === "number")
    .map((r) => r.durationMs as number)
    .sort((a, b) => a - b);

  const p50 =
    successDurations.length > 0
      ? successDurations[Math.floor(successDurations.length * 0.5)]
      : undefined;
  const p95 =
    successDurations.length > 0
      ? successDurations[Math.floor(successDurations.length * 0.95)]
      : undefined;

  const totalTokens = runs.reduce(
    (acc, r) => acc + (r.response?.usage?.totalTokens ?? 0),
    0,
  );

  const successTone =
    successPct >= 95
      ? "text-event-green"
      : successPct >= 80
        ? "text-event-amber"
        : "text-event-red";
  const successLabel =
    successPct >= 95 ? "healthy" : successPct >= 80 ? "warning" : "failing";
  const SuccessIcon =
    successPct >= 95 ? Check : successPct >= 80 ? AlertTriangle : X;

  return (
    <div
      className={cx("grid grid-cols-2 gap-2 md:grid-cols-4", className)}
    >
      <Tile
        label="Current version"
        value={
          currentVersion ? (
            <AgentVersionBadge
              version={currentVersion.artifact.version}
              status="current"
              size="md"
            />
          ) : (
            "—"
          )
        }
        sub={
          <span className="flex items-center gap-1.5">
            <span>{formatNumber(summary.versionCount)} versions</span>
            <span aria-hidden>·</span>
            <AgentModelLabel
              model={currentVersion?.artifact.model ?? summary.model}
              size="xs"
            />
          </span>
        }
      />
      <Tile
        label="Success rate"
        value={
          summary.totalRuns === 0 ? (
            <span className={successTone}>—</span>
          ) : (
            <span className={cx("inline-flex items-center gap-2", successTone)}>
              <SuccessIcon
                className="size-4 shrink-0"
                strokeWidth={2}
                aria-hidden
              />
              {`${successPct}%`}
              <span className="sr-only">{` (${successLabel})`}</span>
            </span>
          )
        }
        sub={
          summary.totalRuns === 0
            ? "no runs yet"
            : `${formatNumber(summary.totalRuns - errorRuns)}/${formatNumber(
                summary.totalRuns,
              )} ok · ${formatNumber(errorRuns)} errored`
        }
      />
      <Tile
        label="Latency"
        value={
          <span className="flex items-baseline gap-2">
            <span className="text-l-ink">
              {p50 != null ? `${formatMs(p50)}` : "—"}
            </span>
            <span className="text-[11px] font-normal text-l-ink-dim">p50</span>
            <span className="text-[11px] font-normal text-l-ink-dim">/</span>
            <span className="text-l-ink-lo">
              {p95 != null ? `${formatMs(p95)}` : "—"}
            </span>
            <span className="text-[11px] font-normal text-l-ink-dim">p95</span>
          </span>
        }
        sub={
          totalTokens > 0
            ? `${formatNumber(totalTokens)} tokens used`
            : undefined
        }
      />
      <Tile
        label="Last run"
        value={
          summary.lastRunAt ? (
            <RelativeTime iso={summary.lastRunAt} fallback="—" />
          ) : (
            "—"
          )
        }
        sub={
          summary.lastDriftAt ? (
            <span className="text-event-amber">
              drift · <RelativeTime iso={summary.lastDriftAt} fallback="—" />
            </span>
          ) : summary.environment ? (
            `env: ${summary.environment}`
          ) : undefined
        }
      />
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[4px] border border-hairline-strong bg-l-surface-raised px-3 py-2.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-l-ink-dim">
        {label}
      </span>
      <span className="font-sans text-[18px] font-medium leading-tight tabular-nums text-l-ink">
        {value}
      </span>
      {sub ? (
        <span className="font-mono text-[10px] tracking-[0.04em] tabular-nums text-l-ink-dim">
          {sub}
        </span>
      ) : null}
    </div>
  );
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
