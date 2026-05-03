/*
 * BacktestRecipePill — interactive pill rendered inside the recipe
 * strip. Each pill represents one of the three recipe parts (agents,
 * data, graders); clicking opens the matching inline editor.
 *
 * Linear-density: 2 px radius, hairline border, no glow when active —
 * just a brighter border + ember caret.
 */

"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { cx } from "../../utils/cx";
import { Eyebrow } from "../../primitives/eyebrow";

export interface BacktestRecipePillProps {
  /** Eyebrow label rendered above the pill body (e.g. "agents"). */
  label: string;
  /** Pill content — usually a small flex row of chips. */
  children: React.ReactNode;
  open?: boolean;
  onToggle?: () => void;
  className?: string;
}

export function BacktestRecipePill({
  label,
  children,
  open = false,
  onToggle,
  className,
}: BacktestRecipePillProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      data-open={open || undefined}
      className={cx(
        "group inline-flex flex-col items-start gap-0.5 rounded-[2px] border bg-wash-micro px-2.5 py-1.5 text-left",
        "transition-colors duration-fast",
        open
          ? "border-ember/45 bg-row-active"
          : "border-divider hover:border-hairline-strong hover:bg-wash-2",
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        <Eyebrow className="text-ink-dim">{label}</Eyebrow>
        <span aria-hidden className={open ? "text-ember" : "text-ink-dim"}>
          {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </span>
      </div>
      <span className="flex items-center gap-1.5 font-sans text-[12.5px] text-ink-hi">
        {children}
      </span>
    </button>
  );
}
