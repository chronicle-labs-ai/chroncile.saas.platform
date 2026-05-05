/*
 * BacktestRecipeStrip — the "Test [agents] on [data] graded by
 * [graders]" sentence. Each pill is interactive; clicking toggles
 * the inline editor area below.
 *
 * Linear-density: copy reads as a tight 13 px sentence, no display
 * serif. Pills sit inline with hairline chips inside.
 */

"use client";

import * as React from "react";

import { cx } from "../../utils/cx";
import { Mono } from "../../typography/mono";

import { BacktestRecipePill } from "./backtest-recipe-pill";
import { CandidateHueDot } from "../atoms";
import type { BacktestRecipe } from "../types";

export type BacktestRecipePart = "agents" | "data" | "graders";

export interface BacktestRecipeStripProps {
  recipe: BacktestRecipe;
  /** Currently open pill id, or null. */
  open?: BacktestRecipePart | null;
  onTogglePart?: (part: BacktestRecipePart) => void;
  className?: string;
}

export function BacktestRecipeStrip({
  recipe,
  open,
  onTogglePart,
  className,
}: BacktestRecipeStripProps) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-2 rounded-[2px] border border-divider bg-wash-micro px-3 py-2",
        className,
      )}
    >
      <span className="font-sans text-[13px] text-ink-lo">Test</span>

      <BacktestRecipePill
        label="agents"
        open={open === "agents"}
        onToggle={() => onTogglePart?.("agents")}
      >
        <AgentsBody recipe={recipe} />
      </BacktestRecipePill>

      <span className="font-sans text-[13px] text-ink-lo">on</span>

      <BacktestRecipePill
        label="data"
        open={open === "data"}
        onToggle={() => onTogglePart?.("data")}
      >
        <DataBody recipe={recipe} />
      </BacktestRecipePill>

      <span className="font-sans text-[13px] text-ink-lo">graded by</span>

      <BacktestRecipePill
        label="graders"
        open={open === "graders"}
        onToggle={() => onTogglePart?.("graders")}
      >
        <GradersBody recipe={recipe} />
      </BacktestRecipePill>
    </div>
  );
}

function AgentsBody({ recipe }: { recipe: BacktestRecipe }) {
  if (recipe.agents.length === 0) {
    return <span className="text-ink-dim">pick agents</span>;
  }
  const visible = recipe.agents.slice(0, 3);
  const overflow = recipe.agents.length - visible.length;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {visible.map((a) => (
        <span
          key={a.id}
          className="inline-flex items-center gap-1 rounded-[2px] bg-surface-02 px-1.5 py-0.5 font-sans text-[12px] text-ink-hi"
        >
          <CandidateHueDot hue={a.hue} size="xs" />
          {a.label}
        </span>
      ))}
      {overflow > 0 ? (
        <span className="rounded-[2px] border border-dashed border-hairline-strong px-1.5 py-0.5 font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}

function DataBody({ recipe }: { recipe: BacktestRecipe }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[2px] bg-surface-02 px-1.5 py-0.5 font-sans text-[12px] text-ink-hi">
      <DataGlyph kind={recipe.data.kind} />
      {dataSummary(recipe)}
    </span>
  );
}

function GradersBody({ recipe }: { recipe: BacktestRecipe }) {
  const count = recipe.graders.length;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[2px] bg-surface-02 px-1.5 py-0.5 font-sans text-[12px] text-ink-hi">
      <span>
        {count} check{count === 1 ? "" : "s"}
      </span>
      <span className="flex items-center gap-1">
        {recipe.graders.slice(0, 4).map((g) => (
          <span
            key={g.id}
            className="rounded-[2px] border border-divider px-1 py-px font-mono text-mono-sm uppercase tracking-tactical text-ink-dim"
          >
            {g.kind}
          </span>
        ))}
        {recipe.graders.length > 4 ? (
          <Mono size="sm" tone="dim">
            +{recipe.graders.length - 4}
          </Mono>
        ) : null}
      </span>
    </span>
  );
}

function DataGlyph({ kind }: { kind: BacktestRecipe["data"]["kind"] }) {
  if (kind === "dataset") {
    return (
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
        <rect x="2" y="3" width="12" height="3" />
        <rect x="2" y="7" width="12" height="3" />
        <rect x="2" y="11" width="12" height="3" />
      </svg>
    );
  }
  if (kind === "production") {
    return (
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
        <path d="M2 8a6 6 0 1 0 2-4.5" />
        <path d="M2 3v4h4" />
        <path d="M6 6.5l4 2-4 2z" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d="M2 4c0-1.1 2.7-2 6-2s6 .9 6 2v8c0 1.1-2.7 2-6 2s-6-.9-6-2z" />
      <path d="M2 4c0 1.1 2.7 2 6 2s6-.9 6-2M2 8c0 1.1 2.7 2 6 2s6-.9 6-2" />
    </svg>
  );
}

function dataSummary(recipe: BacktestRecipe): string {
  const d = recipe.data;
  if (d.kind === "dataset" && d.datasetLabel) {
    const n = d.sources.reduce((acc, s) => acc + (s.count || 0), 0);
    return `${d.datasetLabel} · ${n.toLocaleString()} cases`;
  }
  if (d.kind === "production") {
    const n = d.sources.reduce((acc, s) => acc + (s.count || 0), 0);
    const window = d.sources[0]?.filters?.window ?? "recent";
    return `prod · ${window} · ${n.toLocaleString()} traces`;
  }
  const traces = d.sources.reduce((acc, s) => acc + (s.count || 0), 0);
  const gen = d.scenarios
    .filter((s) => s.accepted !== false)
    .reduce((acc, s) => acc + (s.count || 0), 0);
  if (traces && gen) return `${traces.toLocaleString()} traces + ${gen} gen`;
  if (traces) return `${traces.toLocaleString()} traces`;
  if (gen) return `${gen} gen cases`;
  return "no cases yet";
}
