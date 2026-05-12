/*
 * StepVersions — pipeline step 04.
 *
 * Picks the agent versions to run en masse against the dataset +
 * environment. Successor of `BacktestAgentsEditor` adapted to the
 * stepper:
 *
 *   - Surfaces real `AgentSummary` rows when the host passes them
 *     via `availableAgents`; the first picked is the baseline.
 *   - Falls back to the synthetic `BACKTEST_CANDIDATES` catalog so
 *     stories keep working.
 *   - Renders a small `agents × cases = N runs` matrix preview at
 *     the bottom so the launch cost is legible without scrolling.
 */

"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";

import { cx } from "../../../utils/cx";
import { Eyebrow } from "../../../primitives/eyebrow";
import { Mono } from "../../../typography/mono";
import { CandidateHueDot } from "../../atoms";
import {
  BACKTEST_CANDIDATES,
  recipeAgentCount,
  recipeCaseCount,
} from "../../data";
import type { BacktestAgent, BacktestRecipe } from "../../types";
import type { AgentSummary } from "../../../agents/types";

export interface StepVersionsProps {
  recipe: BacktestRecipe;
  onChange: (patch: Partial<BacktestRecipe>) => void;
  /** Real agents from the host registry. When passed, replaces the
   *  synthetic `BACKTEST_CANDIDATES` catalog. Each summary becomes
   *  one candidate using its latest version. */
  availableAgents?: readonly AgentSummary[];
  className?: string;
}

const REAL_AGENT_HUES = [
  "var(--c-event-teal)",
  "var(--c-event-violet)",
  "var(--c-ember)",
  "var(--c-event-amber)",
  "var(--c-event-green)",
  "var(--c-event-orange)",
] as const;

