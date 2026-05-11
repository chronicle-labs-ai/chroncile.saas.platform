"use client";

import * as React from "react";
import { cx } from "../utils/cx";

/*
 * WatchPill — collapsible "Watch the walkthrough" trigger that
 * sits at the bottom of a connector modal. When collapsed, renders
 * as a single-row pill (`▶ Watch the walkthrough · 1:12`). When
 * expanded, the parent reveals a `<VideoPlayer>` underneath; the
 * pill itself is just the trigger.
 */

export interface WatchPillProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "onChange"
> {
  /** Whether the player is currently expanded. Drives the chevron. */
  expanded: boolean;
  /** Toggle handler. */
  onChange: (next: boolean) => void;
  /** Display duration ("1:12"). */
  duration?: string;
  /** Trigger label. Default "Watch the walkthrough". */
  label?: React.ReactNode;
}

export function WatchPill({
  expanded,
  onChange,
  duration,
  label = "Watch the walkthrough",
  className,
  ...rest
}: WatchPillProps) {
  return (
    <button
      type="button"
      data-expanded={expanded || undefined}
      aria-expanded={expanded}
      onClick={() => onChange(!expanded)}
      className={cx("watch-pill", className)}
      {...rest}
    >
      <span className="watch-pill-ico" aria-hidden>
        <svg viewBox="0 0 12 12" width={10} height={10}>
          <path d="M3 2l6 4-6 4V2z" fill="currentColor" />
        </svg>
      </span>
      <span className="watch-pill-label">{label}</span>
      {duration ? <span className="watch-pill-dur">{duration}</span> : null}
      <span className="watch-pill-chev" aria-hidden>
        {expanded ? "▾" : "▸"}
      </span>
    </button>
  );
}
