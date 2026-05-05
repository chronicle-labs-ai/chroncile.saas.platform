/*
 * StepEnrich — pipeline step 02.
 *
 * Cluster-based scenario discovery. The data-science layer proposes
 * additional scenarios in four buckets:
 *
 *   Captured  · clusters already in the dataset
 *   Adjacent  · close variations of captured clusters
 *   Emerging  · new patterns observed in production
 *   Edge      · long-tail / unusual cases
 *
 * The user accepts/declines proposals; accepted scenarios join the
 * recipe's `data.scenarios` and contribute to the case total.
 *
 * Hidden / no-op for the Replay preset (the parent skips routing
 * here, but we render a read-only banner if it's reached anyway).
 */

"use client";

import * as React from "react";
import { Check, Plus } from "lucide-react";

import { cx } from "../../../utils/cx";
import { Eyebrow } from "../../../primitives/eyebrow";
import { Input } from "../../../primitives/input";
import { Mono } from "../../../typography/mono";
import {
  BACKTEST_DISCOVERY_PROPOSALS,
  BACKTEST_SCENARIO_BUCKETS,
  bucketMeta,
} from "../../data";
import type {
  BacktestDataScenario,
  BacktestRecipe,
  BacktestScenarioBucket,
} from "../../types";

export interface StepEnrichProps {
  recipe: BacktestRecipe;
  onChange: (patch: Partial<BacktestRecipe>) => void;
  /** Override the discovery proposals — host can pass real ones from
   *  the data-science layer. Defaults to the deterministic seed. */
  proposals?: readonly BacktestDataScenario[];
  className?: string;
}

