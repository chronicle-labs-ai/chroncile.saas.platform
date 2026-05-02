/*
 * BacktestConfigure — Stage 1 phase router (Variant D from the
 * mockup). Handles the `pick → recipe` transition and threads the
 * recipe state up to the parent manager via `onRecipeChange`.
 */

"use client";

import * as React from "react";

import { cx } from "../../utils/cx";
import { cloneRecipe } from "../data";
import type { BacktestConfigurePhase, BacktestJobPreset, BacktestRecipe } from "../types";

import { BacktestJobsPicker } from "./backtest-jobs-picker";
import { BacktestRecipe as RecipeView } from "./backtest-recipe";

export interface BacktestConfigureProps {
  /** Pre-seeded recipe — when set, lands on the recipe view. */
  initialRecipe?: BacktestRecipe | null;
  /** Notified every time the recipe changes (including initial pick). */
  onRecipeChange?: (recipe: BacktestRecipe | null) => void;
  /** Called when the user clicks "launch full run". */
  onLaunch?: (recipe: BacktestRecipe) => void;
  className?: string;
}

export function BacktestConfigure({
  initialRecipe = null,
  onRecipeChange,
  onLaunch,
  className,
}: BacktestConfigureProps) {
  const [phase, setPhase] = React.useState<BacktestConfigurePhase>(
    initialRecipe ? "recipe" : "pick",
  );
  const [recipe, setRecipeState] = React.useState<BacktestRecipe | null>(initialRecipe);

  const setRecipe = React.useCallback(
    (next: BacktestRecipe | null) => {
      setRecipeState(next);
      onRecipeChange?.(next);
    },
    [onRecipeChange],
  );

  const handlePick = (job: BacktestJobPreset) => {
    const next = cloneRecipe(job.recipe);
    setRecipe(next);
    setPhase("recipe");
  };

  const handleStartOver = () => {
    setRecipe(null);
    setPhase("pick");
  };

  const handleLaunch = (next: BacktestRecipe) => {
    setRecipe(next);
    onLaunch?.(next);
  };

  return (
    <div className={cx("flex h-full min-h-0 flex-col", className)}>
      {phase === "pick" ? <BacktestJobsPicker onPick={handlePick} /> : null}
      {phase === "recipe" && recipe ? (
        <RecipeView
          recipe={recipe}
          onRecipeChange={setRecipe}
          onBack={() => setPhase("pick")}
          onStartOver={handleStartOver}
          onLaunch={handleLaunch}
        />
      ) : null}
    </div>
  );
}
