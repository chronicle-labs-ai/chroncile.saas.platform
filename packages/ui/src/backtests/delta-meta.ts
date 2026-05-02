/*
 * Backtests · Delta meta — turn (signed value × higher-is-better)
 * into a tone for the `BacktestDelta` chip and a formatted label.
 */

import type { BacktestDivergenceDelta } from "./types";

export type DeltaTone = "good" | "bad" | "neutral";

/**
 * Compute a delta tone given a signed value and a "higher is better"
 * flag. Values within the noise window of zero collapse to `neutral`.
 */
export function computeDeltaTone(value: number, higherIsBetter: boolean, noise = 0.05): DeltaTone {
  if (Math.abs(value) < noise) return "neutral";
  const good = (higherIsBetter && value > 0) || (!higherIsBetter && value < 0);
  return good ? "good" : "bad";
}

/** Format a delta number with the right sign + precision for the
 *  metrics-table cell. Uses 2 decimals when |v| < 10, otherwise 1. */
export function formatDeltaNumber(value: number): string {
  const sign = value > 0 ? "+" : "";
  const fixed = Math.abs(value) < 10 ? value.toFixed(2) : value.toFixed(1);
  return `${sign}${fixed}`;
}

/** Map the divergence-delta string to a tone for tag/dot rendering. */
export function divergenceDeltaTone(delta: BacktestDivergenceDelta): DeltaTone {
  if (delta === "improvement") return "good";
  if (delta === "regression") return "bad";
  return "neutral";
}

/** Map a delta tone to one of `<Tag>`'s built-in variants. */
export function deltaTagVariant(tone: DeltaTone): "green" | "red" | "neutral" {
  if (tone === "good") return "green";
  if (tone === "bad") return "red";
  return "neutral";
}
