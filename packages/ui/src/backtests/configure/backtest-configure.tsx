/*
 * BacktestConfigure — Stage 1 of the backtests flow.
 *
 * Directional pipeline:
 *
 *   dataset → enrich → environment → versions → launch
 *
 * The host (`BacktestsManager`) seeds `initialRecipe` from a preset
 * picked on the list view, so this surface lands the user directly
 * on Step 01 instead of a marketing-style picker.
 *
 * Visual chrome mirrors `DatasetsManager` — full-width
 * `bg-l-surface` page, big display hero header, Linear-density
 * panels in `bg-l-wash-1` with `border-l-border-faint`. The Replay
 * preset auto-skips the Enrich step.
 */

"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, ChevronDown, List } from "lucide-react";

import { cx } from "../../utils/cx";
import { Button } from "../../primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../primitives/dropdown-menu";
import {
  BACKTEST_JOB_PRESETS,
  cloneRecipe,
  isDatasetStepDone,
  isEnrichStepDone,
  isEnvironmentStepDone,
  isVersionsStepDone,
} from "../data";
import { BACKTEST_PIPELINE_STEPS } from "../types";
import type {
  BacktestPipelineStep,
  BacktestJobMode,
  BacktestJobPreset,
  BacktestQuickCheckState,
  BacktestRecipe,
} from "../types";
import type { Dataset } from "../../stream-timeline/types";
import type { AgentSummary } from "../../agents/types";
import type { SandboxEnvironment } from "../../environments/types";

import { BacktestStepper } from "./backtest-stepper";
import { BacktestSummaryStrip } from "./backtest-summary-strip";
import { BacktestLaunchDock } from "./backtest-launch-dock";
import { BacktestQuickCheckDrawer } from "./backtest-quick-check-drawer";
import { JobIcon } from "../job-meta";
import { StepDataset } from "./steps/step-dataset";
import { StepEnrich } from "./steps/step-enrich";
import { StepEnvironment } from "./steps/step-environment";
import { StepVersions } from "./steps/step-versions";

export interface BacktestConfigureProps {
  /** Pre-seeded recipe — when set, lands on the recipe pipeline. */
  initialRecipe?: BacktestRecipe | null;
  /** Initial pipeline step to focus when a recipe is provided. */
  initialStep?: BacktestPipelineStep;
  /** Notified every time the recipe changes (including initial pick). */
  onRecipeChange?: (recipe: BacktestRecipe | null) => void;
  /** Called when the user clicks "launch full run". */
  onLaunch?: (recipe: BacktestRecipe) => void;
  /** Called when the user reseeds the recipe from a different
   *  preset via the inline `Mode ▾` switcher. */
  onModeChange?: (recipe: BacktestRecipe) => void;
  /** Called when the user clicks the "all backtests" link to return
   *  to the manager list view. */
  onBackToList?: () => void;
  /** Optional registry of saved datasets, environments, and agents
   *  passed by the host app so the steps can render real options.
   *  Steps fall back to internal mocks when these are empty. */
  availableDatasets?: readonly Dataset[];
  availableEnvironments?: readonly SandboxEnvironment[];
  availableAgents?: readonly AgentSummary[];
  className?: string;
}

