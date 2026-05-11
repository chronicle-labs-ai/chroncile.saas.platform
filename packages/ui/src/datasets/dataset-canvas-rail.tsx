"use client";

import * as React from "react";
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Loader2,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";

import { cx } from "../utils/cx";
import { formatNumber, RelativeTime } from "../connections/time";

import type {
  DatasetEvalRun,
  DatasetEvalRunStatus,
  DatasetSavedView,
} from "./types";

/*
 * DatasetCanvasRail — collapsible left rail mounted next to the
 * dataset canvas's main lens area. Hosts two sections:
 *
 *   - Saved views — durable canvas presets (filters + lens +
 *     group-by + density). Click an item to apply the captured
 *     state. The currently-applied view is highlighted; if the
 *     canvas state has drifted, the rail offers a "Save changes"
 *     affordance instead of "Save view".
 *
 *   - Eval runs — recent eval runs scoped to this dataset.
 *     Selecting a run marks failing trace ids in the list lens and
 *     binds the inspector's compare slot to the run's output.
 *
 * Pure presentational. Mutations are forwarded via callbacks; the
 * canvas owns the optimistic state.
 */

export interface DatasetCanvasRailProps {
  savedViews: readonly DatasetSavedView[];
  activeViewId: string | null;
  onApplyView: (view: DatasetSavedView) => void;
  /** Indicates the current canvas state differs from the active
   *  view — drives the "Save changes" affordance. */
  isViewDirty?: boolean;
  onSaveCurrentView?: () => void;
  onDeleteView?: (viewId: string) => void;

  evalRuns?: readonly DatasetEvalRun[];
  activeEvalRunId?: string | null;
  onSelectEvalRun?: (runId: string | null) => void;

  className?: string;
}

const STATUS_META: Record<
  DatasetEvalRunStatus,
  {
    Icon: React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: true }>;
    iconClass: string;
    label: string;
  }
> = {
  passing: { Icon: CheckCircle2, iconClass: "text-l-status-done", label: "Pass" },
  regressed: {
    Icon: AlertCircle,
    iconClass: "text-l-status-inprogress",
    label: "Regressed",
  },
  running: { Icon: Loader2, iconClass: "text-l-ink-lo animate-spin", label: "Running" },
  failed: { Icon: XCircle, iconClass: "text-l-p-urgent", label: "Failed" },
};

export function DatasetCanvasRail({
  savedViews,
  activeViewId,
  onApplyView,
  isViewDirty,
  onSaveCurrentView,
  onDeleteView,
  evalRuns,
  activeEvalRunId,
  onSelectEvalRun,
  className,
}: DatasetCanvasRailProps) {
  return (
    <aside
      aria-label="Dataset rail"
      className={cx(
        "flex w-[200px] shrink-0 flex-col gap-3 self-stretch border-r border-l-border-faint bg-l-surface-bar/30 p-2.5",
        "overflow-y-auto",
        className,
      )}
    >
      <SavedViewsSection
        views={savedViews}
        activeViewId={activeViewId}
        isViewDirty={isViewDirty}
        onApply={onApplyView}
        onSaveCurrent={onSaveCurrentView}
        onDelete={onDeleteView}
      />

      {evalRuns && evalRuns.length > 0 ? (
        <EvalRunsSection
          runs={evalRuns}
          activeRunId={activeEvalRunId ?? null}
          onSelect={onSelectEvalRun}
        />
      ) : null}
    </aside>
  );
}

/* ── Saved views ──────────────────────────────────────────── */

