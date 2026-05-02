/*
 * BacktestsManager — page-level surface for the backtests flow.
 *
 * Owns the stage state machine (`configure → running → results`),
 * the recipe under test, and the run name shown in the top nav.
 * Each stage is rendered by a self-contained child surface
 * (`BacktestConfigure`, `BacktestRunning`, `BacktestResults`).
 *
 * Mostly uncontrolled — every transition is also surfaced via
 * callbacks so apps can wire backend persistence later.
 */

"use client";

import * as React from "react";

import { cx } from "../utils/cx";

import { BacktestNav } from "./backtest-nav";
import { BacktestConfigure } from "./configure/backtest-configure";
import { BacktestRunning } from "./running/backtest-running";
import { BacktestResults } from "./results/backtest-results";
import { BACKTEST_DIVERGENCES, BACKTEST_METRICS } from "./data";
import type {
  BacktestDivergence,
  BacktestMetric,
  BacktestRecipe,
  BacktestRunStatus,
  BacktestStage,
} from "./types";

export interface BacktestsManagerProps {
  /** Initial stage. Defaults to `configure`. */
  initialStage?: BacktestStage;
  /** Initial recipe — when set, the manager skips the JobsPicker
   *  and lands directly on the recipe view. */
  initialRecipe?: BacktestRecipe | null;
  /** Override divergences shown on Results / Running. */
  divergences?: readonly BacktestDivergence[];
  /** Override metrics shown on the Results metrics table. */
  metrics?: readonly BacktestMetric[];
  /** Workspace label rendered in the top nav. */
  workspace?: string;
  /** Hide the top BacktestNav — useful when embedding the surface
   *  inside another shell that already provides chrome. */
  hideNav?: boolean;
  /** Notified when the user launches a full run. */
  onLaunch?: (recipe: BacktestRecipe) => void;
  /** Notified when the user finishes the running stage. */
  onFinish?: () => void;
  /** Notified when the user promotes a candidate from Results. */
  onPromote?: (agentId: string) => void;
  className?: string;
}

export function BacktestsManager({
  initialStage = "configure",
  initialRecipe = null,
  divergences = BACKTEST_DIVERGENCES,
  metrics = BACKTEST_METRICS,
  workspace = "chronicle",
  hideNav = false,
  onLaunch,
  onFinish,
  onPromote,
  className,
}: BacktestsManagerProps) {
  const [stage, setStage] = React.useState<BacktestStage>(initialStage);
  const [recipe, setRecipe] = React.useState<BacktestRecipe | null>(initialRecipe);

  const runName = React.useMemo(() => {
    if (stage === "configure" && !recipe) return "new backtest";
    return recipe?.name || "new backtest";
  }, [stage, recipe]);

  const runStatus: BacktestRunStatus | null = React.useMemo(() => {
    if (stage === "running") return "running";
    if (stage === "results") return "done";
    return null;
  }, [stage]);

  const handleLaunch = React.useCallback(
    (next: BacktestRecipe) => {
      setRecipe(next);
      setStage("running");
      onLaunch?.(next);
    },
    [onLaunch],
  );

  const handleFinish = React.useCallback(() => {
    setStage("results");
    onFinish?.();
  }, [onFinish]);

  return (
    <div className={cx("flex h-full min-h-0 flex-col bg-surface-00 text-ink", className)}>
      {hideNav ? null : (
        <BacktestNav
          stage={stage}
          onStageChange={setStage}
          runName={runName}
          runStatus={runStatus}
          workspace={workspace}
        />
      )}
      <div className="flex-1 overflow-auto">
        {stage === "configure" ? (
          <BacktestConfigure
            initialRecipe={recipe}
            onRecipeChange={setRecipe}
            onLaunch={handleLaunch}
          />
        ) : null}
        {stage === "running" && recipe ? (
          <BacktestRunning
            recipe={recipe}
            divergences={divergences}
            onFinish={handleFinish}
            onAbort={() => setStage("configure")}
          />
        ) : null}
        {stage === "results" && recipe ? (
          <BacktestResults
            recipe={recipe}
            metrics={metrics}
            divergences={divergences}
            onPromote={onPromote}
            onEditRecipe={() => setStage("configure")}
          />
        ) : null}
      </div>
    </div>
  );
}