export function BacktestConfigure({
  initialRecipe = null,
  initialStep = "dataset",
  onRecipeChange,
  onLaunch,
  onModeChange,
  onBackToList,
  availableDatasets,
  availableEnvironments,
  availableAgents,
  className,
}: BacktestConfigureProps) {
  const [step, setStep] = React.useState<BacktestPipelineStep>(initialStep);
  const [recipe, setRecipeState] = React.useState<BacktestRecipe | null>(
    initialRecipe,
  );

  const setRecipe = React.useCallback(
    (next: BacktestRecipe | null) => {
      setRecipeState(next);
      onRecipeChange?.(next);
    },
    [onRecipeChange],
  );

  const updateRecipe = React.useCallback(
    (patch: Partial<BacktestRecipe>) => {
      if (!recipe) return;
      setRecipe({ ...recipe, ...patch });
    },
    [recipe, setRecipe],
  );

  const handleModePick = (job: BacktestJobPreset) => {
    const next = cloneRecipe(job.recipe);
    setRecipe(next);
    setStep("dataset");
    onModeChange?.(next);
  };

  if (!recipe) {
    return (
      <div
        className={cx(
          "flex h-full min-h-0 flex-col bg-l-surface text-l-ink",
          "min-h-[calc(100svh-var(--header-height,3.5rem)-2rem)] gap-4 p-4",
          "items-center justify-center",
          className,
        )}
      >
        <EmptyConfigure onBackToList={onBackToList} onPick={handleModePick} />
      </div>
    );
  }

  return (
    <Pipeline
      recipe={recipe}
      step={step}
      onStepChange={setStep}
      updateRecipe={updateRecipe}
      onModePick={handleModePick}
      onBackToList={onBackToList}
      onLaunch={onLaunch}
      availableDatasets={availableDatasets}
      availableEnvironments={availableEnvironments}
      availableAgents={availableAgents}
      className={className}
    />
  );
}

interface PipelineProps {
  recipe: BacktestRecipe;
  step: BacktestPipelineStep;
  onStepChange: (step: BacktestPipelineStep) => void;
  updateRecipe: (patch: Partial<BacktestRecipe>) => void;
  onModePick: (preset: BacktestJobPreset) => void;
  onBackToList?: () => void;
  onLaunch?: (recipe: BacktestRecipe) => void;
  availableDatasets?: readonly Dataset[];
  availableEnvironments?: readonly SandboxEnvironment[];
  availableAgents?: readonly AgentSummary[];
  className?: string;
}

