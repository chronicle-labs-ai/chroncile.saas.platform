/*
 * BacktestsList — manager landing page for the Backtests surface.
 *
 * Mirrors the visual chrome of `DatasetsManager` so the two surfaces
 * read as the same product:
 *
 *   - Big display headline ("Your backtest runs.") + sub copy
 *     summarizing total runs, status breakdown, last activity.
 *   - Toolbar row: search input on the right with filter / sort /
 *     panel icon buttons (mirrors `DatasetsToolbar`).
 *   - Linear-density grouped list — runs grouped by mode (Replay /
 *     Compare / Regression / Suite). Each group header has an icon,
 *     label, count, and a `+` to start a new run with that preset.
 *   - Row chrome: RUN-XXX issue id · name + status pill · primary
 *     environment tag · owner avatar · date · actions menu.
 *
 * Wholly presentational — `BacktestsManager` owns navigation;
 * this component only emits `onCreateRun`, `onPickRun`, and the
 * inline action menu callbacks.
 */

"use client";

import * as React from "react";
import {
  BarChart3,
  ChevronDown,
  Filter,
  MoreHorizontal,
  PanelRight,
  Plus,
  Server,
  SlidersHorizontal,
} from "lucide-react";

import { cx } from "../../utils/cx";
import {
  Avatar,
  AvatarFallback,
  deriveInitials,
  type AvatarTone,
} from "../../primitives/avatar";
import { Button } from "../../primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../primitives/dropdown-menu";
import { Input } from "../../primitives/input";
import { Tag, type TagVariant } from "../../primitives/tag";
import { RunStatusPill } from "../atoms";
import { BACKTEST_JOB_PRESETS, BACKTEST_RUNS_SEED } from "../data";
import { JobIcon } from "../job-meta";
import type {
  BacktestJobIcon,
  BacktestJobMode,
  BacktestJobPreset,
  BacktestRunStatus,
  BacktestRunSummary,
} from "../types";

import { NewBacktestMenu } from "./new-backtest-menu";

/** Shared chrome for the toolbar's 32×32 icon buttons (copied from
 *  `DatasetsToolbar` so the two surfaces feel like the same
 *  product). */
const TOOLBAR_ICON_BUTTON_CN = cx(
  "relative inline-flex size-8 shrink-0 items-center justify-center rounded-[10px]",
  "border border-l-border-faint bg-l-wash-1 text-l-ink-lo",
  "transition-colors duration-fast ease-out motion-reduce:transition-none",
  "hover:bg-l-wash-3 hover:text-l-ink",
  "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
  "disabled:cursor-not-allowed disabled:opacity-40",
);

export interface BacktestsListProps {
  /** Override the run rows. Defaults to `BACKTEST_RUNS_SEED`. */
  runs?: readonly BacktestRunSummary[];
  /** Called when the user clicks a run row. */
  onPickRun?: (run: BacktestRunSummary) => void;
  /** Called when the user picks a preset from any "+" affordance. */
  onCreateRun?: (preset: BacktestJobPreset) => void;
  /** Optional: called when the user picks "Open" from a row's
   *  actions menu. Defaults to the same handler as `onPickRun`. */
  onOpenRun?: (run: BacktestRunSummary) => void;
  /** Optional: called when the user picks "Duplicate" — host can
   *  clone the recipe and route to configure. */
  onDuplicateRun?: (run: BacktestRunSummary) => void;
  /** Optional: called when the user picks "Delete". */
  onDeleteRun?: (run: BacktestRunSummary) => void;
  /** Workspace label rendered in the header. */
  workspace?: string;
  className?: string;
}

