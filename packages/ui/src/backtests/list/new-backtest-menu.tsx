/*
 * NewBacktestMenu — split-button + dropdown for kicking off a new
 * backtest configuration. Replaces the full-page JobsPicker as the
 * canonical entry to the configure pipeline.
 *
 *   [+ New backtest ▾]
 *     ─ Replay      replay production traffic across versions
 *     ─ Compare     A/B candidates on a curated dataset
 *     ─ Regression  guard last-known-good vs candidate
 *     ─ Suite       re-run a saved eval suite
 *
 * Each menu item invokes `onPick` with the corresponding preset; the
 * parent (`BacktestsManager`) clones the recipe and routes to the
 * Configure stage, landing directly on Step 01.
 */

"use client";

import * as React from "react";
import { ChevronDown, Plus } from "lucide-react";

import { cx } from "../../utils/cx";
import { Button } from "../../primitives/button";
import { Mono } from "../../typography/mono";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../primitives/dropdown-menu";
import { JobIcon } from "../job-meta";
import { BACKTEST_JOB_PRESETS } from "../data";
import type { BacktestJobPreset } from "../types";

export interface NewBacktestMenuProps {
  /** Override the preset list. Defaults to `BACKTEST_JOB_PRESETS`. */
  presets?: readonly BacktestJobPreset[];
  /** Called with the selected preset. */
  onPick?: (preset: BacktestJobPreset) => void;
  /** Override the trigger label. */
  label?: string;
  className?: string;
}

export function NewBacktestMenu({
  presets = BACKTEST_JOB_PRESETS,
  onPick,
  label = "New backtest",
  className,
}: NewBacktestMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button
          variant="primary"
          size="sm"
          leadingIcon={<Plus className="size-3.5" strokeWidth={1.8} />}
          trailingIcon={<ChevronDown className="size-3.5" strokeWidth={1.6} />}
          className={className}
        >
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[280px]">
        {presets.map((preset) => (
          <DropdownMenuItem
            key={preset.id}
            onAction={() => onPick?.(preset)}
            className="flex items-start gap-2.5 py-2"
          >
            <span
              aria-hidden
              className={cx(
                "mt-0.5 grid size-6 shrink-0 place-items-center rounded-[2px] border border-l-border-faint bg-l-wash-1",
              )}
              style={{ color: preset.hue }}
            >
              <JobIcon kind={preset.icon} className="size-3.5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-sans text-[12.5px] font-medium leading-none text-l-ink-hi">
                {preset.title}
              </span>
              <Mono size="sm" tone="dim" className="leading-snug">
                {preset.sub}
              </Mono>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
