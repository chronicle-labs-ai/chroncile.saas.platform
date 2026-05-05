/*
 * StepEnvironment — pipeline step 03.
 *
 * Picks the sandbox environment the run will execute in. Two paths:
 *
 *   - Saved environment — pick an existing `SandboxEnvironment` from
 *     the registry; we surface a snapshot-match indicator so the
 *     user knows the environment is seeded with the same dataset
 *     they picked in step 01.
 *   - Clone & seed — spin up an ephemeral sandbox seeded with the
 *     dataset from step 01. Wires to a passed callback the host can
 *     bind to `/api/sandbox/lifecycle`.
 */

"use client";

import * as React from "react";
import { Check, GitBranch, Server } from "lucide-react";

import { cx } from "../../../utils/cx";
import { Button } from "../../../primitives/button";
import { Eyebrow } from "../../../primitives/eyebrow";
import { Mono } from "../../../typography/mono";
import { BACKTEST_ENVIRONMENTS_SEED } from "../../data";
import type {
  BacktestEnvironmentRef,
  BacktestRecipe,
} from "../../types";
import type { SandboxEnvironment } from "../../../environments/types";

export interface StepEnvironmentProps {
  recipe: BacktestRecipe;
  onChange: (patch: Partial<BacktestRecipe>) => void;
  /** Real environments provided by the host; falls back to seed. */
  availableEnvironments?: readonly SandboxEnvironment[];
  /** When provided, exposes a "Clone & seed sandbox" button — wires
   *  to `/api/sandbox/lifecycle` in the app. */
  onCloneSandbox?: (recipe: BacktestRecipe) => Promise<BacktestEnvironmentRef>;
  className?: string;
}

export function StepEnvironment({
  recipe,
  onChange,
  availableEnvironments,
  onCloneSandbox,
  className,
}: StepEnvironmentProps) {
  const [cloning, setCloning] = React.useState(false);

  const entries = React.useMemo<readonly BacktestEnvironmentRef[]>(() => {
    if (availableEnvironments && availableEnvironments.length > 0) {
      return availableEnvironments.map<BacktestEnvironmentRef>((env) => ({
        id: env.id,
        label: env.name,
        snapshotId: env.currentSnapshot.id,
        snapshotLabel: env.currentSnapshot.sourceDataset,
        status: env.status,
      }));
    }
    return BACKTEST_ENVIRONMENTS_SEED;
  }, [availableEnvironments]);

  const datasetSlug = React.useMemo(() => {
    const d = recipe.data;
    if (d.kind === "dataset") return d.dataset ?? d.datasetLabel ?? null;
    if (d.kind === "production") return null;
    return d.savedAs ?? null;
  }, [recipe.data]);

  const pick = (env: BacktestEnvironmentRef) => {
    onChange({ environment: { ...env } });
  };

  const handleClone = async () => {
    if (!onCloneSandbox) return;
    setCloning(true);
    try {
      const ephemeral = await onCloneSandbox(recipe);
      onChange({ environment: { ...ephemeral, ephemeral: true } });
    } finally {
      setCloning(false);
    }
  };

  const activeId = recipe.environment?.id ?? null;

  return (
    <div className={cx("flex flex-col gap-3 px-4 py-4", className)}>
      <header className="flex flex-col gap-0.5">
        <Eyebrow className="text-l-ink-dim">STEP 03 · ENVIRONMENT</Eyebrow>
        <h3 className="font-display text-[15px] leading-none tracking-[-0.02em] text-l-ink-hi">
          Seed the run in a sandbox environment
        </h3>
        <p className="max-w-2xl text-[12.5px] text-l-ink-lo">
          Each agent version executes inside a Daytona sandbox seeded
          with the dataset from step 01. Pick a shared environment or
          clone a fresh ephemeral one for this run.
        </p>
      </header>

      <ul className="flex flex-col">
        {entries.map((env, idx) => (
          <li
            key={env.id}
            className={cx(
              "rounded-[2px]",
              idx > 0 && "border-t border-l-border-faint",
            )}
          >
            <EnvRow
              env={env}
              active={env.id === activeId}
              datasetSlug={datasetSlug}
              onClick={() => pick(env)}
            />
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[2px] border border-dashed border-l-border-faint bg-l-wash-1 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <GitBranch className="size-3.5 text-l-ink-dim" strokeWidth={1.6} />
          <div className="min-w-0">
            <div className="font-sans text-[12.5px] text-l-ink-hi">
              Clone & seed an ephemeral sandbox
            </div>
            <Mono size="sm" tone="dim" className="truncate">
              {datasetSlug
                ? `seeds with ${datasetSlug} · destroyed when the run finishes`
                : "seeds from the dataset chosen in step 01"}
            </Mono>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={!onCloneSandbox || cloning}
          onClick={handleClone}
        >
          {cloning ? "Cloning…" : "Clone & seed"}
        </Button>
      </div>
    </div>
  );
}

function EnvRow({
  env,
  active,
  datasetSlug,
  onClick,
}: {
  env: BacktestEnvironmentRef;
  active: boolean;
  datasetSlug: string | null;
  onClick: () => void;
}) {
  const matchesDataset =
    datasetSlug && env.snapshotLabel
      ? env.snapshotLabel === datasetSlug
      : null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "group flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
        active ? "bg-ember/[0.06]" : "hover:bg-l-wash-3",
      )}
    >
      <Server
        className={cx("size-3.5 shrink-0", active ? "text-ember" : "text-l-ink-dim")}
        strokeWidth={1.6}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-sans text-[13px] text-l-ink-hi truncate">
            {env.label}
          </span>
          {env.ephemeral ? (
            <Mono size="sm" tone="dim" className="uppercase tracking-tactical">
              · ephemeral
            </Mono>
          ) : null}
        </div>
        <Mono size="sm" tone="dim" className="truncate">
          snapshot · {env.snapshotLabel ?? "—"}
          {env.status ? <> · {env.status}</> : null}
        </Mono>
      </div>
      {matchesDataset === true ? (
        <Mono
          size="sm"
          tone="lo"
          className="rounded-[2px] border border-ember/30 bg-ember/10 px-1.5 py-0.5 uppercase tracking-tactical text-ember"
        >
          dataset matches
        </Mono>
      ) : null}
      {matchesDataset === false ? (
        <Mono
          size="sm"
          tone="lo"
          className="rounded-[2px] border border-l-border-faint px-1.5 py-0.5 uppercase tracking-tactical text-l-ink-dim"
        >
          re-seed required
        </Mono>
      ) : null}
      {active ? (
        <Check className="size-3.5 shrink-0 text-ember" strokeWidth={1.8} />
      ) : null}
    </button>
  );
}
