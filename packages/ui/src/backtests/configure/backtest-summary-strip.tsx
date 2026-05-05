/*
 * BacktestSummaryStrip — read-only review of the recipe rendered
 * above the launch dock. Replaces the interactive sentence-strip
 * pattern: each chip is now a shortcut back to its pipeline step,
 * not an inline editor toggle.
 *
 * Reads as a single tight sentence:
 *
 *   Replay [data] in [environment] across [versions]
 *
 * For the standard pipeline we keep the original "Test [versions] on
 * [data] graded by [graders]" framing but route the chips to the
 * stepper.
 */

"use client";

import * as React from "react";

import { cx } from "../../utils/cx";
import { CandidateHueDot } from "../atoms";
import { recipeCaseCount } from "../data";
import type { BacktestPipelineStep, BacktestRecipe } from "../types";

export interface BacktestSummaryStripProps {
  recipe: BacktestRecipe;
  /** Click on a chip to jump back to that step. */
  onJumpTo?: (step: BacktestPipelineStep) => void;
  className?: string;
}

export function BacktestSummaryStrip({
  recipe,
  onJumpTo,
  className,
}: BacktestSummaryStripProps) {
  const isReplay = recipe.mode === "replay";
  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-2 rounded-md border border-l-border-faint bg-l-wash-1 px-3 py-2",
        className,
      )}
      aria-label="Recipe summary"
    >
      <Verb>{isReplay ? "Replay" : "Test"}</Verb>

      {isReplay ? null : (
        <>
          <Chip onClick={() => onJumpTo?.("versions")}>
            <VersionsBody recipe={recipe} />
          </Chip>
          <Connective>on</Connective>
        </>
      )}

      <Chip onClick={() => onJumpTo?.("dataset")}>
        <DataBody recipe={recipe} />
      </Chip>

      {isReplay ? null : (
        <>
          <Connective>graded by</Connective>
          <Chip onClick={() => onJumpTo?.("dataset")} muted>
            <GradersBody recipe={recipe} />
          </Chip>
        </>
      )}

      <Connective>in</Connective>
      <Chip onClick={() => onJumpTo?.("environment")}>
        <EnvironmentBody recipe={recipe} />
      </Chip>

      {isReplay ? (
        <>
          <Connective>across</Connective>
          <Chip onClick={() => onJumpTo?.("versions")}>
            <VersionsBody recipe={recipe} />
          </Chip>
        </>
      ) : null}
    </div>
  );
}

function Verb({ children }: { children: React.ReactNode }) {
  return <span className="font-sans text-[13px] text-l-ink-lo">{children}</span>;
}

function Connective({ children }: { children: React.ReactNode }) {
  return <span className="font-sans text-[13px] text-l-ink-dim">{children}</span>;
}

function Chip({
  children,
  onClick,
  muted,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "group inline-flex items-center gap-1.5 rounded-md border border-l-border-faint px-1.5 py-0.5",
        "font-sans text-[12px] transition-colors",
        muted ? "bg-transparent text-l-ink-lo" : "bg-l-wash-3 text-l-ink-hi",
        "hover:border-l-border-strong",
      )}
    >
      {children}
    </button>
  );
}

function VersionsBody({ recipe }: { recipe: BacktestRecipe }) {
  if (recipe.agents.length === 0) {
    return <span className="text-l-ink-dim">pick versions</span>;
  }
  const visible = recipe.agents.slice(0, 3);
  const overflow = recipe.agents.length - visible.length;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {visible.map((a) => (
        <span key={a.id} className="inline-flex items-center gap-1">
          <CandidateHueDot hue={a.hue} size="xs" />
          {a.label}
        </span>
      ))}
      {overflow > 0 ? (
        <span className="rounded-[2px] border border-dashed border-l-border-strong px-1 py-px font-mono text-[10px] uppercase tracking-tactical text-l-ink-dim">
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}

function DataBody({ recipe }: { recipe: BacktestRecipe }) {
  return <span>{dataSummary(recipe)}</span>;
}

function GradersBody({ recipe }: { recipe: BacktestRecipe }) {
  const count = recipe.graders.length;
  if (count === 0) return <span className="text-l-ink-dim">no graders</span>;
  return (
    <span>
      {count} check{count === 1 ? "" : "s"}
    </span>
  );
}

function EnvironmentBody({ recipe }: { recipe: BacktestRecipe }) {
  if (!recipe.environment) {
    return <span className="text-l-ink-dim">pick environment</span>;
  }
  return <span>{recipe.environment.label}</span>;
}

function dataSummary(recipe: BacktestRecipe): string {
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
  const gen = d.scenarios
    .filter((s) => s.accepted !== false)
    .reduce((acc, s) => acc + (s.count || 0), 0);
  if (traces && gen) return `${traces.toLocaleString()} traces + ${gen} gen`;
  if (traces) return `${traces.toLocaleString()} traces`;
  if (gen) return `${gen} gen`;
  return "no cases";
}
