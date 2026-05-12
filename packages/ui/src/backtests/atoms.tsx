/*
 * Backtests · Atoms — micro components used 3+ times across the
 * stage screens. Kept inside `backtests/` (not exported globally)
 * because they wrap existing primitives with feature-specific copy
 * + sign logic.
 *
 * Atoms here:
 *
 *   - CandidateHueDot — 6/8 px circle painted with the agent hue.
 *   - BacktestDelta   — `Tag` with the +/- formatter and tone logic.
 *   - SeverityDot     — colored dot for divergence severity.
 *   - BacktestAnchorSparkline — sparkline with a baseline-anchor
 *     dashed line, used in the Results metrics table.
 */

"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import { Tag } from "../primitives/tag";
import {
  computeDeltaTone,
  deltaTagVariant,
  formatDeltaNumber,
  type DeltaTone,
} from "./delta-meta";
import type { BacktestDivergenceSeverity } from "./types";

/* ── CandidateHueDot ───────────────────────────────────────── */

export interface CandidateHueDotProps {
  hue: string;
  size?: "xs" | "sm" | "md";
  className?: string;
}

const HUE_DOT_SIZE: Record<NonNullable<CandidateHueDotProps["size"]>, string> = {
  xs: "size-1.5",
  sm: "size-2",
  md: "size-2.5",
};

/** A small circle painted with the agent's hue. Used in pills,
 *  candidate rows, score cards, and metrics-table headers. */
export function CandidateHueDot({ hue, size = "sm", className }: CandidateHueDotProps) {
  return (
    <span
      aria-hidden
      className={cx("inline-block rounded-full", HUE_DOT_SIZE[size], className)}
      style={{ background: hue }}
    />
  );
}

/* ── SeverityDot ───────────────────────────────────────────── */

const SEVERITY_HUE: Record<BacktestDivergenceSeverity, string> = {
  high: "var(--c-event-red)",
  medium: "var(--c-event-amber)",
  low: "var(--c-event-teal)",
};

export function SeverityDot({
  severity,
  className,
}: {
  severity: BacktestDivergenceSeverity;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      title={`severity: ${severity}`}
      className={cx("inline-block size-1.5 rounded-full", className)}
      style={{ background: SEVERITY_HUE[severity] }}
    />
  );
}

/* ── BacktestDelta ─────────────────────────────────────────── */

export interface BacktestDeltaProps {
  value: number;
  unit?: string;
  /** Whether higher numbers are better. Drives the tone. */
  higherIsBetter: boolean;
  className?: string;
}

export function BacktestDelta({
  value,
  unit,
  higherIsBetter,
  className,
}: BacktestDeltaProps) {
  const tone = computeDeltaTone(value, higherIsBetter);
  return (
    <Tag variant={deltaTagVariant(tone)} className={cx("font-mono", className)}>
      {formatDeltaNumber(value)}
      {unit ?? ""}
    </Tag>
  );
}

/** Same as `BacktestDelta` but the caller has already computed the
 *  tone (useful when displaying things like
 *  `improvement / regression / neutral`). */
export function BacktestToneTag({
  tone,
  children,
  className,
}: {
  tone: DeltaTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tag variant={deltaTagVariant(tone)} className={className}>
      {children}
    </Tag>
  );
}

/* ── BacktestAnchorSparkline ───────────────────────────────── */

export interface BacktestAnchorSparklineProps {
  values: number[];
  /** Baseline value anchor — rendered as a dashed horizontal line. */
  anchor?: number;
  width?: number;
  height?: number;
  /** CSS color for the line + area fill. Defaults to ember. */
  stroke?: string;
  fill?: boolean;
  className?: string;
}

export function BacktestAnchorSparkline({
  values,
  anchor,
  width = 80,
  height = 20,
  stroke = "var(--c-ember)",
  fill = true,
  className,
}: BacktestAnchorSparklineProps) {
  if (values.length === 0) return null;
  const min = Math.min(...values, anchor ?? Infinity);
  const max = Math.max(...values, anchor ?? -Infinity);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return [x, y] as const;
  });
  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const anchorY =
    anchor === undefined
      ? null
      : height - ((anchor - min) / range) * (height - 2) - 1;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cx("block", className)}
      aria-hidden
    >
      {fill ? <path d={areaPath} fill={stroke} fillOpacity="0.10" /> : null}
      {anchorY !== null ? (
        <line
          x1="0"
          x2={width}
          y1={anchorY}
          y2={anchorY}
          stroke="var(--c-ink-faint)"
          strokeDasharray="2 2"
          strokeWidth="1"
        />
      ) : null}
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="1.2" />
    </svg>
  );
}

/* ── Status pill helpers (live / done / paused) ────────────── */

export type RunStatusTone = "live" | "done" | "paused";

const RUN_STATUS_LABEL: Record<RunStatusTone, string> = {
  live: "running",
  done: "done",
  paused: "paused",
};

const RUN_STATUS_HUE: Record<RunStatusTone, string> = {
  live: "var(--c-event-green)",
  done: "var(--c-event-teal)",
  paused: "var(--c-ink-dim)",
};

export function RunStatusPill({ tone, className }: { tone: RunStatusTone; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-pill border border-hairline px-2 py-0.5",
        "font-mono text-mono-sm uppercase tracking-tactical text-ink-lo",
        className,
      )}
    >
      <span
        aria-hidden
        className={cx("size-1.5 rounded-full", tone === "live" && "animate-pulse")}
        style={{ background: RUN_STATUS_HUE[tone] }}
      />
      {RUN_STATUS_LABEL[tone]}
    </span>
  );
}
