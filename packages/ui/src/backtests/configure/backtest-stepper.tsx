/*
 * BacktestStepper — directional 4-node pipeline rail rendered above
 * the active configure step. Mirrors the Linear-density chrome used
 * by `AgentsFacetRail` and `DatasetMetricsStrip`:
 *
 *   01 Dataset → 02 Enrich → 03 Environment → 04 Versions
 *
 * Each node carries a step number, label, and a one-line completion
 * summary derived from the recipe (e.g. "refund-escalations-v2 ·
 * 412 cases", "3 buckets enriched", "Acme Support Sandbox").
 *
 * Steps can be:
 *   - active     → ember accent, highlighted background
 *   - done       → ink-hi text, ember dot
 *   - todo       → ink-dim text, ring outline
 *   - skipped    → ink-faint, dashed connector ("not needed for replay")
 *
 * The component is presentational; the parent owns navigation.
 */

"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { cx } from "../../utils/cx";
import { Eyebrow } from "../../primitives/eyebrow";
import {
  isDatasetStepDone,
  isEnrichStepDone,
  isEnvironmentStepDone,
  isVersionsStepDone,
  recipeAgentCount,
  recipeCaseCount,
  recipeEnrichmentCount,
} from "../data";
import type { BacktestPipelineStep, BacktestRecipe } from "../types";
import { BACKTEST_PIPELINE_STEPS } from "../types";

export type BacktestStepStatus = "todo" | "active" | "done" | "skipped";

export interface BacktestStepperProps {
  recipe: BacktestRecipe;
  /** Currently active pipeline step. */
  active: BacktestPipelineStep;
  onStepChange?: (step: BacktestPipelineStep) => void;
  className?: string;
}

interface StepNode {
  id: BacktestPipelineStep;
  number: string;
  title: string;
  summary: string;
  status: BacktestStepStatus;
}

