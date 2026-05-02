"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import { StatusDot, type StatusDotVariant } from "../primitives/status-dot";
import { type ConnectionHealth } from "./data";

/*
 * ConnectionHealthBadge — small status pill that surfaces the
 * operational state of a connection. Drops into list rows, cards,
 * and the detail drawer head. Uses `StatusDot` + the `text-event-*`
 * token palette.
 */

export interface ConnectionHealthBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  health: ConnectionHealth;
  /** Pulse the dot. Defaults to true for "live" / "testing" / "error". */
  pulse?: boolean;
  /** Hide the trailing label, render only the dot. */
  iconOnly?: boolean;
  size?: "sm" | "md";
}

const HEALTH_DOT: Record<ConnectionHealth, StatusDotVariant> = {
  live: "green",
  paused: "amber",
  error: "red",
  expired: "amber",
  testing: "ember",
  disconnected: "offline",
};

const HEALTH_LABEL: Record<ConnectionHealth, string> = {
  live: "Live",
  paused: "Paused",
  error: "Error",
  expired: "Expired",
  testing: "Testing",
  disconnected: "Disconnected",
};

const HEALTH_TONE: Record<ConnectionHealth, string> = {
  live: "text-event-green",
  paused: "text-event-amber",
  error: "text-event-red",
  expired: "text-event-amber",
  testing: "text-ember",
  disconnected: "text-ink-dim",
};

const DEFAULT_PULSE: ReadonlyArray<ConnectionHealth> = [
  "live",
  "testing",
  "error",
];

export function ConnectionHealthBadge({
  health,
  pulse,
  iconOnly,
  size = "md",
  className,
  ...rest
}: ConnectionHealthBadgeProps) {
  const shouldPulse = pulse ?? DEFAULT_PULSE.includes(health);
  const label = HEALTH_LABEL[health];
  return (
    <span
      role="status"
      aria-label={label}
      className={cx(
        "inline-flex items-center gap-[6px] font-mono uppercase tracking-tactical",
        size === "sm" ? "text-mono-sm" : "text-mono",
        HEALTH_TONE[health],
        className,
      )}
      {...rest}
    >
      <StatusDot variant={HEALTH_DOT[health]} pulse={shouldPulse} />
      {iconOnly ? null : <span>{label}</span>}
    </span>
  );
}