export function StepVersions({
  recipe,
  onChange,
  availableAgents,
  className,
}: StepVersionsProps) {
  const catalog = React.useMemo<readonly BacktestAgent[]>(() => {
    if (availableAgents && availableAgents.length > 0) {
      return availableAgents.map<BacktestAgent>((a, idx) => ({
        id: `${a.name}@${a.latestVersion}`,
        label: `${a.name} · ${a.latestVersion}`,
        notes: a.modelLabel
          ? `${a.modelLabel} · ${a.versionCount} version${a.versionCount === 1 ? "" : "s"} · ${a.framework}`
          : `${a.framework} · ${a.versionCount} version${a.versionCount === 1 ? "" : "s"}`,
        hue: REAL_AGENT_HUES[idx % REAL_AGENT_HUES.length]!,
        role: idx === 0 ? "baseline" : "candidate",
      }));
    }
    return BACKTEST_CANDIDATES;
  }, [availableAgents]);

  const ids = React.useMemo(() => new Set(recipe.agents.map((a) => a.id)), [recipe.agents]);

  const setAgents = (agents: readonly BacktestAgent[]) => {
    onChange({ agents });
  };

  const add = (agent: BacktestAgent) => {
    if (ids.has(agent.id)) return;
    setAgents([...recipe.agents, agent]);
  };
  const remove = (idx: number) => {
    setAgents(recipe.agents.filter((_, i) => i !== idx));
  };
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= recipe.agents.length) return;
    const next = recipe.agents.slice();
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    setAgents(next);
  };

  const cases = recipeCaseCount(recipe);
  const agents = recipeAgentCount(recipe);
  const totalRuns = cases * agents;

  return (
    <div className={cx("flex flex-col gap-3 px-4 py-4", className)}>
      <header className="flex flex-col gap-0.5">
        <Eyebrow className="text-l-ink-dim">STEP 04 · AGENT VERSIONS</Eyebrow>
        <h3 className="font-display text-[15px] leading-none tracking-[-0.02em] text-l-ink-hi">
          Run across these versions
        </h3>
        <p className="max-w-2xl text-[12.5px] text-l-ink-lo">
          Every case fans out to every version. The first row is the
          comparison baseline — Results compares all candidates against
          it.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between border-b border-l-border-faint pb-1.5">
            <Eyebrow className="text-l-ink-dim">IN THIS RUN</Eyebrow>
            <Mono size="sm" tone="dim">
              {recipe.agents.length} version{recipe.agents.length === 1 ? "" : "s"}
            </Mono>
          </div>
          {recipe.agents.length === 0 ? (
            <div className="rounded-[2px] border border-dashed border-l-border-faint px-3 py-4 text-center">
              <Mono tone="dim" size="sm">
                pick at least one version below
              </Mono>
            </div>
          ) : null}
          {recipe.agents.map((a, i) => (
            <div
              key={a.id}
              className="group flex items-center gap-2 rounded-[2px] border border-l-border-faint bg-l-wash-1 px-2.5 py-1.5"
            >
              <Mono size="sm" tone="dim" className="w-4 text-center">
                {i + 1}
              </Mono>
              <CandidateHueDot hue={a.hue} size="xs" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-sans text-[12.5px] text-l-ink-hi">{a.label}</span>
                  {i === 0 ? (
                    <Mono size="sm" tone="dim" className="uppercase tracking-tactical text-ember">
                      · baseline
                    </Mono>
                  ) : null}
                </div>
                <div className="truncate font-mono text-mono-sm text-l-ink-dim">{a.notes}</div>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <IconBtn title="move up" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp className="size-3" strokeWidth={1.6} />
                </IconBtn>
                <IconBtn
                  title="move down"
                  onClick={() => move(i, +1)}
                  disabled={i === recipe.agents.length - 1}
                >
                  <ArrowDown className="size-3" strokeWidth={1.6} />
                </IconBtn>
                <IconBtn title="remove" onClick={() => remove(i)}>
                  <X className="size-3" strokeWidth={1.6} />
                </IconBtn>
              </div>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between border-b border-l-border-faint pb-1.5">
            <Eyebrow className="text-l-ink-dim">AVAILABLE VERSIONS</Eyebrow>
            <Mono size="sm" tone="dim">
              {catalog.length} registered
            </Mono>
          </div>
          {catalog
            .filter((c) => !ids.has(c.id))
            .map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => add(c)}
                className={cx(
                  "group flex w-full items-center gap-2 rounded-[2px] border border-l-border-faint bg-l-wash-1 px-2.5 py-1.5 text-left",
                  "transition-colors hover:border-l-border-strong hover:bg-l-wash-3",
                )}
              >
                <Plus className="size-3 text-l-ink-dim group-hover:text-ember" strokeWidth={1.8} />
                <CandidateHueDot hue={c.hue} size="xs" />
                <div className="min-w-0 flex-1">
                  <div className="font-sans text-[12.5px] text-l-ink-hi">{c.label}</div>
                  <div className="truncate font-mono text-mono-sm text-l-ink-dim">{c.notes}</div>
                </div>
              </button>
            ))}
          {catalog.every((c) => ids.has(c.id)) && catalog.length > 0 ? (
            <Mono size="sm" tone="dim" className="px-2 py-3 text-center">
              every registered version is in this run
            </Mono>
          ) : null}
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[2px] border border-l-border-faint bg-l-wash-1 px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <Stat label="versions" value={agents.toString()} />
          <Stat label="cases" value={cases.toLocaleString()} />
          <Stat
            label="total runs"
            value={totalRuns.toLocaleString()}
            highlight
          />
        </div>
        <Mono size="sm" tone="dim">
          {agents > 0 && cases > 0
            ? `${agents} × ${cases.toLocaleString()} = ${totalRuns.toLocaleString()}`
            : "complete earlier steps to preview the matrix"}
        </Mono>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <Eyebrow className="text-l-ink-dim">{label}</Eyebrow>
      <span
        className={cx(
          "font-sans text-[14px] font-medium leading-none tabular-nums",
          highlight ? "text-ember" : "text-l-ink-hi",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function IconBtn({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "grid size-5 place-items-center rounded-[2px] text-l-ink-lo transition-colors",
        "hover:bg-l-wash-5 hover:text-l-ink-hi",
        "disabled:cursor-not-allowed disabled:opacity-30",
      )}
    >
      {children}
    </button>
  );
}