function SavedViewsSection({
  views,
  activeViewId,
  isViewDirty,
  onApply,
  onSaveCurrent,
  onDelete,
}: {
  views: readonly DatasetSavedView[];
  activeViewId: string | null;
  isViewDirty?: boolean;
  onApply: (view: DatasetSavedView) => void;
  onSaveCurrent?: () => void;
  onDelete?: (viewId: string) => void;
}) {
  const [hoverId, setHoverId] = React.useState<string | null>(null);

  return (
    <section className="flex flex-col gap-1.5">
      <header className="flex items-center justify-between px-1.5">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.08em] text-l-ink-dim">
          Saved views
        </h3>
        {onSaveCurrent ? (
          <button
            type="button"
            onClick={onSaveCurrent}
            className={cx(
              "inline-flex h-5 items-center gap-1 rounded-[3px] px-1.5",
              "font-mono text-[10px] uppercase tracking-[0.06em]",
              "text-l-ink-dim hover:text-l-ink hover:bg-l-surface-hover",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
              isViewDirty ? "text-ember" : null,
            )}
            title={isViewDirty ? "Save changes" : "Save current view"}
          >
            <Plus className="size-3" strokeWidth={1.75} aria-hidden />
            {isViewDirty && activeViewId ? "Save changes" : "Save"}
          </button>
        ) : null}
      </header>

      {views.length === 0 ? (
        <p className="px-1.5 font-sans text-[11.5px] text-l-ink-dim">
          No saved views yet. Filter the list, then press Save.
        </p>
      ) : (
        <ul className="flex flex-col">
          {views.map((view) => {
            const active = view.id === activeViewId;
            return (
              <li
                key={view.id}
                onMouseEnter={() => setHoverId(view.id)}
                onMouseLeave={() => setHoverId((cur) => (cur === view.id ? null : cur))}
              >
                <div
                  className={cx(
                    "group flex items-center gap-1.5 rounded-[3px] px-1.5",
                    active ? "bg-l-surface-selected" : null,
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onApply(view)}
                    className={cx(
                      "flex flex-1 min-w-0 items-center gap-1.5 py-1 text-left",
                      "font-sans text-[12px] text-l-ink",
                      "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
                    )}
                    aria-pressed={active}
                  >
                    <Bookmark
                      className={cx(
                        "size-3.5 shrink-0",
                        active ? "text-ember" : "text-l-ink-dim",
                      )}
                      strokeWidth={1.6}
                      aria-hidden
                    />
                    <span className="truncate">{view.name}</span>
                    {active && isViewDirty ? (
                      <span
                        aria-hidden
                        title="Unsaved changes"
                        className="ml-1 inline-block size-1.5 rounded-pill bg-ember"
                      />
                    ) : null}
                  </button>
                  {onDelete && hoverId === view.id ? (
                    <button
                      type="button"
                      onClick={() => onDelete(view.id)}
                      className={cx(
                        "inline-flex h-5 w-5 items-center justify-center rounded-[3px] text-l-ink-dim",
                        "hover:bg-l-surface-hover hover:text-l-p-urgent",
                        "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
                      )}
                      aria-label={`Delete view ${view.name}`}
                    >
                      <Trash2 className="size-3" strokeWidth={1.75} aria-hidden />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ── Eval runs ────────────────────────────────────────────── */

function EvalRunsSection({
  runs,
  activeRunId,
  onSelect,
}: {
  runs: readonly DatasetEvalRun[];
  activeRunId: string | null;
  onSelect?: (runId: string | null) => void;
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <header className="flex items-center justify-between px-1.5">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.08em] text-l-ink-dim">
          Eval runs
        </h3>
        <span className="font-mono text-[10px] tabular-nums text-l-ink-dim">
          {formatNumber(runs.length)}
        </span>
      </header>

      <ul className="flex flex-col gap-1">
        {runs.map((run) => (
          <li key={run.id}>
            <EvalRunRow
              run={run}
              active={run.id === activeRunId}
              onSelect={() =>
                onSelect?.(run.id === activeRunId ? null : run.id)
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function EvalRunRow({
  run,
  active,
  onSelect,
}: {
  run: DatasetEvalRun;
  active: boolean;
  onSelect: () => void;
}) {
  const meta = STATUS_META[run.status];
  const Icon = meta.Icon;
  const failingCount = run.failedTraceIds.length;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cx(
        "group flex w-full flex-col gap-1 rounded-[3px] border border-l-border-faint px-2 py-1.5 text-left",
        "transition-colors duration-fast ease-out motion-reduce:transition-none",
        "hover:bg-l-surface-hover focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
        active
          ? "border-ember/40 bg-l-surface-selected"
          : "bg-l-surface-raised",
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon
          className={cx("size-3 shrink-0", meta.iconClass)}
          strokeWidth={1.75}
          aria-hidden
        />
        <span className="flex-1 truncate font-sans text-[12px] text-l-ink">
          {run.agentLabel}
        </span>
        <ChevronRight
          className={cx(
            "size-3 shrink-0 text-l-ink-dim transition-opacity",
            active ? "opacity-100 text-ember" : "opacity-0 group-hover:opacity-100",
          )}
          strokeWidth={1.75}
          aria-hidden
        />
      </div>
      <div className="flex items-center gap-1 font-mono text-[10px] tabular-nums text-l-ink-dim">
        {run.passRate != null ? (
          <span
            className={cx(
              run.passRate >= 0.9
                ? "text-l-status-done"
                : run.passRate >= 0.7
                  ? "text-l-status-inprogress"
                  : "text-l-p-urgent",
            )}
          >
            {Math.round(run.passRate * 100)}%
          </span>
        ) : (
          <CircleDashed
            className="size-3 text-l-ink-dim"
            strokeWidth={1.5}
            aria-hidden
          />
        )}
        {failingCount > 0 ? (
          <>
            <span aria-hidden>·</span>
            <span>{formatNumber(failingCount)} failing</span>
          </>
        ) : null}
        <span aria-hidden>·</span>
        <RelativeTime iso={run.startedAt} fallback="—" />
      </div>
    </button>
  );
}