export function BacktestStepper({
  recipe,
  active,
  onStepChange,
  className,
}: BacktestStepperProps) {
  const nodes = React.useMemo<readonly StepNode[]>(() => {
    return BACKTEST_PIPELINE_STEPS.map((id, idx) => {
      const number = `0${idx + 1}`;
      const isActive = id === active;
      const skipped = isStepSkipped(id, recipe);
      const done = !skipped && isStepDone(id, recipe);
      const status: BacktestStepStatus = skipped
        ? "skipped"
        : isActive
          ? "active"
          : done
            ? "done"
            : "todo";
      return {
        id,
        number,
        title: STEP_TITLE[id],
        summary: stepSummary(id, recipe),
        status,
      };
    });
  }, [active, recipe]);

  return (
    <div
      className={cx(
        "flex w-full items-stretch gap-0 rounded-md border border-l-border-faint bg-l-wash-1",
        className,
      )}
      role="tablist"
      aria-label="Backtest configure pipeline"
    >
      {nodes.map((node, idx) => (
        <React.Fragment key={node.id}>
          <StepperNode
            node={node}
            onClick={() => onStepChange?.(node.id)}
          />
          {idx < nodes.length - 1 ? (
            <Connector
              from={node.status}
              to={nodes[idx + 1]!.status}
            />
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );
}

const STEP_TITLE: Record<BacktestPipelineStep, string> = {
  dataset: "Dataset",
  enrich: "Discover gaps",
  environment: "Environment",
  versions: "Agent versions",
};

function StepperNode({
  node,
  onClick,
}: {
  node: StepNode;
  onClick: () => void;
}) {
  const interactive = node.status !== "skipped";
  return (
    <button
      type="button"
      role="tab"
      aria-selected={node.status === "active"}
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      className={cx(
        "group relative flex flex-1 min-w-0 flex-col items-start gap-1 px-3 py-2.5 text-left",
        "transition-colors duration-fast",
        node.status === "active" && "bg-l-wash-3",
        node.status === "todo" && "hover:bg-l-wash-3",
        node.status === "done" && "hover:bg-l-wash-3",
        node.status === "skipped" && "cursor-not-allowed opacity-60",
      )}
    >
      <div className="flex items-center gap-2">
        <StepGlyph status={node.status} number={node.number} />
        <Eyebrow
          className={cx(
            node.status === "active" && "text-ember",
            node.status === "done" && "text-l-ink-lo",
            node.status === "todo" && "text-l-ink-dim",
            node.status === "skipped" && "text-l-ink-dim",
          )}
        >
          STEP {node.number}
        </Eyebrow>
      </div>
      <div className="flex w-full min-w-0 flex-col gap-0.5">
        <span
          className={cx(
            "truncate font-sans text-[13px] font-medium leading-none",
            node.status === "active" && "text-l-ink-hi",
            node.status === "done" && "text-l-ink-hi",
            node.status === "todo" && "text-l-ink-lo",
            node.status === "skipped" && "text-l-ink-dim line-through",
          )}
        >
          {node.title}
        </span>
        <span
          className={cx(
            "truncate font-mono text-[11px] tabular-nums text-l-ink-dim",
            node.status === "skipped" && "text-l-ink-dim",
          )}
        >
          {node.summary}
        </span>
      </div>
    </button>
  );
}

function StepGlyph({
  status,
  number,
}: {
  status: BacktestStepStatus;
  number: string;
}) {
  if (status === "done") {
    return (
      <span
        aria-hidden
        className="grid size-4 shrink-0 place-items-center rounded-full bg-ember text-[var(--c-surface-00)]"
      >
        <Check className="size-2.5" strokeWidth={2.4} />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span
        aria-hidden
        className="grid size-4 shrink-0 place-items-center rounded-full border border-ember bg-ember/15 font-mono text-[9px] font-medium uppercase text-ember"
      >
        {number}
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span
        aria-hidden
        className="grid size-4 shrink-0 place-items-center rounded-full border border-dashed border-l-border-strong font-mono text-[9px] uppercase text-l-ink-dim"
      >
        —
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="grid size-4 shrink-0 place-items-center rounded-full border border-l-border-faint font-mono text-[9px] uppercase text-l-ink-dim"
    >
      {number}
    </span>
  );
}

function Connector({
  from,
  to,
}: {
  from: BacktestStepStatus;
  to: BacktestStepStatus;
}) {
  const dashed = from === "skipped" || to === "skipped";
  const lit =
    !dashed && (from === "done" || from === "active");
  return (
    <span
      aria-hidden
      className="relative flex shrink-0 items-center self-stretch px-0.5"
    >
      <span
        className={cx(
          "block h-px w-3",
          dashed
            ? "border-t border-dashed border-l-border-strong"
            : lit
              ? "bg-ember/45"
              : "bg-l-wash-3",
        )}
      />
    </span>
  );
}

/* ── Step status helpers ───────────────────────────────────── */

function isStepDone(
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

function isStepSkipped(
  step: BacktestPipelineStep,
  recipe: BacktestRecipe,
): boolean {
  return step === "enrich" && recipe.mode === "replay";
}

/* ── Step summary copy ─────────────────────────────────────── */

function stepSummary(
  step: BacktestPipelineStep,
  recipe: BacktestRecipe,
): string {
  switch (step) {
    case "dataset":
      return datasetSummary(recipe);
    case "enrich":
      if (recipe.mode === "replay") return "skipped for replay";
      return enrichSummary(recipe);
    case "environment":
      return environmentSummary(recipe);
    case "versions":
      return versionsSummary(recipe);
  }
}

function datasetSummary(recipe: BacktestRecipe): string {
  const d = recipe.data;
  if (d.kind === "dataset" && d.datasetLabel) {
    const cases = recipeCaseCount(recipe);
    return `${d.datasetLabel} · ${cases.toLocaleString()} cases`;
  }
  if (d.kind === "production") {
    const window = d.sources[0]?.filters?.window ?? "recent";
    const cases = d.sources.reduce((acc, s) => acc + (s.count || 0), 0);
    return `prod · ${window} · ${cases.toLocaleString()} traces`;
  }
  const traces = d.sources.reduce((acc, s) => acc + (s.count || 0), 0);
  if (traces === 0) return "pick a dataset";
  return `${traces.toLocaleString()} traces composed`;
}

function enrichSummary(recipe: BacktestRecipe): string {
  const accepted = recipeEnrichmentCount(recipe);
  const total = recipe.data.scenarios.length;
  if (total === 0) return "review proposed scenarios";
  const buckets = new Set(
    recipe.data.scenarios
      .filter((s) => s.accepted !== false)
      .map((s) => s.bucket)
      .filter(Boolean),
  ).size;
  if (accepted === 0) return "0 accepted of " + total;
  return `${accepted} scenarios · ${buckets} bucket${buckets === 1 ? "" : "s"}`;
}

function environmentSummary(recipe: BacktestRecipe): string {
  const env = recipe.environment;
  if (!env) return "pick an environment";
  return env.label;
}

function versionsSummary(recipe: BacktestRecipe): string {
  const a = recipeAgentCount(recipe);
  if (a === 0) return "pick agent versions";
  const cases = recipeCaseCount(recipe);
  return `${a} version${a === 1 ? "" : "s"} · ${(a * cases).toLocaleString()} runs`;
}
