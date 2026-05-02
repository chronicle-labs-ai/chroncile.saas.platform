/*
 * BacktestGraderBuilder — accept / reject / weight the graders that
 * decide pass-or-regression. Three tabs:
 *   Proposed — graders Chronicle inferred from the picked data;
 *              each comes with evidence + a 3-row live preview.
 *   Library  — the catalog of generic graders.
 *   Custom   — author a rubric / JS function / LLM judge.
 *
 * Right-side tray lists currently active graders with weight buckets
 * (low / med / high) and reorder controls.
 */

"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Code2, Eye, Library, X } from "lucide-react";

import { cx } from "../../utils/cx";
import { Button } from "../../primitives/button";
import { Eyebrow } from "../../primitives/eyebrow";
import { Mono } from "../../typography/mono";
import { Textarea } from "../../primitives/textarea";

import {
  BACKTEST_LIBRARY_GRADERS,
  buildProposedGraders,
} from "../data";
import { BacktestEditorShell } from "./backtest-editor-shell";
import type {
  BacktestData,
  BacktestGrader,
  BacktestGraderKind,
  BacktestGraderWeight,
  BacktestProposedGrader,
} from "../types";

type GraderTab = "proposed" | "library" | "custom";

export interface BacktestGraderBuilderProps {
  graders: readonly BacktestGrader[];
  /** Used to drive the proposed-grader inference. */
  data: BacktestData;
  onChange?: (graders: readonly BacktestGrader[]) => void;
  onClose?: () => void;
}

