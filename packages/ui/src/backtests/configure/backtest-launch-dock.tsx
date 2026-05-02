/*
 * BacktestLaunchDock — bottom dock on the recipe view: stat row +
 * "quick check · 30 cases" CTA + "launch full run" CTA.
 *
 * Linear-density stats — small mono labels above 17 px sans-medium
 * values. No serif display numbers.
 */

"use client";

import * as React from "react";
import { Play, Sparkles } from "lucide-react";

import { cx } from "../../utils/cx";
import { Button } from "../../primitives/button";
import { Eyebrow } from "../../primitives/eyebrow";

import type { BacktestRecipe } from "../types";
import { recipeAgentCount, recipeCaseCount } from "../data";

export interface BacktestLaunchDockProps {
  recipe: BacktestRecipe;
  /** Override worker pool size (defaults to 32). */
  workers?: number;
  onQuickCheck?: () => void;
  onLaunch?: (recipe: BacktestRecipe) => void;
  className?: string;
}

export function BacktestLaunchDock({
  recipe,
  workers = 32,
  onQuickCheck,
  onLaunch,
  className,
}: BacktestLaunchDockProps) {
  const agents = recipeAgentCount(recipe);
  const cases = recipeCaseCount(recipe);
  const totalRuns = cases * agents;
  const etaMinutes = Math.max(1, Math.round((totalRuns * 0.45) / 60 / Math.max(1, workers)));
  const cost = (totalRuns * 0.0022).toFixed(2);

  return (
    <div
      className={cx(
        "flex flex-wrap items-center justify-between gap-3 rounded-[2px] border border-divider bg-[rgba(255,255,255,0.012)] px-3 py-2.5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
        <Stat label="agents" value={agents.toString()} />
        <Stat label="cases" value={cases.toLocaleString()} />
        <Stat label="runs" value={totalRuns.toLocaleString()} />
        <Stat label="workers" value={workers.toString()} />
        <Stat label="eta" value={`~${etaMinutes}m`} />
        <Stat label="cost" value={`$${cost}`} />
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          density="compact"
          size="sm"
          leadingIcon={<Sparkles className="size-3.5" strokeWidth={1.6} />}
          onClick={onQuickCheck}
        >
          Quick check
          <span className="ml-1.5 border-l border-hairline pl-1.5 font-mono text-mono-sm text-ink-dim">
            30 · ~40s
          </span>
        </Button>
        <Button
          variant="primary"
          density="compact"
          size="sm"
          leadingIcon={<Play className="size-3.5" fill="currentColor" />}
          onClick={() => onLaunch?.(recipe)}
        >
          Launch
          <span className="ml-1.5 border-l border-black/15 pl-1.5 font-mono text-mono-sm opacity-75">
            ~{etaMinutes}m · ${cost}
          </span>
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Eyebrow className="text-ink-dim">{label}</Eyebrow>
      <span className="font-sans text-[14px] font-medium leading-none text-ink-hi">
        {value}
      </span>
    </div>
  );
}
