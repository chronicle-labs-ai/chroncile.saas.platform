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
import {
  isRecipeLaunchable,
  recipeAgentCount,
  recipeCaseCount,
  recipeEnrichmentCount,
} from "../data";

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
  const enriched = recipeEnrichmentCount(recipe);
  const totalRuns = cases * agents;
  const etaMinutes = Math.max(1, Math.round((totalRuns * 0.45) / 60 / Math.max(1, workers)));
  const cost = (totalRuns * 0.0022).toFixed(2);
  const launchable = isRecipeLaunchable(recipe);

  const reason = launchReason(recipe);

  return (
    <div
      className={cx(
        "flex flex-wrap items-center justify-between gap-3 rounded-md border border-l-border-faint bg-l-wash-1 px-3 py-2.5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
        <Stat label="versions" value={agents.toString()} />
        <Stat label="cases" value={cases.toLocaleString()} />
        <Stat label="enriched" value={enriched.toString()} />
        <Stat label="env" value={recipe.environment ? "1" : "—"} />
        <Stat label="runs" value={totalRuns.toLocaleString()} />
        <Stat label="eta" value={`~${etaMinutes}m`} />
        <Stat label="cost" value={`$${cost}`} />
      </div>

      <div className="flex items-center gap-1.5">
        {!launchable && reason ? (
          <span className="hidden font-mono text-[11px] tabular-nums text-l-ink-dim md:inline">
            {reason}
          </span>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<Sparkles className="size-3.5" strokeWidth={1.6} />}
          onClick={onQuickCheck}
          disabled={!launchable}
        >
          Quick check
          <span className="ml-1.5 border-l border-l-border-faint pl-1.5 font-mono text-mono-sm text-l-ink-dim">
            30 · ~40s
          </span>
        </Button>
        <Button
          variant="primary"
          size="sm"
          leadingIcon={<Play className="size-3.5" fill="currentColor" />}
          onClick={() => onLaunch?.(recipe)}
          disabled={!launchable}
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

function launchReason(recipe: BacktestRecipe): string | null {
  if (recipe.data.sources.length === 0 && !recipe.data.dataset) {
    return "pick a dataset to launch";
  }
  if (!recipe.environment) {
    return "pick an environment to launch";
  }
  if (recipe.agents.length === 0) {
    return "pick at least one agent version";
  }
  return null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Eyebrow className="text-l-ink-dim">{label}</Eyebrow>
      <span className="font-sans text-[14px] font-medium leading-none text-l-ink-hi tabular-nums">
        {value}
      </span>
    </div>
  );
}
