"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import { formatNumber } from "../connections/time";

import type { AgentRun } from "./types";

/*
 * AgentPulseBar — last-24h success/error sparkline rendered alongside
 * the configuration canvas. Each column is one hour; bars stack
 * `success` (event-green) below `error` (event-red) so the user can
 * spot regressions without parsing colors.
 *
 * Below the bars, a single tabular-nums line summarizes the window:
 *
 *   95% ok · p50 320ms / p95 2.1s · 12.4k tokens
 *
 * No animation — the component is rendered next to dense config
 * sections and re-running it on every chip toggle would be noise. The
 * height grid is fixed so toggling filters never reflows the canvas.
 */

export interface AgentPulseBarProps {
  runs: readonly AgentRun[];
  /** Anchor "now" for the 24h window. Defaults to the most recent run
   *  in `runs`, or the current wall clock when `runs` is empty. */
  nowMs?: number;
  className?: string;
}

const HOURS = 24;
const HOUR_MS = 60 * 60 * 1000;

export function AgentPulseBar({
  runs,
  nowMs,
  className,
}: AgentPulseBarProps) {
  const buckets = React.useMemo(
    () => bucketize(runs, nowMs),
    [runs, nowMs],
  );
  const summary = React.useMemo(() => summarize(runs), [runs]);

  const peak = Math.max(1, ...buckets.map((b) => b.success + b.error));

  return (
    <div
      className={cx(
        "flex flex-col gap-2 rounded-[4px] border border-hairline-strong bg-l-surface-raised p-3",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-l-ink-dim">
          Pulse · 24h
        </span>
        <span
          className={cx(
            "font-sans text-[11px] tabular-nums",
            summary.totalRuns === 0
              ? "text-l-ink-dim"
              : summary.successRate >= 0.95
                ? "text-event-green"
                : summary.successRate >= 0.8
                  ? "text-event-amber"
                  : "text-event-red",
          )}
        >
          {summary.totalRuns === 0 ? "no runs" : `${Math.round(summary.successRate * 100)}% ok`}
        </span>
      </div>

      <div
        className="grid h-[36px] items-end gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${HOURS}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`Hourly run pulse for the last 24 hours: ${summary.totalRuns} runs total, ${Math.round(summary.successRate * 100)} percent successful`}
      >
        {buckets.map((bucket, idx) => {
          const total = bucket.success + bucket.error;
          const pct = total === 0 ? 0 : total / peak;
          const successPct =
            total === 0 ? 0 : bucket.success / total;
          return (
            <span
              key={idx}
              title={
                total === 0
                  ? "no runs"
                  : `${bucket.success} ok · ${bucket.error} errored`
              }
              className="relative flex h-full w-full items-end overflow-hidden rounded-[1px] bg-l-wash-2"
              aria-hidden
            >
              <span
                className="absolute inset-x-0 bottom-0 bg-event-red"
                style={{ height: `${pct * 100}%` }}
              />
              <span
                className="absolute inset-x-0 bottom-0 bg-event-green"
                style={{ height: `${pct * successPct * 100}%` }}
              />
            </span>
          );
        })}
      </div>

      <div className="flex items-baseline justify-between gap-2 font-sans text-[11px] tabular-nums text-l-ink-dim">
        <span>
          p50{" "}
          <span className="text-l-ink">
            {summary.p50 != null ? formatMs(summary.p50) : "—"}
          </span>{" "}
          / p95{" "}
          <span className="text-l-ink-lo">
            {summary.p95 != null ? formatMs(summary.p95) : "—"}
          </span>
        </span>
        <span>
          {summary.totalTokens > 0
            ? `${formatNumber(summary.totalTokens)} tokens`
            : `${formatNumber(summary.totalRuns)} runs · 24h`}
        </span>
      </div>
    </div>
  );
}

interface PulseBucket {
  success: number;
  error: number;
}

function bucketize(
  runs: readonly AgentRun[],
  nowMs: number | undefined,
): PulseBucket[] {
  const fallback = runs[0]
    ? Date.parse(runs[0].finishedAt ?? runs[0].startedAt)
    : Date.now();
  const anchor = nowMs ?? fallback;
  const start = anchor - HOURS * HOUR_MS;
  const buckets: PulseBucket[] = Array.from({ length: HOURS }, () => ({
    success: 0,
    error: 0,
  }));
  for (const run of runs) {
    const ts = Date.parse(run.finishedAt ?? run.startedAt);
    if (Number.isNaN(ts)) continue;
    if (ts < start || ts > anchor) continue;
    const idx = Math.min(
      HOURS - 1,
      Math.max(0, Math.floor((ts - start) / HOUR_MS)),
    );
    if (run.status === "success") buckets[idx]!.success += 1;
    else if (run.status === "error") buckets[idx]!.error += 1;
  }
  return buckets;
}

interface PulseSummary {
  totalRuns: number;
  successRate: number;
  p50?: number;
  p95?: number;
  totalTokens: number;
}

function summarize(runs: readonly AgentRun[]): PulseSummary {
  const totalRuns = runs.length;
  const success = runs.filter((r) => r.status === "success").length;
  const successRate = totalRuns === 0 ? 0 : success / totalRuns;

  const durations = runs
    .filter((r) => r.status === "success" && typeof r.durationMs === "number")
    .map((r) => r.durationMs as number)
    .sort((a, b) => a - b);
  const p50 =
    durations.length > 0
      ? durations[Math.floor(durations.length * 0.5)]
      : undefined;
  const p95 =
    durations.length > 0
      ? durations[Math.floor(durations.length * 0.95)]
      : undefined;

  const totalTokens = runs.reduce(
    (acc, r) => acc + (r.response?.usage?.totalTokens ?? 0),
    0,
  );

  return { totalRuns, successRate, p50, p95, totalTokens };
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
