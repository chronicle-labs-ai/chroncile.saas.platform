"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import type { AgentVersionStatus } from "./types";

/*
 * AgentVersionBadge — semver chip with a status tone.
 *
 *   v1.0.0   (deprecated, dimmed)
 *   v1.1.0   (stable, neutral)
 *   v1.2.0   (current, ember)
 *   v0.0.0   (draft, dotted border)
 *
 * Used on `AgentVersionRow`, the detail-page header chip, and the
 * version timeline rail. Pure presentational — no click handler.
 */

export interface AgentVersionBadgeProps {
  version: string;
  status?: AgentVersionStatus;
  size?: "sm" | "md";
  /** When true, render with a leading "v" so the chip reads as a tag. */
  withV?: boolean;
  className?: string;
}

const TONE_CLASSES: Record<AgentVersionStatus, string> = {
  current: "border-ember/55 bg-ember/12 text-ember",
  stable: "border-l-border bg-l-surface-input text-l-ink-lo",
  deprecated:
    "border-l-border-faint bg-transparent text-l-ink-dim line-through decoration-l-ink-dim/60",
  draft:
    "border-dashed border-l-border-faint bg-transparent text-l-ink-dim",
};

export function AgentVersionBadge({
  version,
  status = "stable",
  size = "sm",
  withV = true,
  className,
}: AgentVersionBadgeProps) {
  return (
    <span
      data-status={status}
      className={cx(
        "inline-flex items-center rounded-[2px] border font-mono tracking-[0.02em]",
        size === "sm" && "h-5 px-1.5 text-[11px]",
        size === "md" && "h-6 px-2 text-[12px]",
        TONE_CLASSES[status],
        className,
      )}
    >
      {withV ? "v" : ""}
      {version}
    </span>
  );
}