function Pipeline({
  recipe,
  step,
  onStepChange,
  updateRecipe,
  onModePick,
  onBackToList,
  onLaunch,
  availableDatasets,
  availableEnvironments,
  availableAgents,
  className,
}: PipelineProps) {
  const [quickCheck, setQuickCheck] =
    React.useState<BacktestQuickCheckState | null>(null);
  const [quickProgress, setQuickProgress] = React.useState(0);

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

  const visibleSteps = React.useMemo<readonly BacktestPipelineStep[]>(() => {
    if (recipe.mode === "replay") {
      return BACKTEST_PIPELINE_STEPS.filter((s) => s !== "enrich");
    }
    return BACKTEST_PIPELINE_STEPS;
  }, [recipe.mode]);

  const stepIndex = visibleSteps.indexOf(step);
  const prevStep = stepIndex > 0 ? visibleSteps[stepIndex - 1] : null;
  const nextStep =
    stepIndex >= 0 && stepIndex < visibleSteps.length - 1
      ? visibleSteps[stepIndex + 1]
      : null;

  const canAdvance = isStepReady(step, recipe);

  return (
    <div
      className={cx(
        "flex h-full min-h-0 flex-col bg-l-surface text-l-ink",
        "min-h-[calc(100svh-var(--header-height,3.5rem)-2rem)] gap-4 p-4",
        className,
      )}
    >
      <ConfigureHeader
        recipe={recipe}
        onRename={(name) => updateRecipe({ name })}
        onModePick={onModePick}
        onBackToList={onBackToList}
      />

      <BacktestStepper
        recipe={recipe}
        active={step}
        onStepChange={onStepChange}
      />

      <div className="flex-1 min-h-0 overflow-auto rounded-md border border-l-border-faint bg-l-wash-1">
        {step === "dataset" ? (
          <StepDataset
            recipe={recipe}
            onChange={updateRecipe}
            availableDatasets={availableDatasets}
          />
        ) : null}
        {step === "enrich" ? (
          <StepEnrich
            recipe={recipe}
            onChange={updateRecipe}
          />
        ) : null}
        {step === "environment" ? (
          <StepEnvironment
            recipe={recipe}
            onChange={updateRecipe}
            availableEnvironments={availableEnvironments}
          />
        ) : null}
        {step === "versions" ? (
          <StepVersions
            recipe={recipe}
            onChange={updateRecipe}
            availableAgents={availableAgents}
          />
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<ArrowLeft className="size-3.5" strokeWidth={1.6} />}
          disabled={!prevStep}
          onPress={() => prevStep && onStepChange(prevStep)}
        >
          {prevStep ? `Back · ${stepLabel(prevStep)}` : "Back"}
        </Button>
        {nextStep ? (
          <Button
            variant="secondary"
            size="sm"
            trailingIcon={<ArrowRight className="size-3.5" strokeWidth={1.6} />}
            disabled={!canAdvance}
            onPress={() => onStepChange(nextStep)}
          >
            Next · {stepLabel(nextStep)}
          </Button>
        ) : (
          <span className="font-mono text-[11px] uppercase tracking-tactical text-l-ink-dim">
            ready to launch ↓
          </span>
        )}
      </div>

      <BacktestSummaryStrip
        recipe={recipe}
        onJumpTo={onStepChange}
      />

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

/* ── Hero header (mirrors DatasetsManager `ListHeader`) ──── */

function ConfigureHeader({
  recipe,
  onRename,
  onModePick,
  onBackToList,
}: {
  recipe: BacktestRecipe;
  onRename: (name: string) => void;
  onModePick: (preset: BacktestJobPreset) => void;
  onBackToList?: () => void;
}) {
  const summary = describeRecipe(recipe);
  return (
    <header className="flex flex-col gap-4 border-b border-l-border-faint pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 flex-1">
        <input
          type="text"
          value={recipe.name}
          onChange={(e) => onRename(e.target.value)}
          placeholder="Name this run"
          className={cx(
            "w-full min-w-0 max-w-3xl border-b border-transparent bg-transparent",
            "font-display text-[34px] font-normal leading-none tracking-[-0.04em] text-l-ink-hi",
            "outline-none transition-colors md:text-[44px]",
            "hover:border-l-border-faint focus:border-l-border-strong",
            "placeholder:font-display placeholder:text-l-ink-dim",
          )}
        />
        <p className="mt-2 max-w-2xl text-[12.5px] leading-5 text-l-ink-dim">
          {summary}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <ModeSwitcher mode={recipe.mode} onPick={onModePick} />
        {onBackToList ? (
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<List className="size-3.5" strokeWidth={1.75} />}
            onPress={onBackToList}
          >
            All backtests
          </Button>
        ) : null}
      </div>
    </header>
  );
}

function describeRecipe(recipe: BacktestRecipe): string {
  const cases = recipe.data.sources.reduce((acc, s) => acc + (s.count || 0), 0);
  const enriched = recipe.data.scenarios.filter(
    (s) => s.accepted !== false,
  ).length;
  const versions = recipe.agents.length;
  const env = recipe.environment?.label ?? "no environment yet";
  const dataset =
    recipe.data.kind === "dataset"
      ? (recipe.data.datasetLabel ?? "saved dataset")
      : recipe.data.kind === "production"
        ? `production · ${recipe.data.sources[0]?.filters?.window ?? "recent"}`
        : `${cases.toLocaleString()} traces composed`;
  const enrichClause = enriched > 0 ? ` · enriched with ${enriched}` : "";
  return `Configure a ${recipe.mode} backtest. ${dataset}${enrichClause}, seeded in ${env}, replayed across ${versions} ${versions === 1 ? "version" : "versions"}.`;
}

/* ── Mode switcher (inline preset reseed) ─────────────────── */

function ModeSwitcher({
  mode,
  onPick,
}: {
  mode: BacktestJobMode;
  onPick: (preset: BacktestJobPreset) => void;
}) {
  const active = BACKTEST_JOB_PRESETS.find((p) => p.id === mode);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button
          type="button"
          className={cx(
            "inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-l-border-faint bg-l-wash-1 px-2.5",
            "font-sans text-[12.5px] text-l-ink-lo transition-colors",
            "hover:bg-l-wash-3 hover:text-l-ink",
          )}
        >
          {active ? (
            <span aria-hidden style={{ color: active.hue }} className="inline-flex items-center">
              <JobIcon kind={active.icon} className="size-3.5" />
            </span>
          ) : null}
          <span>Mode</span>
          <span className="font-mono text-[11px] uppercase tracking-tactical text-l-ink-lo">
            · {mode}
          </span>
          <ChevronDown className="size-3 text-l-ink-dim" strokeWidth={1.6} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[260px]">
        {BACKTEST_JOB_PRESETS.map((preset) => (
          <DropdownMenuItem
            key={preset.id}
            onAction={() => onPick(preset)}
            className="flex items-start gap-2.5 py-2"
          >
            <span
              aria-hidden
              className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-[2px] border border-l-border-faint bg-l-wash-1"
              style={{ color: preset.hue }}
            >
              <JobIcon kind={preset.icon} className="size-3" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-sans text-[12.5px] font-medium leading-none text-l-ink-hi">
                {preset.title}
              </span>
              <span className="font-mono text-[11px] leading-snug text-l-ink-dim">
                {preset.sub}
              </span>
            </div>
            {preset.id === mode ? (
              <span className="self-center font-mono text-[10px] uppercase tracking-tactical text-ember">
                current
              </span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Empty state when no recipe is set ─────────────────────── */

function EmptyConfigure({
  onBackToList,
  onPick,
}: {
  onBackToList?: () => void;
  onPick: (preset: BacktestJobPreset) => void;
}) {
  return (
    <div className="flex max-w-md flex-col items-center gap-3 rounded-md border border-dashed border-l-border-faint bg-l-wash-1 px-6 py-12 text-center">
      <span className="font-mono text-[11px] uppercase tracking-tactical text-ember">
        New backtest
      </span>
      <h2 className="font-display text-[20px] leading-none tracking-[-0.02em] text-l-ink-hi">
        Pick a starting mode to begin configuring
      </h2>
      <p className="text-[12.5px] text-l-ink-dim">
        Each mode seeds the pipeline with sensible defaults. You can swap modes
        from the inline switcher once configuring.
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {BACKTEST_JOB_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onPick(preset)}
            className={cx(
              "group inline-flex items-center gap-1.5 rounded-md border border-l-border-faint bg-l-wash-1 px-2.5 py-1.5",
              "font-sans text-[12.5px] text-l-ink-lo transition-colors",
              "hover:bg-l-wash-3 hover:text-l-ink",
            )}
          >
            <span aria-hidden style={{ color: preset.hue }}>
              <JobIcon kind={preset.icon} className="size-3.5" />
            </span>
            {preset.title}
          </button>
        ))}
      </div>
      {onBackToList ? (
        <Button variant="ghost" size="sm" onPress={onBackToList}>
          back to all backtests
        </Button>
      ) : null}
    </div>
  );
}

const STEP_LABEL: Record<BacktestPipelineStep, string> = {
  dataset: "Dataset",
  enrich: "Discover gaps",
  environment: "Environment",
  versions: "Agent versions",
};

function stepLabel(step: BacktestPipelineStep): string {
  return STEP_LABEL[step];
}

function isStepReady(
  step: BacktestPipelineStep,
  recipe: BacktestRecipe,
): boolean {
  switch (step) {
    case "dataset":
      return isDatasetStepDone(recipe);
    case "enrich":
      return isEnrichStepDone(recipe);
    case "environment":
      return isEnvironmentStepDone(recipe);
    case "versions":
      return isVersionsStepDone(recipe);
  }
}
