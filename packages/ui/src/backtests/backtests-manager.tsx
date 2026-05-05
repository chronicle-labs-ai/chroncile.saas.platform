/*
 * BacktestsManager — page-level surface for the backtests flow.
 *
 * Owns the stage state machine and the recipe under test:
 *
 *   list → configure → running → results
 *
 * `list` is the manager landing — a Linear-density table of past /
 * scheduled / draft runs with a `+ New backtest` split-button. Picking
 * a preset clones the recipe and routes to `configure`, which in turn
 * walks the user through the directional pipeline (steps 01..04).
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
import { BacktestsList } from "./list/backtests-list";
import {
  BACKTEST_DIVERGENCES,
  BACKTEST_METRICS,
  BACKTEST_RUNS_SEED,
  cloneRecipe,
  hydrateRecipeFromRun,
} from "./data";
import type {
  BacktestDivergence,
  BacktestJobPreset,
  BacktestMetric,
  BacktestRecipe,
  BacktestRunStatus,
  BacktestRunSummary,
  BacktestStage,
} from "./types";
import type { Dataset } from "../stream-timeline/types";
import type { AgentSummary } from "../agents/types";
import type { SandboxEnvironment } from "../environments/types";

export interface BacktestsManagerProps {
  /** Initial stage. Defaults to `list`. */
  initialStage?: BacktestStage;
  /** Initial recipe — when set, the manager skips the list and lands
   *  directly on the configure pipeline (Step 01). */
  initialRecipe?: BacktestRecipe | null;
  /** Override divergences shown on Results / Running. */
  divergences?: readonly BacktestDivergence[];
  /** Override metrics shown on the Results metrics table. */
  metrics?: readonly BacktestMetric[];
  /** Override the run rows shown on the list view. */
  runs?: readonly BacktestRunSummary[];
  /** Workspace label rendered in the top nav. */
  workspace?: string;
  /** Hide the top BacktestNav — useful when embedding the surface
   *  inside another shell that already provides chrome. */
  hideNav?: boolean;
  /** Real datasets the host app provides for step 01. Falls back to
   *  internal mock catalog when not passed. */
  availableDatasets?: readonly Dataset[];
  /** Real environments the host app provides for step 03. Falls back
   *  to `BACKTEST_ENVIRONMENTS_SEED` when not passed. */
  availableEnvironments?: readonly SandboxEnvironment[];
  /** Real agents the host app provides for step 04. Falls back to
   *  `BACKTEST_CANDIDATES` when not passed. */
  availableAgents?: readonly AgentSummary[];
  /** Notified when the user launches a full run. */
  onLaunch?: (recipe: BacktestRecipe) => void;
  /** Notified when the user finishes the running stage. */
  onFinish?: () => void;
  /** Notified when the user promotes a candidate from Results. */
  onPromote?: (agentId: string) => void;
  /** Notified when the user picks a preset to start a new run. */
  onCreateRun?: (preset: BacktestJobPreset) => void;
  /** Notified when the user opens an existing run from the list. */
  onOpenRun?: (run: BacktestRunSummary) => void;
  className?: string;
}

export function BacktestsManager({
  initialStage = "list",
  initialRecipe = null,
  divergences = BACKTEST_DIVERGENCES,
  metrics = BACKTEST_METRICS,
  runs = BACKTEST_RUNS_SEED,
  workspace = "chronicle",
  hideNav = false,
  availableDatasets,
  availableEnvironments,
  availableAgents,
  onLaunch,
  onFinish,
  onPromote,
  onCreateRun,
  onOpenRun,
  className,
}: BacktestsManagerProps) {
  const [stage, setStage] = React.useState<BacktestStage>(
    initialRecipe && initialStage === "list" ? "configure" : initialStage,
  );
  const [recipe, setRecipe] = React.useState<BacktestRecipe | null>(initialRecipe);

  const runName = React.useMemo(() => {
    if (stage === "list") return "all";
    if (stage === "configure" && !recipe) return "new backtest";
    return recipe?.name || "new backtest";
  }, [stage, recipe]);

  const runStatus: BacktestRunStatus | null = React.useMemo(() => {
    if (stage === "running") return "running";
    if (stage === "results") return "done";
    return null;
  }, [stage]);

  const handleCreateRun = React.useCallback(
    (preset: BacktestJobPreset) => {
      const cloned = cloneRecipe(preset.recipe);
      setRecipe(cloned);
      setStage("configure");
      onCreateRun?.(preset);
    },
    [onCreateRun],
  );

  const handleOpenRun = React.useCallback(
    (run: BacktestRunSummary) => {
      onOpenRun?.(run);
      // Hydrate a recipe from the row metadata so Configure /
      // Running / Results have something real to render. The backend
      // will replace this with a fetch by run id later.
      const hydrated = hydrateRecipeFromRun(run);
      setRecipe(hydrated);
      if (run.status === "running") {
        setStage("running");
      } else if (run.status === "done" || run.status === "failed") {
        setStage("results");
      } else {
        setStage("configure");
      }
    },
    [onOpenRun],
  );

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

  const handleStageChange = React.useCallback(
    (next: BacktestStage) => {
      // Allow freely jumping between configure / running / results
      // when there's a recipe; "list" is always reachable.
      if (next === "list") {
        setStage("list");
        return;
      }
      if (!recipe) {
        // No recipe yet — bounce to list so the user can pick or create.
        setStage("list");
        return;
      }
      setStage(next);
    },
    [recipe],
  );

  const showNav = !hideNav && stage !== "list";

  return (
    <div
      className={cx(
        "flex h-full min-h-0 flex-col bg-l-surface text-l-ink",
        className,
      )}
    >
      {showNav ? (
        <BacktestNav
          stage={stage}
          onStageChange={handleStageChange}
          onBackToList={() => setStage("list")}
          runName={runName}
          runStatus={runStatus}
          workspace={workspace}
        />
      ) : null}
      <div className={cx("min-h-0 flex-1", stage === "list" ? "" : "overflow-auto")}>
        {stage === "list" ? (
          <BacktestsList
            runs={runs}
            onCreateRun={handleCreateRun}
            onPickRun={handleOpenRun}
            workspace={workspace}
          />
        ) : null}
        {stage === "configure" ? (
          <BacktestConfigure
            initialRecipe={recipe}
            onRecipeChange={setRecipe}
            onLaunch={handleLaunch}
            onModeChange={(presetRecipe) => setRecipe(presetRecipe)}
            onBackToList={() => setStage("list")}
            availableDatasets={availableDatasets}
            availableEnvironments={availableEnvironments}
            availableAgents={availableAgents}
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