export function BacktestGraderBuilder({
  graders,
  data,
  onChange,
  onClose,
}: BacktestGraderBuilderProps) {
  const [tab, setTab] = React.useState<GraderTab>("proposed");
  const proposed = React.useMemo(() => buildProposedGraders(data), [data]);
  const activeIds = React.useMemo(() => new Set(graders.map((g) => g.id)), [graders]);

  const togglePropose = (p: BacktestProposedGrader) => {
    if (activeIds.has(p.id)) {
      onChange?.(graders.filter((g) => g.id !== p.id));
    } else {
      onChange?.([
        ...graders,
        {
          id: p.id,
          kind: p.kind,
          label: p.label,
          weight: p.weight,
          evidence: p.evidence,
          source: "proposed",
        },
      ]);
    }
  };

  const toggleLibrary = (g: Omit<BacktestGrader, "weight" | "source">) => {
    if (activeIds.has(g.id)) {
      onChange?.(graders.filter((x) => x.id !== g.id));
    } else {
      onChange?.([...graders, { ...g, weight: "med", source: "library" }]);
    }
  };

  const setWeight = (id: string, weight: BacktestGraderWeight) => {
    onChange?.(graders.map((g) => (g.id === id ? { ...g, weight } : g)));
  };

  const remove = (id: string) => {
    onChange?.(graders.filter((g) => g.id !== id));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= graders.length) return;
    const next = graders.slice();
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    onChange?.(next);
  };

  return (
    <BacktestEditorShell
      title="How to grade the results"
      sub="graders decide what counts as a pass or a regression. chronicle proposes them based on your data — accept what looks right."
      onClose={onClose}
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-[480px] flex-col gap-4 rounded-l border border-hairline bg-surface-01 p-3">
          <div className="flex items-center gap-1 border-b border-hairline pb-3">
            <BuilderTab active={tab === "proposed"} onClick={() => setTab("proposed")}>
              <Eye className="size-3.5" strokeWidth={1.4} /> Proposed from data
              <span className="ml-1 rounded-full bg-ember/15 px-1.5 py-0.5 font-mono text-mono-sm text-ember">
                {proposed.length}
              </span>
            </BuilderTab>
            <BuilderTab active={tab === "library"} onClick={() => setTab("library")}>
              <Library className="size-3.5" strokeWidth={1.4} /> Library
            </BuilderTab>
            <BuilderTab active={tab === "custom"} onClick={() => setTab("custom")}>
              <Code2 className="size-3.5" strokeWidth={1.4} /> Custom
            </BuilderTab>
          </div>

          {tab === "proposed" ? (
            <ProposedGraders
              proposed={proposed}
              activeIds={activeIds}
              onToggle={togglePropose}
            />
          ) : null}
          {tab === "library" ? (
            <LibraryGraders activeIds={activeIds} onToggle={toggleLibrary} />
          ) : null}
          {tab === "custom" ? <CustomGrader /> : null}
        </div>

        <aside className="flex flex-col gap-3 rounded-l border border-hairline bg-surface-01 p-3">
          <div className="flex items-start justify-between border-b border-hairline pb-2">
            <div>
              <Eyebrow className="text-ember">ACTIVE CHECKS</Eyebrow>
              <h4 className="font-display text-title-sm font-light text-ink-hi">
                {graders.length} grader{graders.length === 1 ? "" : "s"}
              </h4>
            </div>
          </div>
          {graders.length === 0 ? (
            <div className="rounded-l border border-dashed border-hairline-strong bg-surface-02 px-3 py-5 text-center">
              <Mono tone="dim">no graders selected. accept some from the proposed list.</Mono>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {graders.map((g, i) => (
                <div
                  key={g.id}
                  className="flex flex-col gap-2 rounded-l border border-hairline bg-surface-02 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <GraderKindChip kind={g.kind} />
                      <span className="text-body-sm text-ink-hi">{g.label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <IconBtn title="higher priority" onClick={() => move(i, -1)} disabled={i === 0}>
                        <ArrowUp className="size-3" strokeWidth={1.6} />
                      </IconBtn>
                      <IconBtn
                        title="lower priority"
                        onClick={() => move(i, +1)}
                        disabled={i === graders.length - 1}
                      >
                        <ArrowDown className="size-3" strokeWidth={1.6} />
                      </IconBtn>
                      <IconBtn title="remove" onClick={() => remove(g.id)}>
                        <X className="size-3" strokeWidth={1.6} />
                      </IconBtn>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eyebrow className="text-ink-dim">WEIGHT</Eyebrow>
                    <Segmented
                      options={["low", "med", "high"]}
                      value={g.weight}
                      onChange={(v) => setWeight(g.id, v as BacktestGraderWeight)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          {graders.length >= 2 ? (
            <Mono size="sm" tone="dim">
              grader priority: top-of-list counts most when Chronicle summarizes results
            </Mono>
          ) : null}
        </aside>
      </div>
    </BacktestEditorShell>
  );
}

/* ── Proposed graders ──────────────────────────────────────── */

function ProposedGraders({
  proposed,
  activeIds,
  onToggle,
}: {
  proposed: readonly BacktestProposedGrader[];
  activeIds: Set<string>;
  onToggle: (p: BacktestProposedGrader) => void;
}) {
  if (proposed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-l border border-dashed border-hairline-strong bg-surface-02 px-6 py-12 text-center">
        <h4 className="font-display text-title-sm font-light text-ink-hi">
          Add some data first
        </h4>
        <p className="max-w-md text-body-sm text-ink-lo">
          Graders are proposed based on the data in your dataset — pick some traces, and
          they&rsquo;ll show up here.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {proposed.map((p) => {
        const on = activeIds.has(p.id);
        return (
          <div
            key={p.id}
            data-on={on || undefined}
            className={cx(
              "flex flex-col gap-3 rounded-l border bg-surface-02 p-3",
              on ? "border-ember/60" : "border-hairline",
            )}
          >
            <div className="flex items-start gap-3">
              <GraderKindChip kind={p.kind} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-body-sm text-ink-hi">{p.label}</span>
                  <Mono size="sm" tone="dim">
                    conf {Math.round(p.confidence * 100)}%
                  </Mono>
                </div>
                <p className="mt-1 text-body-sm text-ink-lo">{p.evidence}</p>
              </div>
              <Button
                density="compact"
                variant={on ? "ghost" : "ember"}
                onClick={() => onToggle(p)}
              >
                {on ? "✓ accepted" : "+ accept"}
              </Button>
            </div>
            <div className="rounded-l border border-hairline bg-surface-01 p-2">
              <div className="flex items-center justify-between border-b border-hairline pb-1.5">
                <Eyebrow className="text-ink-dim">LIVE PREVIEW · 3 cases</Eyebrow>
                <Mono size="sm" tone="dim">
                  how this grader would score your baseline
                </Mono>
              </div>
              <div className="mt-2 flex flex-col gap-1">
                {p.preview.map((row, i) => (
                  <div
                    key={i}
                    className={cx(
                      "grid grid-cols-[80px_minmax(0,1fr)_60px] items-center gap-3 rounded-l-sm px-2 py-1",
                      row.pass
                        ? "border border-event-green/20 bg-event-green/[0.06]"
                        : "border border-event-red/20 bg-event-red/[0.06]",
                    )}
                  >
                    <Mono size="sm" tone="dim">
                      {row.case}
                    </Mono>
                    <span className="truncate text-body-sm text-ink">
                      <b className="text-ink-hi">{row.baseline}</b>
                      {row.expected ? (
                        <>
                          <span className="text-ink-dim"> vs </span>
                          <b className="text-ink-lo">{row.expected}</b>
                        </>
                      ) : null}
                      {row.judgment ? (
                        <span className="text-ink-dim"> · {row.judgment}</span>
                      ) : null}
                      {row.threshold ? (
                        <span className="text-ink-dim"> · {row.threshold}</span>
                      ) : null}
                    </span>
                    <Mono
                      size="sm"
                      tone={row.pass ? "lo" : "lo"}
                      uppercase
                      tactical
                      className={cx(
                        "text-right",
                        row.pass ? "text-event-green" : "text-event-red",
                      )}
                    >
                      {row.pass ? "PASS" : "FAIL"}
                    </Mono>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Library tab ───────────────────────────────────────────── */

function LibraryGraders({
  activeIds,
  onToggle,
}: {
  activeIds: Set<string>;
  onToggle: (g: Omit<BacktestGrader, "weight" | "source">) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {BACKTEST_LIBRARY_GRADERS.map((g) => {
        const on = activeIds.has(g.id);
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onToggle(g)}
            data-on={on || undefined}
            className={cx(
              "flex items-start gap-3 rounded-l border bg-surface-02 p-3 text-left transition-colors",
              on ? "border-ember/60" : "border-hairline hover:border-hairline-strong",
            )}
          >
            <span
              aria-hidden
              className={cx(
                "mt-0.5 grid size-4 place-items-center rounded-l-sm border",
                on ? "border-ember bg-ember text-ink-inv-hi" : "border-hairline-strong",
              )}
            >
              {on ? (
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <path d="M3 8l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <GraderKindChip kind={g.kind} />
                <span className="text-body-sm text-ink-hi">{g.label}</span>
              </div>
              <div className="mt-1 text-body-sm text-ink-lo">{g.evidence}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ── Custom tab ────────────────────────────────────────────── */

function CustomGrader() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Eyebrow className="text-ink-dim">AUTHOR A CUSTOM GRADER</Eyebrow>
        <Mono size="sm" tone="dim">
          write a rubric, assertion, or JS function
        </Mono>
      </div>
      <div className="flex items-center gap-1">
        <BuilderTab active>Rubric</BuilderTab>
        <BuilderTab>JS function</BuilderTab>
        <BuilderTab>LLM judge</BuilderTab>
      </div>
      <Textarea
        density="compact"
        rows={6}
        placeholder='e.g. "The agent should refund up to $200 without escalating. If the refund amount exceeds $200, it must escalate to a human. No double refunds."'
      />
      <div className="flex items-center justify-between border-t border-hairline pt-3">
        <Mono size="sm" tone="dim">
          chronicle will test your rubric against 5 sample traces before saving
        </Mono>
        <Button variant="ember" density="compact">
          test + save grader
        </Button>
      </div>
    </div>
  );
}

/* ── Shared atoms ──────────────────────────────────────────── */

function BuilderTab({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active || undefined}
      className={cx(
        "inline-flex items-center gap-2 rounded-l-sm border px-3 py-1.5 text-body-sm transition-colors",
        active
          ? "border-hairline-strong bg-surface-02 text-ink-hi"
          : "border-transparent text-ink-lo hover:bg-surface-02 hover:text-ink-hi",
      )}
    >
      {children}
    </button>
  );
}

function GRADER_KIND_TONE(kind: BacktestGraderKind): string {
  switch (kind) {
    case "rubric":
      return "bg-event-teal/15 text-event-teal";
    case "classifier":
      return "bg-event-violet/15 text-event-violet";
    case "metric":
      return "bg-event-amber/15 text-event-amber";
    case "embedding":
      return "bg-event-pink/15 text-event-pink";
    case "assertion":
      return "bg-event-orange/15 text-event-orange";
  }
}

function GraderKindChip({ kind }: { kind: BacktestGraderKind }) {
  return (
    <span
      className={cx(
        "rounded-l-sm px-1.5 py-0.5 font-mono text-mono-sm uppercase tracking-tactical",
        GRADER_KIND_TONE(kind),
      )}
    >
      {kind}
    </span>
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
        "grid size-6 place-items-center rounded-l-sm border border-hairline text-ink-lo transition-colors",
        "hover:border-hairline-strong hover:bg-surface-03 hover:text-ink-hi",
        "disabled:cursor-not-allowed disabled:opacity-30",
      )}
    >
      {children}
    </button>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded-l border border-hairline bg-surface-01 p-0.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          data-on={value === o || undefined}
          className={cx(
            "rounded-l-sm px-2 py-0.5 font-mono text-mono-sm uppercase tracking-tactical transition-colors",
            value === o ? "bg-surface-03 text-ink-hi" : "text-ink-lo hover:text-ink-hi",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
