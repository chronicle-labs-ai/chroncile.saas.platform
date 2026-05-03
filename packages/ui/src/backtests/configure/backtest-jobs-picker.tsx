/*
 * BacktestJobsPicker — Phase 1 of the Configure stage. Four tight
 * cards representing the canonical "what are you trying to find
 * out?" starting points (compare / regression / bug / suite). Each
 * card shows the preset title, a one-line "why", and a preloads
 * summary (`N agents · M cases · K graders`).
 *
 * Picking a card hands the cloned recipe back to the parent.
 *
 * Linear-density layout:
 *   - small h1 (18 px display, tight tracking) — not a hero
 *   - 2-column card grid, 2 px radii, hairline borders
 *   - mono-sm uppercase eyebrows, 13.5 px sans body
 */

"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";

import { cx } from "../../utils/cx";
import { Eyebrow } from "../../primitives/eyebrow";
import { Mono } from "../../typography/mono";
import { JobIcon } from "../job-meta";
import {
  BACKTEST_JOB_PRESETS,
  BACKTEST_RECENT_RUNS,
  recipeAgentCount,
  recipeCaseCount,
} from "../data";
import { CandidateHueDot } from "../atoms";
import type { BacktestRecentRun } from "../data";
import type { BacktestJobPreset, BacktestRecipe } from "../types";

export interface BacktestJobsPickerProps {
  /** Override the 4 starting jobs. Defaults to `BACKTEST_JOB_PRESETS`. */
  jobs?: readonly BacktestJobPreset[];
  /** Recent runs strip at the bottom of the picker. */
  recentRuns?: readonly BacktestRecentRun[];
  /** Hide the recent-runs strip. */
  hideRecent?: boolean;
  onPick?: (job: BacktestJobPreset) => void;
  className?: string;
}

export function BacktestJobsPicker({
  jobs = BACKTEST_JOB_PRESETS,
  recentRuns = BACKTEST_RECENT_RUNS,
  hideRecent = false,
  onPick,
  className,
}: BacktestJobsPickerProps) {
  return (
    <div
      className={cx(
        "mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 py-8",
        className,
      )}
    >
      <header className="flex flex-col gap-1.5">
        <Eyebrow className="text-ember">NEW BACKTEST</Eyebrow>
        <h1 className="font-display text-[18px] leading-none tracking-[-0.03em] text-ink-hi">
          What are you trying to find out?
        </h1>
        <p className="text-[13px] text-ink-lo">
          Pick a starting point — we&rsquo;ll fill in the run with sensible defaults. Tweak
          anything, and try a 30-case quick check before the full sweep.
        </p>
      </header>

      <div className="grid gap-2 sm:grid-cols-2">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} onPick={onPick} />
        ))}
      </div>

      {hideRecent || recentRuns.length === 0 ? null : (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow className="text-ink-dim">RECENT</Eyebrow>
            {recentRuns.map((run) => (
              <RecentRunButton key={run.id} run={run} />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-[2px] border border-divider px-2 py-1 font-sans text-[12.5px] text-ink-lo transition-colors hover:border-hairline-strong hover:text-ink-hi"
            >
              Templates
            </button>
            <button
              type="button"
              className="rounded-[2px] border border-divider px-2 py-1 font-sans text-[12.5px] text-ink-lo transition-colors hover:border-hairline-strong hover:text-ink-hi"
            >
              Paste YAML
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

function JobCard({
  job,
  onPick,
}: {
  job: BacktestJobPreset;
  onPick?: (job: BacktestJobPreset) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick?.(job)}
      className={cx(
        "group relative flex items-start gap-3 rounded-[2px] border border-divider bg-wash-micro px-3 py-3 text-left",
        "transition-colors duration-fast hover:border-hairline-strong hover:bg-wash-2",
      )}
    >
      <span
        aria-hidden
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[2px] border border-hairline bg-surface-02"
        style={{ color: job.hue }}
      >
        <JobIcon kind={job.icon} className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline gap-1.5">
          <span className="font-sans text-[13.5px] font-medium text-ink-hi">{job.title}</span>
          <span className="truncate text-[12.5px] text-ink-lo">{job.sub}</span>
        </div>
        <p className="text-[12.5px] leading-snug text-ink-lo">{job.why}</p>
        <Mono size="sm" tone="dim" className="mt-0.5">
          {recipeSummary(job.recipe)}
        </Mono>
      </div>
      <ArrowRight
        className="mt-1 size-3.5 shrink-0 text-ink-dim transition-colors group-hover:text-ember"
        strokeWidth={1.6}
      />
    </button>
  );
}

function RecentRunButton({ run }: { run: BacktestRecentRun }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-[2px] border border-transparent px-1.5 py-0.5 font-sans text-[12.5px] text-ink-lo transition-colors hover:border-divider hover:bg-wash-2 hover:text-ink-hi"
    >
      <CandidateHueDot hue={run.hue} size="xs" />
      <span>{run.name}</span>
      <Mono size="sm" tone="dim">
        · {run.ago} · {run.verdict}
      </Mono>
    </button>
  );
}

function recipeSummary(recipe: BacktestRecipe): string {
  const a = recipeAgentCount(recipe);
  const c = recipeCaseCount(recipe);
  const g = recipe.graders.length;
  return `${a} agent${a === 1 ? "" : "s"} · ${c.toLocaleString()} cases · ${g} grader${g === 1 ? "" : "s"}`;
}
