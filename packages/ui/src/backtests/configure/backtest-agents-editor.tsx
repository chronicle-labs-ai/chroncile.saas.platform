/*
 * BacktestAgentsEditor — pick 1..N agents to test. Two columns:
 *   left  — currently picked (reorderable, removable)
 *   right — available builds (catalog) you can add
 *
 * Linear-density: tight 2-line rows, hairline borders, mono-sm
 * action buttons revealed on hover.
 */

"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";

import { cx } from "../../utils/cx";
import { Eyebrow } from "../../primitives/eyebrow";
import { Mono } from "../../typography/mono";

import { BACKTEST_CANDIDATES, findCandidate } from "../data";
import { CandidateHueDot } from "../atoms";
import { BacktestEditorShell } from "./backtest-editor-shell";
import type { BacktestAgent } from "../types";

export interface BacktestAgentsEditorProps {
  agents: readonly BacktestAgent[];
  onChange?: (agents: readonly BacktestAgent[]) => void;
  onClose?: () => void;
  /** Override the catalog. Defaults to `BACKTEST_CANDIDATES`. */
  catalog?: readonly BacktestAgent[];
}

export function BacktestAgentsEditor({
  agents,
  onChange,
  onClose,
  catalog = BACKTEST_CANDIDATES,
}: BacktestAgentsEditorProps) {
  const ids = React.useMemo(() => new Set(agents.map((a) => a.id)), [agents]);

  const add = (agent: BacktestAgent) => {
    if (ids.has(agent.id)) return;
    onChange?.([...agents, agent]);
  };
  const remove = (idx: number) => {
    onChange?.(agents.filter((_, i) => i !== idx));
  };
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= agents.length) return;
    const next = agents.slice();
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    onChange?.(next);
  };

  return (
    <BacktestEditorShell
      title="Agents under test"
      sub="one or more agents. with 2+ picked, results include a comparison view."
      onClose={onClose}
    >
      <div className="grid gap-3 md:grid-cols-2">
        {/* Picked */}
        <section className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between border-b border-divider pb-1.5">
            <Eyebrow className="text-ink-dim">IN THIS RUN</Eyebrow>
            <Mono size="sm" tone="dim">
              {agents.length} agent{agents.length === 1 ? "" : "s"}
            </Mono>
          </div>
          {agents.length === 0 ? (
            <div className="rounded-[2px] border border-dashed border-divider px-3 py-4 text-center">
              <Mono tone="dim" size="sm">
                no agents picked yet
              </Mono>
            </div>
          ) : null}
          {agents.map((a, i) => (
            <div
              key={a.id}
              className="group flex items-center gap-2 rounded-[2px] border border-divider bg-[rgba(255,255,255,0.012)] px-2.5 py-1.5"
            >
              <Mono size="sm" tone="dim" className="w-4 text-center">
                {i + 1}
              </Mono>
              <CandidateHueDot hue={a.hue} size="xs" />
              <div className="min-w-0 flex-1">
                <div className="font-sans text-[12.5px] text-ink-hi">{a.label}</div>
                <div className="truncate font-mono text-mono-sm text-ink-dim">{a.notes}</div>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <IconBtn title="move up" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp className="size-3" strokeWidth={1.6} />
                </IconBtn>
                <IconBtn
                  title="move down"
                  onClick={() => move(i, +1)}
                  disabled={i === agents.length - 1}
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

        {/* Catalog */}
        <section className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between border-b border-divider pb-1.5">
            <Eyebrow className="text-ink-dim">AVAILABLE BUILDS</Eyebrow>
          </div>
          {catalog
            .filter((c) => !ids.has(c.id))
            .map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => add(findCandidate(c.id) ?? c)}
                className={cx(
                  "group flex w-full items-center gap-2 rounded-[2px] border border-divider bg-[rgba(255,255,255,0.012)] px-2.5 py-1.5 text-left",
                  "transition-colors hover:border-hairline-strong hover:bg-[rgba(255,255,255,0.025)]",
                )}
              >
                <Plus className="size-3 text-ink-dim group-hover:text-ember" strokeWidth={1.8} />
                <CandidateHueDot hue={c.hue} size="xs" />
                <div className="min-w-0 flex-1">
                  <div className="font-sans text-[12.5px] text-ink-hi">{c.label}</div>
                  <div className="truncate font-mono text-mono-sm text-ink-dim">{c.notes}</div>
                </div>
              </button>
            ))}
          <button
            type="button"
            className="rounded-[2px] border border-dashed border-divider px-2.5 py-1.5 text-left font-sans text-[12.5px] text-ink-lo transition-colors hover:border-ember hover:text-ember"
          >
            + register a new build
          </button>
        </section>
      </div>

      {agents.length >= 2 ? (
        <div className="flex items-center gap-2 rounded-[2px] border border-ember/25 bg-ember/[0.05] px-2.5 py-1.5">
          <span aria-hidden className="size-1.5 rounded-full bg-ember" />
          <Mono tone="lo" size="sm">
            with 2+ agents, results include a side-by-side comparison and a per-trace divergence
            view.
          </Mono>
        </div>
      ) : null}
    </BacktestEditorShell>
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
        "grid size-5 place-items-center rounded-[2px] text-ink-lo transition-colors",
        "hover:bg-surface-03 hover:text-ink-hi",
        "disabled:cursor-not-allowed disabled:opacity-30",
      )}
    >
      {children}
    </button>
  );
}
