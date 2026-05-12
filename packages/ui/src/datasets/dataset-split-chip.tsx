"use client";

import * as React from "react";

import { cx } from "../utils/cx";

import type { DatasetSplit } from "./types";

/*
 * DatasetSplitChip — small Linear-style label pill identifying which
 * split a trace was assigned to (train / validation / test). Splits
 * are *labels* not *statuses* — they're intentionally low-contrast,
 * neutral, and never glow ember.
 */

export interface DatasetSplitChipProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  split: DatasetSplit | null | undefined;
  /** Render a thinner version with no leading dot. */
  compact?: boolean;
}

const SPLIT_LABEL: Record<DatasetSplit, string> = {
  train: "Train",
  validation: "Validation",
  test: "Test",
};

const SPLIT_DOT: Record<DatasetSplit, string> = {
  train: "bg-l-ink-lo",
  validation: "bg-l-status-inprogress",
  test: "bg-event-teal",
};

export function DatasetSplitChip({
  split,
  compact,
  className,
  ...props
}: DatasetSplitChipProps) {
  if (!split) return null;
  return (
    <span
      data-split={split}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-[2px] border border-l-border-faint bg-l-surface-input",
        "font-sans text-[11px] font-medium leading-none text-l-ink-lo",
        compact ? "px-1.5 py-[3px]" : "px-2 py-[4px]",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cx("size-1.5 rounded-pill", SPLIT_DOT[split])}
      />
      {SPLIT_LABEL[split]}
    </span>
  );
}
