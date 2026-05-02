/*
 * BacktestRecipe — Phase 2 of Configure. Renders the recipe header
 * (back link + name input + start-over), the one-sentence recipe
 * strip with click-to-toggle pills, the inline editor area, and the
 * launch dock.
 *
 * Linear-density: 12.5–13 px sans body throughout, name input is a
 * tight inline field (no display heading), editor area is just a
 * hairline panel.
 */

"use client";

import * as React from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";

import { cx } from "../../utils/cx";
import { Eyebrow } from "../../primitives/eyebrow";
import { Mono } from "../../typography/mono";

import {
  BacktestRecipeStrip,
  type BacktestRecipePart,
} from "./backtest-recipe-strip";
import { BacktestLaunchDock } from "./backtest-launch-dock";
import { BacktestAgentsEditor } from "./backtest-agents-editor";
import { BacktestDataBuilder } from "./backtest-data-builder";
import { BacktestGraderBuilder } from "./backtest-grader-builder";
import { BacktestQuickCheckDrawer } from "./backtest-quick-check-drawer";

import type {
  BacktestRecipe as BacktestRecipeType,
  BacktestQuickCheckState,
} from "../types";

export interface BacktestRecipeProps {
  recipe: BacktestRecipeType;
  /** Notified every time the recipe changes. */
  onRecipeChange?: (recipe: BacktestRecipeType) => void;
  /** Click handler for the "back to jobs picker" link. */
  onBack?: () => void;
  /** Click handler for the "start over" button. */
  onStartOver?: () => void;
  /** Click handler for the launch CTA. */
  onLaunch?: (recipe: BacktestRecipeType) => void;
  /** Initial open editor (story-only). */
  initialOpenPart?: BacktestRecipePart | null;
  /** Initial quick-check state — `running` | `done` | null. */
  initialQuickCheck?: BacktestQuickCheckState | null;
  className?: string;
}

export function BacktestRecipe({
  recipe,
  onRecipeChange,
  onBack,
  onStartOver,
  onLaunch,
  initialOpenPart = null,
  initialQuickCheck = null,
  className,
}: BacktestRecipeProps) {
  const [open, setOpen] = React.useState<BacktestRecipePart | null>(initialOpenPart);
  const [quickCheck, setQuickCheck] = React.useState<BacktestQuickCheckState | null>(
    initialQuickCheck,
  );
  const [quickProgress, setQuickProgress] = React.useState(
    initialQuickCheck === "done" ? 100 : initialQuickCheck === "running" ? 32 : 0,
  );

  const update = React.useCallback(
    (patch: Partial<BacktestRecipeType>) => {
      onRecipeChange?.({ ...recipe, ...patch });
    },
    [onRecipeChange, recipe],
  );

  React.useEffect(() => {
    if (quickCheck !== "running") return;
    let raf = 0;
    const start = performance.now();
    const duration = 4200;
    const tick = (now: number) => {
      const pct = Math.min(100, ((now - start) / duration) * 100);
      setQuickProgress(pct);
      if (pct >= 100) {
        setQuickCheck("done");
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [quickCheck]);

  const startQuickCheck = () => {
    setQuickProgress(0);
    setQuickCheck("running");
  };

  const closeQuickCheck = () => {
    setQuickCheck(null);
    setQuickProgress(0);
  };

  const togglePart = (part: BacktestRecipePart) => {
    setOpen((current) => (current === part ? null : part));
  };

  return (
    <div
      className={cx(
        "mx-auto flex w-full max-w-5xl flex-col gap-3 px-6 py-5",
        className,
      )}
    >
      {/* Top row: back · name · start over */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-divider pb-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-[12.5px] text-ink-lo transition-colors hover:text-ink-hi"
        >
          <ArrowLeft className="size-3.5" strokeWidth={1.6} />
          change starting point
        </button>

        <div className="flex flex-1 items-center justify-center gap-3">
          <Eyebrow className="text-ember">RECIPE</Eyebrow>
          <input
            type="text"
            value={recipe.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="name this run"
            className={cx(
              "min-w-0 max-w-md flex-1 border-b border-transparent bg-transparent",
              "font-display text-[18px] leading-none tracking-[-0.03em] text-ink-hi",
              "outline-none transition-colors",
              "hover:border-divider focus:border-hairline-strong",
              "placeholder:font-sans placeholder:text-[14px] placeholder:tracking-normal placeholder:text-ink-dim",
            )}
          />
          {recipe.seed ? (
            <Mono size="sm" tone="dim">
              seed · {recipe.seed}
            </Mono>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onStartOver}
          className="inline-flex items-center gap-1 rounded-[2px] border border-divider px-2 py-1 text-[12.5px] text-ink-lo transition-colors hover:border-hairline-strong hover:text-ink-hi"
        >
          <RotateCcw className="size-3" strokeWidth={1.6} />
          Start over
        </button>
      </div>

      <BacktestRecipeStrip recipe={recipe} open={open} onTogglePart={togglePart} />

      <div
        className={cx(
          "rounded-[2px] border border-divider bg-[rgba(255,255,255,0.012)]",
          open ? "p-3" : "px-3 py-3",
        )}
      >
        {open === "agents" ? (
          <BacktestAgentsEditor
            agents={recipe.agents}
            onChange={(agents) => update({ agents })}
            onClose={() => setOpen(null)}
          />
        ) : null}
        {open === "data" ? (
          <BacktestDataBuilder
            data={recipe.data}
            onChange={(data) => update({ data })}
            onClose={() => setOpen(null)}
          />
        ) : null}
        {open === "graders" ? (
          <BacktestGraderBuilder
            graders={recipe.graders}
            data={recipe.data}
            onChange={(graders) => update({ graders })}
            onClose={() => setOpen(null)}
          />
        ) : null}
        {open === null ? (
          <div className="flex h-16 items-center justify-center">
            <Mono tone="dim" size="sm">
              click any pill above to edit · or run a quick check ↓
            </Mono>
          </div>
        ) : null}
      </div>

      <BacktestLaunchDock
        recipe={recipe}
        onQuickCheck={startQuickCheck}
        onLaunch={onLaunch}
      />

      {quickCheck ? (
        <BacktestQuickCheckDrawer
          isOpen
          state={quickCheck}
          progress={quickProgress}
          recipe={recipe}
          onClose={closeQuickCheck}
          onLaunch={() => onLaunch?.(recipe)}
        />
      ) : null}
    </div>
  );
}
