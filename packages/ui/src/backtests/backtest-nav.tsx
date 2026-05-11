/*
 * BacktestNav — top breadcrumb + 3-stage switcher used by the
 * Backtests surface. Mirrors the `BtNav` component from the mockup
 * but redrawn with Chronicle primitives + tokens.
 *
 * Layout:
 *   [chronicle / backtests / <run name>]   01 Configure · 02 Running · 03 Results
 */

"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";

import { Eyebrow } from "../primitives/eyebrow";
import { Mono } from "../typography/mono";
import { cx } from "../utils/cx";

import { RunStatusPill } from "./atoms";
import type { BacktestRunStatus, BacktestStage } from "./types";

type SwitchableStage = Exclude<BacktestStage, "list">;

interface StageDef {
  id: SwitchableStage;
  label: string;
  number: string;
}

const STAGES: readonly StageDef[] = [
  { id: "configure", label: "Configure", number: "01" },
  { id: "running", label: "Running", number: "02" },
  { id: "results", label: "Results", number: "03" },
];

export interface BacktestNavProps {
  /** Current stage; controls which switcher tab is highlighted. */
  stage: BacktestStage;
  /** Click handler for a stage tab. */
  onStageChange?: (stage: BacktestStage) => void;
  /** Click handler for the "back to all backtests" affordance. */
  onBackToList?: () => void;
  /** Display name of the current run (or "new backtest" while
   *  configuring). Shown after the breadcrumb. */
  runName: string;
  /** Optional run status pill rendered to the right of the run name. */
  runStatus?: BacktestRunStatus | null;
  /** Workspace label for the leading breadcrumb segment. */
  workspace?: string;
  className?: string;
}

export function BacktestNav({
  stage,
  onStageChange,
  onBackToList,
  runName,
  runStatus,
  workspace = "chronicle",
  className,
}: BacktestNavProps) {
  const stageIndex = STAGES.findIndex((s) => s.id === stage);

  return (
    <div
      className={cx(
        "flex items-center justify-between gap-4 border-b border-l-border-faint bg-l-surface px-4 py-2.5",
        className,
      )}
    >
      {/* Left: brand + breadcrumb + run status */}
      <div className="flex min-w-0 items-center gap-2">
        {onBackToList ? (
          <button
            type="button"
            onClick={onBackToList}
            title="Back to all backtests"
            className="inline-flex size-7 items-center justify-center rounded-md border border-l-border-faint text-l-ink-dim transition-colors hover:border-l-border-strong hover:text-l-ink-lo"
          >
            <ArrowLeft className="size-3.5" strokeWidth={1.6} />
          </button>
        ) : (
          <BrandMark />
        )}
        <Eyebrow className="text-l-ink-dim">{workspace}</Eyebrow>
        <BreadcrumbSeparator />
        {onBackToList ? (
          <button
            type="button"
            onClick={onBackToList}
            className="inline-flex items-center rounded-[2px] px-1 py-0.5 transition-colors hover:bg-l-wash-3"
          >
            <Eyebrow className="text-l-ink-lo">backtests</Eyebrow>
          </button>
        ) : (
          <Eyebrow className="text-l-ink-lo">backtests</Eyebrow>
        )}
        <BreadcrumbSeparator />
        <span className="truncate text-body-sm font-medium text-l-ink-hi">{runName}</span>
        {runStatus ? (
          <RunStatusPill
            tone={
              runStatus === "running"
                ? "live"
                : runStatus === "done"
                  ? "done"
                  : "paused"
            }
            className="ml-1"
          />
        ) : null}
      </div>

      {/* Center: stage switcher */}
      <div className="flex items-center gap-0.5 rounded-md border border-l-border-faint bg-l-wash-1 p-0.5">
        {STAGES.map((s, idx) => {
          const isActive = s.id === stage;
          const isDone = idx < stageIndex;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onStageChange?.(s.id)}
              data-state={isActive ? "on" : isDone ? "done" : "todo"}
              className={cx(
                "group inline-flex items-center gap-1.5 rounded-xs px-2.5 py-1 transition-colors",
                isActive
                  ? "bg-l-wash-5 text-l-ink-hi"
                  : "text-l-ink-lo hover:bg-l-wash-3 hover:text-l-ink",
              )}
            >
              <Mono
                size="sm"
                tone={isActive ? "hi" : isDone ? "lo" : "dim"}
                tactical
                uppercase
              >
                {s.number}
              </Mono>
              <span className="text-body-sm">{s.label}</span>
              {isDone ? (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-event-green"
                  aria-hidden
                >
                  <path d="M3 8l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Right: docs (placeholder for future actions) */}
      <button
        type="button"
        title="Docs"
        className="inline-flex size-7 items-center justify-center rounded-md border border-l-border-faint text-l-ink-dim transition-colors hover:border-l-border-strong hover:text-l-ink-lo"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          aria-hidden
        >
          <path d="M4 3h6l2 2v8H4z" />
          <path d="M6 6h4M6 9h4M6 12h3" />
        </svg>
      </button>
    </div>
  );
}

function BreadcrumbSeparator() {
  return (
    <span aria-hidden className="text-l-ink-dim">
      /
    </span>
  );
}

function BrandMark() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="text-ember"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 16c2-4 4-6 6-6s4 2 6 6" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12" cy="10" r="1.5" fill="currentColor" />
    </svg>
  );
}
