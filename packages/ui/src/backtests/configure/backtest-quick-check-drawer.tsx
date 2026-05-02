/*
 * BacktestQuickCheckDrawer — modal overlay that runs a 30-case
 * preview before the full sweep. Animated grid (cells fill in with
 * pass / regress / fail / improvement colors) + live pass/regress
 * counters + verdict copy + "launch full run" CTA.
 *
 * Driven by `state` and `progress` (0..100). The container component
 * (BacktestRecipe) owns the requestAnimationFrame ticker so stories
 * can render either the running or done snapshot deterministically.
 */

"use client";

import * as React from "react";
import { Play, X } from "lucide-react";

import { cx } from "../../utils/cx";
import { Button } from "../../primitives/button";
import { Eyebrow } from "../../primitives/eyebrow";
import { Mono } from "../../typography/mono";
import { Spinner } from "../../primitives/spinner";

import type {
  BacktestQuickCheckCellState,
  BacktestQuickCheckState,
  BacktestRecipe,
} from "../types";

const N_CELLS = 30;

export interface BacktestQuickCheckDrawerProps {
  isOpen: boolean;
  state: BacktestQuickCheckState;
  /** 0..100 percentage of cases done. */
  progress: number;
  recipe: BacktestRecipe;
  onClose?: () => void;
  onLaunch?: () => void;
}

/** Deterministic cell-state distribution based on seed × position so
 *  Storybook snapshots stay stable. */
function buildCellPalette(): BacktestQuickCheckCellState[] {
  const out: BacktestQuickCheckCellState[] = [];
  for (let i = 0; i < N_CELLS; i++) {
    const r = ((i * 2654435761) >>> 0) % 100 / 100;
    if (r < 0.12) out.push("regr");
    else if (r < 0.2) out.push("fail");
    else if (r < 0.9) out.push("pass");
    else out.push("improv");
  }
  return out;
}

const CELL_BG: Record<BacktestQuickCheckCellState, string> = {
  pending: "border border-dashed border-hairline bg-surface-01",
  pass: "bg-event-green/70",
  improv: "bg-event-green",
  regr: "bg-ember/85",
  fail: "bg-event-red/85",
};

export function BacktestQuickCheckDrawer({
  isOpen,
  state,
  progress,
  recipe,
  onClose,
  onLaunch,
}: BacktestQuickCheckDrawerProps) {
  const palette = React.useMemo(buildCellPalette, []);
  const done = Math.round((progress / 100) * N_CELLS);
  const shown = palette.slice(0, done);
  const pass = shown.filter((c) => c === "pass" || c === "improv").length;
  const regr = shown.filter((c) => c === "regr").length;
  const fail = shown.filter((c) => c === "fail").length;
  const multi = recipe.agents.length >= 2;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-l border border-hairline bg-surface-01 shadow-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-label="Quick check preview"
      >
        <header className="flex items-start justify-between gap-3 border-b border-hairline p-5">
          <div>
            <Eyebrow className="text-ember">
              {state === "running" ? "● QUICK CHECK · running" : "✓ QUICK CHECK · complete"}
            </Eyebrow>
            <h2 className="mt-1 font-display text-title font-light text-ink-hi">
              30-case preview
            </h2>
            <p className="mt-1 max-w-md text-body-sm text-ink-lo">
              A tiny sample from your real data, run end-to-end. Decide if the full sweep is
              worth it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-7 place-items-center rounded-l border border-hairline text-ink-lo transition-colors hover:border-hairline-strong hover:text-ink-hi"
            aria-label="Close"
          >
            <X className="size-3.5" strokeWidth={1.6} />
          </button>
        </header>

        <div className="grid flex-1 gap-5 p-5 sm:grid-cols-[1.2fr_1fr]">
          {/* Cell grid */}
          <div className="rounded-l border border-hairline bg-surface-02 p-3">
            <div className="grid grid-cols-6 gap-1.5">
              {Array.from({ length: N_CELLS }).map((_, i) => {
                const cell = i < done ? palette[i]! : "pending";
                return (
                  <span
                    key={i}
                    aria-hidden
                    className={cx("aspect-square rounded-l-sm", CELL_BG[cell])}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {/* Progress bar */}
            <div className="h-1 overflow-hidden rounded-pill bg-surface-02">
              <div
                className="h-full bg-ember transition-[width] duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-3 rounded-l border border-hairline bg-surface-02 p-3">
              <Metric label="PASS" value={pass} tone="good" />
              <Metric label={multi ? "DIVERGE" : "REGRESS"} value={regr} tone="bad" />
              <Metric label="FAIL" value={fail} tone="bad" />
              <Metric label="DONE" value={`${done}/${N_CELLS}`} />
            </div>

            {state === "done" ? (
              <div
                className={cx(
                  "rounded-l border p-3",
                  regr === 0
                    ? "border-event-green/30 bg-event-green/[0.06]"
                    : "border-ember/30 bg-ember/[0.06]",
                )}
              >
                <Eyebrow className={regr === 0 ? "text-event-green" : "text-ember"}>
                  VERDICT
                </Eyebrow>
                <p className="mt-1.5 text-body-sm text-ink">
                  {regr === 0 ? (
                    <>
                      No {multi ? "divergences" : "regressions"} in 30 cases. Confidence to
                      proceed to the full run is <b className="text-ink-hi">high</b>.
                    </>
                  ) : (
                    <>
                      Found <b className="text-ink-hi">{regr}</b>{" "}
                      {multi
                        ? regr === 1
                          ? "divergence"
                          : "divergences"
                        : regr === 1
                          ? "regression"
                          : "regressions"}
                      . You&rsquo;ll see them (and more like them) in the full run.
                    </>
                  )}
                </p>
              </div>
            ) : null}

            <div className="mt-auto flex items-center justify-end gap-2 border-t border-hairline pt-3">
              {state === "done" ? (
                <>
                  <Button variant="ghost" density="compact" onClick={onClose}>
                    edit recipe
                  </Button>
                  <Button
                    variant="ember"
                    density="compact"
                    leadingIcon={<Play className="size-3.5" fill="currentColor" />}
                    onClick={onLaunch}
                  >
                    launch full run
                  </Button>
                </>
              ) : (
                <span className="inline-flex items-center gap-2 text-body-sm text-ink-lo">
                  <Spinner size="sm" tone="ember" />
                  running {done}/{N_CELLS} cases…
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "good" | "bad";
}) {
  const valueClass =
    tone === "good" ? "text-event-green" : tone === "bad" ? "text-ember" : "text-ink-hi";
  return (
    <div className="flex flex-col gap-0.5">
      <Eyebrow className="text-ink-dim">{label}</Eyebrow>
      <span className={cx("font-display text-title font-light", valueClass)}>{value}</span>
    </div>
  );
}
