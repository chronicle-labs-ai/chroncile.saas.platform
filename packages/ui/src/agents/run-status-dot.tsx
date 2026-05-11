"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import { StatusDot } from "../primitives/status-dot";
import type { AgentRunStatus } from "./types";

/*
 * RunStatusDot — wraps the existing `<StatusDot>` primitive with the
 * three run statuses the wrapper emits:
 *
 *   started → amber, pulsing
 *   success → green
 *   error   → red
 *
 * Optional `pulse` flag forces the pulsing halo on regardless of
 * status — useful for the "live runs in progress" widget on the
 * Overview tab.
 *
 * Accessibility: status is conveyed by colour, so we always emit a
 * screen-reader-only word ("Success", "Error", "Running"). Pass
 * `showLabel` to render the word visibly next to the dot for callers
 * who don't already include the status in surrounding text.
 */

const STATUS_LABELS: Record<AgentRunStatus, string> = {
  success: "Success",
  error: "Error",
  started: "Running",
};

const STATUS_TONES: Record<AgentRunStatus, string> = {
  success: "text-event-green",
  error: "text-event-red",
  started: "text-event-amber",
};

export interface RunStatusDotProps {
  status: AgentRunStatus;
  /** Force the pulsing halo on. */
  pulse?: boolean;
  /** Larger glyph for empty states / hero counters. */
  size?: "sm" | "md";
  /** Render the status word visibly next to the dot. */
  showLabel?: boolean;
  /** Override the visible / sr-only label (defaults to the status word). */
  label?: string;
  className?: string;
}

export function RunStatusDot({
  status,
  pulse,
  size = "sm",
  showLabel = false,
  label,
  className,
}: RunStatusDotProps) {
  const variant =
    status === "success"
      ? "green"
      : status === "error"
        ? "red"
        : "amber";

  const word = label ?? STATUS_LABELS[status];

  return (
    <span className={cx("inline-flex items-center gap-1.5", className)}>
      <StatusDot
        variant={variant}
        pulse={pulse ?? status === "started"}
        halo={status === "started"}
        data-size={size}
      />
      {showLabel ? (
        <span className={cx("font-sans text-[12px]", STATUS_TONES[status])}>
          {word}
        </span>
      ) : (
        <span className="sr-only">{word}</span>
      )}
    </span>
  );
}