export function BacktestsList({
  runs = BACKTEST_RUNS_SEED,
  onPickRun,
  onCreateRun,
  onOpenRun,
  onDuplicateRun,
  onDeleteRun,
  workspace = "Chronicle",
  className,
}: BacktestsListProps) {
  const [query, setQuery] = React.useState("");
  const [collapsedGroups, setCollapsedGroups] = React.useState<readonly string[]>([]);
  const [panelOpen, setPanelOpen] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return runs;
    return runs.filter((r) => {
      const haystack = `${r.name} ${r.datasetLabel} ${r.environmentLabel ?? ""} ${r.owner ?? ""} ${r.id} ${r.mode}`;
      return haystack.toLowerCase().includes(q);
    });
  }, [runs, query]);

  const grouped = React.useMemo(() => groupRunsByMode(filtered), [filtered]);
  const summary = React.useMemo(() => summarizeRuns(runs), [runs]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((cur) =>
      cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key],
    );
  };

  const handleCreateInMode = (mode: BacktestJobMode) => {
    const preset = BACKTEST_JOB_PRESETS.find((p) => p.id === mode);
    if (preset) onCreateRun?.(preset);
  };

  const handleOpen = (run: BacktestRunSummary) => {
    onOpenRun?.(run);
    onPickRun?.(run);
  };

  const showFilteredEmpty = runs.length > 0 && filtered.length === 0;
  const showEmpty = runs.length === 0;

  // Suppress unused — workspace prop kept symmetrical with DatasetsManager.
  void workspace;

  return (
    <div
      className={cx(
        "flex h-full min-h-0 flex-col bg-l-surface text-l-ink",
        "min-h-[calc(100svh-var(--header-height,3.5rem)-2rem)] gap-4 p-4",
        className,
      )}
    >
      <ListHeader runs={runs} summary={summary} onCreate={onCreateRun} />

      {showEmpty ? (
        <EmptyState onCreate={onCreateRun} />
      ) : (
        <>
          <Toolbar
            query={query}
            onQueryChange={setQuery}
            totalCount={runs.length}
            panelOpen={panelOpen}
            onPanelToggle={() => setPanelOpen((v) => !v)}
          />

          {showFilteredEmpty ? (
            <FilteredEmptyState onClearFilters={() => setQuery("")} />
          ) : (
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <GroupedRunsList
                groups={grouped}
                collapsedGroups={collapsedGroups}
                onToggleGroup={toggleGroup}
                onCreateInMode={handleCreateInMode}
                onOpen={handleOpen}
                renderActions={(run) => (
                  <RunActionsMenu
                    run={run}
                    onOpen={handleOpen}
                    onDuplicate={onDuplicateRun}
                    onDelete={onDeleteRun}
                  />
                )}
              />
              {panelOpen ? <BacktestStatusPanel runs={runs} summary={summary} /> : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Header ────────────────────────────────────────────────── */

interface RunsSummary {
  total: number;
  running: number;
  scheduled: number;
  done: number;
  drafts: number;
  failed: number;
}

function summarizeRuns(runs: readonly BacktestRunSummary[]): RunsSummary {
  return runs.reduce<RunsSummary>(
    (acc, r) => {
      acc.total += 1;
      if (r.status === "running") acc.running += 1;
      else if (r.status === "scheduled") acc.scheduled += 1;
      else if (r.status === "done") acc.done += 1;
      else if (r.status === "draft") acc.drafts += 1;
      else if (r.status === "failed") acc.failed += 1;
      return acc;
    },
    { total: 0, running: 0, scheduled: 0, done: 0, drafts: 0, failed: 0 },
  );
}

function ListHeader({
  runs,
  summary,
  onCreate,
}: {
  runs: readonly BacktestRunSummary[];
  summary: RunsSummary;
  onCreate?: (preset: BacktestJobPreset) => void;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-l-border-faint pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="font-display text-[34px] font-normal leading-none tracking-[-0.04em] text-l-ink-hi md:text-[44px]">
          Your backtest{" "}
          <em className="font-normal italic text-ember">runs.</em>
        </h1>
        <p className="mt-2 max-w-2xl text-[12.5px] leading-5 text-l-ink-dim">
          Configure runs that take a dataset, enrich it with discovered
          scenarios, seed it in an environment, and replay across every
          registered agent version.{" "}
          {runs.length > 0
            ? `${summary.total} ${summary.total === 1 ? "run" : "runs"} · ${summary.running} running, ${summary.scheduled} scheduled, ${summary.done} done${summary.drafts > 0 ? `, ${summary.drafts} draft${summary.drafts === 1 ? "" : "s"}` : ""}${summary.failed > 0 ? `, ${summary.failed} failed` : ""}.`
            : "Create your first backtest to start replaying production traffic across versions."}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <NewBacktestMenu onPick={onCreate} />
      </div>
    </header>
  );
}

/* ── Toolbar ───────────────────────────────────────────────── */

function Toolbar({
  query,
  onQueryChange,
  totalCount,
  panelOpen,
  onPanelToggle,
}: {
  query: string;
  onQueryChange: (next: string) => void;
  totalCount: number;
  panelOpen: boolean;
  onPanelToggle: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="ml-auto flex items-center gap-2">
        <Input
          search
          placeholder={`Search ${totalCount} ${totalCount === 1 ? "run" : "runs"}`}
          value={query}
          onChange={(e) => onQueryChange(e.currentTarget.value)}
          className="max-w-[240px]"
          wrapperClassName="hidden w-[240px] xl:block"
        />
        <button
          type="button"
          aria-label="Filter runs"
          title="Filter"
          className={TOOLBAR_ICON_BUTTON_CN}
        >
          <Filter className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Sort runs"
          title="Sort"
          className={TOOLBAR_ICON_BUTTON_CN}
        >
          <SlidersHorizontal className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Run analytics"
          title="Analytics"
          className={TOOLBAR_ICON_BUTTON_CN}
        >
          <BarChart3 className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={panelOpen ? "Hide side panel" : "Show side panel"}
          title={panelOpen ? "Hide side panel" : "Show side panel"}
          aria-pressed={panelOpen || undefined}
          data-active={panelOpen || undefined}
          onClick={onPanelToggle}
          className={cx(
            TOOLBAR_ICON_BUTTON_CN,
            "data-[active=true]:bg-l-wash-3 data-[active=true]:text-l-ink",
          )}
        >
          <PanelRight className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/* ── Grouped list ──────────────────────────────────────────── */

const MODE_ORDER: readonly BacktestJobMode[] = [
  "replay",
  "compare",
  "regression",
  "suite",
];

const MODE_META: Record<BacktestJobMode, { label: string; icon: BacktestJobIcon; ink: string }> = {
  replay: { label: "Replay", icon: "replay", ink: "text-event-teal" },
  compare: { label: "Compare", icon: "compare", ink: "text-event-violet" },
  regression: { label: "Regression", icon: "shield", ink: "text-event-amber" },
  suite: { label: "Suite", icon: "suite", ink: "text-event-violet" },
};

interface RunGroup {
  key: string;
  label: string;
  mode: BacktestJobMode;
  runs: readonly BacktestRunSummary[];
}

function groupRunsByMode(
  runs: readonly BacktestRunSummary[],
): readonly RunGroup[] {
  const buckets = new Map<BacktestJobMode, BacktestRunSummary[]>();
  for (const mode of MODE_ORDER) buckets.set(mode, []);
  for (const r of runs) buckets.get(r.mode)?.push(r);
  return MODE_ORDER.map((mode) => ({
    key: mode,
    label: MODE_META[mode].label,
    mode,
    runs: buckets.get(mode) ?? [],
  })).filter((g) => g.runs.length > 0);
}

interface GroupedRunsListProps {
  groups: readonly RunGroup[];
  collapsedGroups: readonly string[];
  onToggleGroup: (key: string) => void;
  onCreateInMode: (mode: BacktestJobMode) => void;
  onOpen: (run: BacktestRunSummary) => void;
  renderActions: (run: BacktestRunSummary) => React.ReactNode;
}

function GroupedRunsList({
  groups,
  collapsedGroups,
  onToggleGroup,
  onCreateInMode,
  onOpen,
  renderActions,
}: GroupedRunsListProps) {
  const collapsed = React.useMemo(() => new Set(collapsedGroups), [collapsedGroups]);

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden">
      <div className="chron-scrollbar-hidden flex h-full w-full flex-col gap-2 overflow-auto">
        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.key);
          const meta = MODE_META[group.mode];
          return (
            <section key={group.key} className="flex flex-col">
              <div className="flex h-9 items-center gap-2 rounded-md border border-transparent bg-l-wash-1 px-3 text-[13px] text-l-ink">
                <button
                  type="button"
                  aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${group.label}`}
                  aria-expanded={!isCollapsed}
                  onClick={() => onToggleGroup(group.key)}
                  className="flex size-5 items-center justify-center rounded-md text-l-ink-dim transition-[background-color,color] duration-fast hover:bg-l-wash-3 hover:text-l-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40"
                >
                  <ChevronDown
                    className={cx(
                      "size-3.5 transition-transform duration-fast",
                      isCollapsed ? "-rotate-90" : null,
                    )}
                    strokeWidth={1.75}
                  />
                </button>
                <span aria-hidden className={cx("inline-flex", meta.ink)}>
                  <JobIcon kind={meta.icon} className="size-3.5" />
                </span>
                <span className="font-medium">{group.label}</span>
                <span className="font-mono text-[11px] tabular-nums text-l-ink-dim">
                  {group.runs.length}
                </span>
                <Button
                  variant="icon"
                  size="sm"
                  aria-label={`Create ${group.label.toLowerCase()} backtest`}
                  className="ml-auto"
                  onPress={() => onCreateInMode(group.mode)}
                >
                  <Plus className="size-3.5" strokeWidth={1.75} />
                </Button>
              </div>

              {isCollapsed ? null : (
                <div className="flex flex-col">
                  {group.runs.map((run) => (
                    <BacktestLinearRow
                      key={run.id}
                      run={run}
                      onOpen={onOpen}
                      actionsSlot={renderActions(run)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* ── Linear-style row ─────────────────────────────────────── */

function BacktestLinearRow({
  run,
  onOpen,
  actionsSlot,
}: {
  run: BacktestRunSummary;
  onOpen: (run: BacktestRunSummary) => void;
  actionsSlot?: React.ReactNode;
}) {
  const issueId = toRunIssueId(run.id);
  const owner = run.owner ?? "unassigned";
  const ownerInitials = deriveInitials(owner);
  const envLabel = run.environmentLabel ?? "—";

  return (
    <div
      data-mode={run.mode}
      className={cx(
        "group relative isolate grid h-[46px] items-center gap-2 px-3",
        "grid-cols-[76px_minmax(220px,1.6fr)_minmax(120px,260px)_auto_32px_72px_28px]",
        "border-b border-l-border-faint last:border-b-0",
        "font-sans text-[13px] text-l-ink",
      )}
    >
      <button
        type="button"
        aria-label={`Open backtest ${run.name}`}
        onClick={() => onOpen(run)}
        className={cx(
          "absolute inset-0 z-0 rounded-[4px] transition-[background-color] duration-fast",
          "hover:bg-l-surface-hover",
          "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-ember",
        )}
      />

      <span className="pointer-events-none relative z-10 truncate font-mono text-[12px] tabular-nums text-l-ink-dim">
        {issueId}
      </span>

      <span className="pointer-events-none relative z-10 flex min-w-0 items-center gap-2">
        <span className="truncate font-medium text-l-ink">{run.name}</span>
        {typeof run.totalRuns === "number" ? (
          <span className="inline-flex h-5 shrink-0 items-center rounded-pill border border-l-border-faint bg-l-wash-1 px-1.5 font-mono text-[10.5px] tabular-nums text-l-ink-dim">
            {run.totalRuns.toLocaleString()}
          </span>
        ) : null}
        {typeof run.divergences === "number" && run.divergences > 0 ? (
          <span className="inline-flex h-5 shrink-0 items-center rounded-pill border border-l-border-faint bg-l-wash-1 px-1.5 font-mono text-[10.5px] tabular-nums text-l-ink-dim">
            {run.divergences} div
          </span>
        ) : null}
      </span>

      <span className="pointer-events-none relative z-10 flex min-w-0 justify-end">
        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-pill border border-l-border-faint bg-l-wash-1 px-2 py-1 text-l-ink-lo">
          <Server className="size-3 shrink-0" strokeWidth={1.75} />
          <span className="truncate">{envLabel}</span>
        </span>
      </span>

      <span className="pointer-events-none relative z-10 flex justify-end">
        <StatusCell status={run.status} />
      </span>

      <span className="pointer-events-none relative z-10 flex justify-end">
        <Avatar size="xs" tone={ownerTone(owner)} title={owner}>
          <AvatarFallback>{ownerInitials}</AvatarFallback>
        </Avatar>
      </span>

      <span className="pointer-events-none relative z-10 text-right font-mono text-[11.5px] tabular-nums text-l-ink-dim">
        {formatRunDate(run.updatedAt)}
      </span>

      <div
        className="relative z-10 flex items-center justify-end"
        onClick={(e) => e.stopPropagation()}
      >
        {actionsSlot ?? (
          <Button
            variant="icon"
            size="sm"
            aria-label={`Actions for ${run.name}`}
          >
            <MoreHorizontal className="size-4" strokeWidth={1.75} />
          </Button>
        )}
      </div>
    </div>
  );
}

const STATUS_TAG_VARIANT: Partial<Record<BacktestRunStatus, TagVariant>> = {
  scheduled: "violet",
  draft: "neutral",
  failed: "red",
  paused: "neutral",
};

function StatusCell({ status }: { status: BacktestRunStatus }) {
  if (status === "running") return <RunStatusPill tone="live" />;
  if (status === "done") return <RunStatusPill tone="done" />;
  const variant = STATUS_TAG_VARIANT[status] ?? "neutral";
  return (
    <Tag variant={variant} className="uppercase tracking-tactical">
      {status}
    </Tag>
  );
}

/* ── Actions menu ──────────────────────────────────────────── */

function RunActionsMenu({
  run,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  run: BacktestRunSummary;
  onOpen?: (run: BacktestRunSummary) => void;
  onDuplicate?: (run: BacktestRunSummary) => void;
  onDelete?: (run: BacktestRunSummary) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button
          variant="icon"
          size="sm"
          aria-label={`Actions for ${run.name}`}
        >
          <MoreHorizontal className="size-4" strokeWidth={1.75} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {onOpen ? (
          <DropdownMenuItem onAction={() => onOpen(run)}>Open</DropdownMenuItem>
        ) : null}
        {onDuplicate ? (
          <DropdownMenuItem onAction={() => onDuplicate(run)}>
            Duplicate
          </DropdownMenuItem>
        ) : null}
        {onDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem danger onAction={() => onDelete(run)}>
              Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Side panel (status breakdown) ─────────────────────────── */

function BacktestStatusPanel({
  runs,
  summary,
}: {
  runs: readonly BacktestRunSummary[];
  summary: RunsSummary;
}) {
  void runs;
  const items: { label: string; value: number; tone: string }[] = [
    { label: "Running", value: summary.running, tone: "text-event-green" },
    { label: "Scheduled", value: summary.scheduled, tone: "text-event-violet" },
    { label: "Done", value: summary.done, tone: "text-event-teal" },
    { label: "Drafts", value: summary.drafts, tone: "text-l-ink-dim" },
    { label: "Failed", value: summary.failed, tone: "text-event-red" },
  ];

  return (
    <aside className="hidden shrink-0 self-stretch overflow-hidden border-l border-l-border-faint bg-l-surface-bar p-3 xl:flex xl:w-[280px] xl:flex-col">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-sans text-[12.5px] font-medium text-l-ink-hi">
          Status breakdown
        </span>
        <span className="font-mono text-[11px] tabular-nums text-l-ink-dim">
          {summary.total} total
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex h-9 items-center gap-2 rounded-md px-2 text-[13px] text-l-ink-lo"
          >
            <span aria-hidden className={cx("size-1.5 rounded-full", item.tone)} style={{ background: "currentColor" }} />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <span className="font-mono text-[11px] tabular-nums text-l-ink-dim">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}

/* ── Empty / filtered-empty states ─────────────────────────── */

function EmptyState({
  onCreate,
}: {
  onCreate?: (preset: BacktestJobPreset) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-l-border-faint bg-l-wash-1 px-6 py-16 text-center">
      <h3 className="font-display text-[18px] leading-none tracking-[-0.02em] text-l-ink-hi">
        No backtest runs yet
      </h3>
      <p className="max-w-md text-[12.5px] text-l-ink-dim">
        Replay production traffic, compare candidate versions, or check for
        regressions. Pick a starting mode to begin configuring.
      </p>
      <NewBacktestMenu onPick={onCreate} />
    </div>
  );
}

function FilteredEmptyState({ onClearFilters }: { onClearFilters: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-l-border-faint bg-l-wash-1 px-6 py-12 text-center">
      <span className="font-sans text-[13px] text-l-ink-hi">
        No runs match this filter
      </span>
      <button
        type="button"
        onClick={onClearFilters}
        className="font-sans text-[12.5px] text-ember hover:underline"
      >
        clear search
      </button>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────────── */

function toRunIssueId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % 9973;
  }
  return `RUN-${String((hash % 999) + 1).padStart(3, "0")}`;
}

function formatRunDate(iso: string | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function ownerTone(owner: string): AvatarTone {
  const tones: AvatarTone[] = [
    "green",
    "teal",
    "violet",
    "amber",
    "pink",
    "ember",
  ];
  let hash = 0;
  for (let i = 0; i < owner.length; i += 1) {
    hash = (hash + owner.charCodeAt(i)) % tones.length;
  }
  return tones[hash] ?? "neutral";
}
