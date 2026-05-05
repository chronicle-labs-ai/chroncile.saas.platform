/*
 * StepDataset — pipeline step 01.
 *
 * Picks the seed of the run. Polymorphic on `recipe.mode`:
 *
 *   - replay     → production-window picker (rolling time window
 *                  + cluster filters; produces a `production`-kind
 *                  data tray).
 *   - compare    → saved dataset OR a quick production source.
 *   - regression → saved dataset OR a quick production source.
 *   - suite      → saved dataset (locked).
 *
 * Bridges to `Dataset` from `stream-timeline/types` so the host app
 * can pass real datasets via `availableDatasets`. Falls back to the
 * internal mock catalog (`BACKTEST_DATASETS`) when none is provided.
 */

"use client";

import * as React from "react";
import { Check, Database, Search } from "lucide-react";

import { cx } from "../../../utils/cx";
import { Button } from "../../../primitives/button";
import { Eyebrow } from "../../../primitives/eyebrow";
import { Mono } from "../../../typography/mono";
import { BACKTEST_DATASETS } from "../../data";
import type {
  BacktestData,
  BacktestDataset,
  BacktestRecipe,
} from "../../types";
import type { Dataset } from "../../../stream-timeline/types";

export interface StepDatasetProps {
  recipe: BacktestRecipe;
  onChange: (patch: Partial<BacktestRecipe>) => void;
  /** Real datasets provided by the host app; when present they take
   *  precedence over the internal mock catalog. */
  availableDatasets?: readonly Dataset[];
  className?: string;
}

const PRODUCTION_WINDOWS: readonly { id: string; label: string; window: string; count: number }[] = [
  { id: "win_1d", label: "Last 24 hours", window: "1d", count: 96 },
  { id: "win_7d", label: "Last 7 days", window: "7d", count: 482 },
  { id: "win_30d", label: "Last 30 days", window: "30d", count: 1842 },
  { id: "win_failures_7d", label: "Failures · last 7 days", window: "7d-fail", count: 37 },
];

export function StepDataset({
  recipe,
  onChange,
  availableDatasets,
  className,
}: StepDatasetProps) {
  const isReplay = recipe.mode === "replay";

  if (isReplay) {
    return (
      <ProductionWindowPicker
        recipe={recipe}
        onChange={onChange}
        className={className}
      />
    );
  }

  return (
    <SavedDatasetPicker
      recipe={recipe}
      onChange={onChange}
      availableDatasets={availableDatasets}
      className={className}
    />
  );
}

/* ── Production window picker (Replay) ─────────────────────── */

