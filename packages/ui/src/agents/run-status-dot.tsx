"use client";

import * as React from "react";

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
 */

export interface RunStatusDotProps {
  status: AgentRunStatus;
  /** Force the pulsing halo on. */
  pulse?: boolean;
  /** Larger glyph for empty states / hero counters. */
  size?: "sm" | "md";
  className?: string;
}

export function RunStatusDot({
  status,
  pulse,
  size = "sm",
  className,
}: RunStatusDotProps) {
  const variant =
    status === "success"
      ? "green"
      : status === "error"
        ? "red"
        : "amber";

  return (
    <StatusDot
      variant={variant}
      pulse={pulse ?? status === "started"}
      halo={status === "started"}
      data-size={size}
      className={className}
    />
  );
}