export function StepEnrich({
  recipe,
  onChange,
  proposals = BACKTEST_DISCOVERY_PROPOSALS,
  className,
}: StepEnrichProps) {
  const isReplay = recipe.mode === "replay";

  const merged = React.useMemo(() => {
    const map = new Map<string, BacktestDataScenario>();
    for (const p of proposals) map.set(p.id, p);
    for (const s of recipe.data.scenarios) {
      if (s.bucket) map.set(s.id, s);
    }
    return Array.from(map.values());
  }, [proposals, recipe.data.scenarios]);

  const acceptedIds = React.useMemo(() => {
    return new Set(
      recipe.data.scenarios
        .filter((s) => s.accepted !== false)
        .map((s) => s.id),
    );
  }, [recipe.data.scenarios]);

  const setScenarios = (scenarios: readonly BacktestDataScenario[]) => {
    onChange({
      data: {
        ...recipe.data,
        kind: recipe.data.kind === "production" ? "composed" : recipe.data.kind,
        scenarios,
      },
    });
  };

  const toggle = (scenario: BacktestDataScenario, accepted: boolean) => {
    const existing = recipe.data.scenarios.find((s) => s.id === scenario.id);
    let next: BacktestDataScenario[];
    if (existing) {
      next = recipe.data.scenarios.map((s) =>
        s.id === scenario.id ? { ...s, accepted } : s,
      );
    } else {
      next = [...recipe.data.scenarios, { ...scenario, accepted }];
    }
    setScenarios(next);
  };

  const acceptAll = (bucket: BacktestScenarioBucket) => {
    const additions = merged
      .filter((s) => s.bucket === bucket && !acceptedIds.has(s.id))
      .map<BacktestDataScenario>((s) => ({ ...s, accepted: true }));
    if (additions.length === 0) return;

    const seenIds = new Set(recipe.data.scenarios.map((s) => s.id));
    const updated = recipe.data.scenarios.map((s) =>
      s.bucket === bucket ? { ...s, accepted: true } : s,
    );
    const fresh = additions.filter((a) => !seenIds.has(a.id));
    setScenarios([...updated, ...fresh]);
  };

  const setSavedAs = (value: string) => {
    onChange({
      data: { ...recipe.data, savedAs: value || null },
    });
  };

  const totals = React.useMemo(() => {
    const accepted = recipe.data.scenarios.filter(
      (s) => s.accepted !== false,
    );
    const cases = accepted.reduce((acc, s) => acc + s.count, 0);
    const buckets = new Set(accepted.map((s) => s.bucket).filter(Boolean));
    return { count: accepted.length, cases, buckets: buckets.size };
  }, [recipe.data.scenarios]);

  if (isReplay) {
    return (
      <ReplayBanner />
    );
  }

  return (
    <div className={cx("flex flex-col gap-3 px-4 py-4", className)}>
      <header className="flex flex-col gap-0.5">
        <Eyebrow className="text-l-ink-dim">STEP 02 · DISCOVER GAPS</Eyebrow>
        <h3 className="font-display text-[15px] leading-none tracking-[-0.02em] text-l-ink-hi">
          Enrich coverage with discovered scenarios
        </h3>
        <p className="max-w-2xl text-[12.5px] text-l-ink-lo">
          Chronicle clusters production traces and proposes scenarios in
          four buckets — accept the ones worth running through every
          agent version. Edge picks find the failures the dataset never
          saw.
        </p>
      </header>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {BACKTEST_SCENARIO_BUCKETS.map((meta) => {
          const proposalsForBucket = merged.filter((s) => s.bucket === meta.id);
          return (
            <BucketColumn
              key={meta.id}
              bucket={meta.id}
              proposals={proposalsForBucket}
              acceptedIds={acceptedIds}
              onToggle={toggle}
              onAcceptAll={() => acceptAll(meta.id)}
            />
          );
        })}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-[2px] border border-l-border-faint bg-l-wash-1 px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <Stat label="accepted" value={`${totals.count}`} />
          <Stat label="cases" value={totals.cases.toLocaleString()} />
          <Stat
            label="buckets"
            value={`${totals.buckets} of ${BACKTEST_SCENARIO_BUCKETS.length}`}
          />
        </div>
        <div className="flex items-center gap-2">
          <Eyebrow className="text-l-ink-dim">SAVE AS</Eyebrow>
          <Input
            type="text"
            value={recipe.data.savedAs ?? ""}
            onChange={(e) => setSavedAs(e.target.value)}
            placeholder="optional dataset name"
            className="h-7 w-56 text-[12.5px]"
          />
        </div>
      </footer>
    </div>
  );
}

/* ── Bucket column ─────────────────────────────────────────── */