function ProductionWindowPicker({
  recipe,
  onChange,
  className,
}: Pick<StepDatasetProps, "recipe" | "onChange" | "className">) {
  const activeId = recipe.data.sources[0]?.id ?? null;

  const pick = (window: { id: string; label: string; window: string; count: number }) => {
    const next: BacktestData = {
      ...recipe.data,
      kind: "production",
      dataset: undefined,
      datasetLabel: undefined,
      sources: [
        {
          id: window.id,
          kind: "prod",
          label: window.label,
          count: window.count,
          filters: { window: window.window },
        },
      ],
      scenarios: [],
      savedAs: null,
    };
    onChange({ data: next });
  };

  return (
    <StepShell
      title="Pick a production window to replay"
      sub="Replay sweeps a slice of real production traffic across every agent version, no enrichment."
      className={className}
    >
      <ul className="grid gap-1.5 md:grid-cols-2">
        {PRODUCTION_WINDOWS.map((w) => (
          <li key={w.id}>
            <button
              type="button"
              onClick={() => pick(w)}
              aria-pressed={w.id === activeId}
              className={cx(
                "group flex w-full items-center gap-2 rounded-[2px] border px-3 py-2 text-left transition-colors",
                w.id === activeId
                  ? "border-ember/60 bg-ember/[0.06]"
                  : "border-l-border-faint bg-l-wash-1 hover:border-l-border-strong hover:bg-l-wash-3",
              )}
            >
              <ProdGlyph active={w.id === activeId} />
              <div className="min-w-0 flex-1">
                <div className="font-sans text-[13px] text-l-ink-hi">{w.label}</div>
                <Mono size="sm" tone="dim" className="truncate">
                  window · {w.window} · {w.count.toLocaleString()} traces
                </Mono>
              </div>
              {w.id === activeId ? (
                <Check className="size-3.5 shrink-0 text-ember" strokeWidth={1.8} />
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <ReplayHint />
    </StepShell>
  );
}

function ReplayHint() {
  return (
    <div className="flex items-start gap-2 rounded-[2px] border border-ember/25 bg-ember/[0.05] px-2.5 py-2">
      <span aria-hidden className="mt-1 size-1.5 rounded-full bg-ember" />
      <Mono tone="lo" size="sm" className="leading-relaxed">
        replay skips Discover gaps · the same trace runs verbatim across every agent version. switch to Compare or Regression to enrich coverage.
      </Mono>
    </div>
  );
}

function ProdGlyph({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        "grid size-7 shrink-0 place-items-center rounded-[2px] border",
        active ? "border-ember/40 text-ember" : "border-l-border-faint text-l-ink-lo",
      )}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M2 8a6 6 0 1 0 2-4.5" />
        <path d="M2 3v4h4" />
        <path d="M6 6.5l4 2-4 2z" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}

/* ── Saved dataset picker (Compare / Regression / Suite) ───── */

interface PickerEntry {
  id: string;
  label: string;
  cases: number;
  source: string;
  updated: string;
  /** Free-form purpose tag, e.g. "eval", "training". */
  purpose?: string;
}

function SavedDatasetPicker({
  recipe,
  onChange,
  availableDatasets,
  className,
}: Pick<StepDatasetProps, "recipe" | "onChange" | "availableDatasets" | "className">) {
  const [query, setQuery] = React.useState("");

  const entries = React.useMemo<readonly PickerEntry[]>(() => {
    if (availableDatasets && availableDatasets.length > 0) {
      return availableDatasets.map((d) => ({
        id: d.id,
        label: d.name,
        cases: d.traceCount,
        source: d.purpose ?? d.description ?? "dataset",
        updated: d.updatedAt
          ? new Date(d.updatedAt).toLocaleDateString()
          : "—",
        purpose: d.purpose,
      }));
    }
    return BACKTEST_DATASETS.map((d: BacktestDataset) => ({
      id: d.id,
      label: d.label,
      cases: d.cases,
      source: d.source,
      updated: d.updated,
    }));
  }, [availableDatasets]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q),
    );
  }, [entries, query]);

  const activeId = recipe.data.dataset ?? null;
  const selected = entries.find((e) => e.id === activeId) ?? null;

  const pick = (entry: PickerEntry) => {
    const next: BacktestData = {
      kind: "dataset",
      dataset: entry.id,
      datasetLabel: entry.label,
      sources: [
        {
          id: `src_${entry.id}`,
          kind: "dataset",
          label: entry.label,
          count: entry.cases,
        },
      ],
      scenarios: recipe.data.scenarios,
      savedAs: entry.label,
    };
    onChange({ data: next });
  };

  const isSuite = recipe.mode === "suite";

  return (
    <StepShell
      title={isSuite ? "Saved suite" : "Pick the dataset to start from"}
      sub={
        isSuite
          ? "Suites run against curated datasets with labeled outcomes."
          : "Pick a dataset — the next step finds missing scenarios so the run covers more than just what's already there."
      }
      className={className}
    >
      <div className="flex items-center gap-2 rounded-[2px] border border-l-border-faint bg-l-wash-1 px-2 py-1.5">
        <Search className="size-3.5 text-l-ink-dim" strokeWidth={1.6} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search datasets…"
          className="min-w-0 flex-1 bg-transparent font-sans text-[12.5px] text-l-ink-hi outline-none placeholder:text-l-ink-dim"
        />
        <Mono size="sm" tone="dim">
          {filtered.length} of {entries.length}
        </Mono>
      </div>

      <ul className="flex flex-col">
        {filtered.map((entry, idx) => (
          <li
            key={entry.id}
            className={cx(idx > 0 && "border-t border-l-border-faint")}
          >
            <button
              type="button"
              onClick={() => pick(entry)}
              aria-pressed={entry.id === activeId}
              className={cx(
                "group flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                entry.id === activeId
                  ? "bg-ember/[0.06]"
                  : "hover:bg-l-wash-3",
              )}
            >
              <Database
                className={cx(
                  "size-3.5 shrink-0",
                  entry.id === activeId ? "text-ember" : "text-l-ink-dim",
                )}
                strokeWidth={1.6}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-sans text-[13px] text-l-ink-hi truncate">
                    {entry.label}
                  </span>
                  {entry.purpose ? (
                    <Mono size="sm" tone="dim" className="uppercase tracking-tactical">
                      · {entry.purpose}
                    </Mono>
                  ) : null}
                </div>
                <Mono size="sm" tone="dim" className="truncate">
                  {entry.source} · updated {entry.updated}
                </Mono>
              </div>
              <Mono size="sm" tone="lo" className="tabular-nums">
                {entry.cases.toLocaleString()} cases
              </Mono>
              {entry.id === activeId ? (
                <Check className="size-3.5 shrink-0 text-ember" strokeWidth={1.8} />
              ) : null}
            </button>
          </li>
        ))}
        {filtered.length === 0 ? (
          <li className="px-3 py-6 text-center">
            <Mono size="sm" tone="dim">
              no datasets match · try clearing search
            </Mono>
          </li>
        ) : null}
      </ul>

      {selected ? (
        <div className="flex items-center justify-between gap-3 rounded-[2px] border border-l-border-faint bg-l-wash-1 px-3 py-2">
          <div className="flex flex-col gap-0.5">
            <Eyebrow className="text-ember">SELECTED</Eyebrow>
            <span className="font-sans text-[13px] text-l-ink-hi">{selected.label}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({
                data: {
                  ...recipe.data,
                  kind: "composed",
                  dataset: undefined,
                  datasetLabel: undefined,
                  sources: [],
                  savedAs: null,
                },
              })
            }
          >
            Clear
          </Button>
        </div>
      ) : null}
    </StepShell>
  );
}

/* ── Shared shell ─────────────────────────────────────────── */

function StepShell({
  title,
  sub,
  children,
  className,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-3 px-4 py-4", className)}>
      <header className="flex flex-col gap-0.5">
        <Eyebrow className="text-l-ink-dim">STEP 01 · DATASET</Eyebrow>
        <h3 className="font-display text-[15px] leading-none tracking-[-0.02em] text-l-ink-hi">
          {title}
        </h3>
        <p className="max-w-2xl text-[12.5px] text-l-ink-lo">{sub}</p>
      </header>
      {children}
    </div>
  );
}
