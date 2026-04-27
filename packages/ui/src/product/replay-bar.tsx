import * as React from "react";
import { cx } from "../utils/cx";

/**
 * ReplayBar — dual progress bar comparing a baseline run to a candidate
 * run's similarity %. Baseline is green @ low opacity, candidate is the
 * ember highlight.
 */
export interface ReplayBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100 value. */
  value: number;
  variant?: "baseline" | "candidate";
  /** Label to the left, e.g. "BASELINE v2.8". */
  label?: React.ReactNode;
  /** Right-side readout, e.g. "98.4% match" or "62.1% — FAIL". */
  readout?: React.ReactNode;
  /** Readout tone — maps to event palette. */
  tone?: "green" | "amber" | "red" | "neutral";
}

const tones: Record<NonNullable<ReplayBarProps["tone"]>, string> = {
  green: "text-event-green",
  amber: "text-event-amber",
  red: "text-event-red",
  neutral: "text-ink-dim",
};

export function ReplayBar({
  value,
  variant = "baseline",
  label,
  readout,
  tone = "neutral",
  className,
  ...props
}: ReplayBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cx("flex flex-col gap-[6px]", className)} {...props}>
      {(label || readout) && (
        <div className="flex items-baseline justify-between font-mono text-mono-sm uppercase tracking-eyebrow text-ink-dim">
          <span>{label}</span>
          {readout ? <span className={tones[tone]}>{readout}</span> : null}
        </div>
      )}
      <div className="relative h-[6px] overflow-hidden rounded-[3px] bg-white/[0.06]">
        <span
          className={cx(
            "absolute bottom-0 left-0 top-0",
            variant === "baseline" ? "bg-event-green opacity-40" : "bg-ember"
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