function BucketColumn({
  bucket,
  proposals,
  acceptedIds,
  onToggle,
  onAcceptAll,
}: {
  bucket: BacktestScenarioBucket;
  proposals: readonly BacktestDataScenario[];
  acceptedIds: Set<string>;
  onToggle: (scenario: BacktestDataScenario, accepted: boolean) => void;
  onAcceptAll: () => void;
}) {
  const meta = bucketMeta(bucket);
  const acceptedCount = proposals.filter((p) => acceptedIds.has(p.id)).length;
  return (
    <section className="flex min-h-0 flex-col gap-1.5 rounded-[2px] border border-l-border-faint bg-l-surface-raised">
      <header
        className="flex items-center gap-2 border-b border-l-border-faint px-2.5 py-2"
        style={{ background: `color-mix(in oklab, ${meta.hue} 6%, transparent)` }}
      >
        <BucketGlyph variant={meta.glyph} hue={meta.hue} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="font-sans text-[12.5px] font-medium text-l-ink-hi">
              {meta.label}
            </span>
            <Mono size="sm" tone="dim">
              · {meta.description}
            </Mono>
          </div>
          <Mono size="sm" tone="dim">
            {acceptedCount} of {proposals.length} accepted
          </Mono>
        </div>
        {proposals.length > 0 && acceptedCount < proposals.length ? (
          <button
            type="button"
            onClick={onAcceptAll}
            className="rounded-[2px] border border-l-border-faint px-1.5 py-0.5 font-mono text-mono-sm uppercase tracking-tactical text-l-ink-lo transition-colors hover:border-l-border-strong hover:text-l-ink-hi"
          >
            accept all
          </button>
        ) : null}
      </header>
      <ul className="flex flex-col">
        {proposals.length === 0 ? (
          <li className="px-2.5 py-3 text-center">
            <Mono size="sm" tone="dim">
              no proposals
            </Mono>
          </li>
        ) : null}
        {proposals.map((proposal, idx) => (
          <li
            key={proposal.id}
            className={cx(idx > 0 && "border-t border-l-border-faint")}
          >
            <ProposalRow
              scenario={proposal}
              accepted={acceptedIds.has(proposal.id)}
              onToggle={(accepted) => onToggle(proposal, accepted)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProposalRow({
  scenario,
  accepted,
  onToggle,
}: {
  scenario: BacktestDataScenario;
  accepted: boolean;
  onToggle: (accepted: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!accepted)}
      aria-pressed={accepted}
      className={cx(
        "group flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors",
        accepted ? "bg-ember/[0.05]" : "hover:bg-l-wash-3",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "grid size-3.5 shrink-0 place-items-center rounded-[2px] border",
          accepted
            ? "border-ember bg-ember text-[var(--c-surface-00)]"
            : "border-l-border-faint text-transparent",
        )}
      >
        {accepted ? (
          <Check className="size-2.5" strokeWidth={2.4} />
        ) : (
          <Plus className="size-2.5 text-l-ink-dim" strokeWidth={2} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-mono-sm text-l-ink-hi truncate">
          {scenario.label}
        </div>
        <Mono size="sm" tone="dim" className="truncate">
          {scenario.kind} · {scenario.count} case{scenario.count === 1 ? "" : "s"}
          {typeof scenario.confidence === "number" ? (
            <> · {(scenario.confidence * 100).toFixed(0)}% conf</>
          ) : null}
        </Mono>
      </div>
    </button>
  );
}

/* ── Bucket glyph ──────────────────────────────────────────── */

function BucketGlyph({
  variant,
  hue,
}: {
  variant: "filled" | "three-quarter" | "half" | "dotted";
  hue: string;
}) {
  return (
    <span
      aria-hidden
      className="relative grid size-4 shrink-0 place-items-center rounded-full border"
      style={{ borderColor: hue }}
    >
      {variant === "filled" ? (
        <span
          className="block size-2.5 rounded-full"
          style={{ background: hue }}
        />
      ) : null}
      {variant === "three-quarter" ? (
        <span
          className="block size-2.5 rounded-full"
          style={{
            background: `conic-gradient(${hue} 270deg, transparent 0)`,
          }}
        />
      ) : null}
      {variant === "half" ? (
        <span
          className="block size-2.5 rounded-full"
          style={{
            background: `conic-gradient(${hue} 180deg, transparent 0)`,
          }}
        />
      ) : null}
      {variant === "dotted" ? (
        <span
          className="block size-1 rounded-full"
          style={{ background: hue }}
        />
      ) : null}
    </span>
  );
}

/* ── Replay banner (defensive only) ────────────────────────── */

function ReplayBanner() {
  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <header className="flex flex-col gap-0.5">
        <Eyebrow className="text-l-ink-dim">STEP 02 · DISCOVER GAPS</Eyebrow>
        <h3 className="font-display text-[15px] leading-none tracking-[-0.02em] text-l-ink-hi">
          Skipped — replay runs production traces verbatim
        </h3>
      </header>
      <Mono size="sm" tone="dim">
        switch the starting point to Compare, Regression, or Suite to
        enrich coverage with discovered scenarios.
      </Mono>
    </div>
  );
}

/* ── Stat ──────────────────────────────────────────────────── */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Eyebrow className="text-l-ink-dim">{label}</Eyebrow>
      <span className="font-sans text-[14px] font-medium leading-none text-l-ink-hi tabular-nums">
        {value}
      </span>
    </div>
  );
}

