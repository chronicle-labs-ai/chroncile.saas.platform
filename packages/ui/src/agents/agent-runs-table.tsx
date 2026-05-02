"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import { Chip } from "../primitives/chip";
import { Input } from "../primitives/input";

import { AgentRunRow } from "./agent-run-row";
import type {
  AgentRun,
  AgentRunStatus,
  AgentVersionSummary,
} from "./types";

/*
 * AgentRunsTable — list of runs across every version of one agent.
 * Two modes:
 *
 *   density="default" — full table with column header + filter bar
 *                        (used inside the Runs tab)
 *   density="compact" — header-less, used in the Overview tab as a
 *                        scoped "recent runs" widget
 *
 * Filters: status (success/error), version chip per known artifact.
 * Search: free-text over runId, modelId, trace.userId, trace.environment.
 *
 * Per-row drilldown is opt-in: pass `onSelectRun` to make rows
 * click-to-open the drawer.
 */

export interface AgentRunsTableProps {
  runs: readonly AgentRun[];
  versions: readonly AgentVersionSummary[];
  selectedRunId: string | null;
  onSelectRun: (runId: string | null) => void;
  density?: "compact" | "default";
  hideHeader?: boolean;
  className?: string;
}

const STATUS_FILTERS: readonly AgentRunStatus[] = [
  "success",
  "error",
  "started",
];

const STATUS_LABEL: Record<AgentRunStatus, string> = {
  success: "Success",
  error: "Errored",
  started: "Live",
};

const STATUS_DOT: Record<AgentRunStatus, string> = {
  success: "bg-event-green",
  error: "bg-event-red",
  started: "bg-event-amber",
};

export function AgentRunsTable({
  runs,
  versions,
  selectedRunId,
  onSelectRun,
  density = "default",
  hideHeader,
  className,
}: AgentRunsTableProps) {
  const [query, setQuery] = React.useState("");
  const [statusFilters, setStatusFilters] = React.useState<AgentRunStatus[]>([]);
  const [versionFilters, setVersionFilters] = React.useState<string[]>([]);

  const toggleStatus = (s: AgentRunStatus) =>
    setStatusFilters((cur) =>
      cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
    );
  const toggleVersion = (v: string) =>
    setVersionFilters((cur) =>
      cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return runs.filter((run) => {
      if (statusFilters.length > 0 && !statusFilters.includes(run.status)) {
        return false;
      }
      if (versionFilters.length > 0) {
        const version = run.artifactId.split("@")[1] ?? run.artifactId;
        if (!versionFilters.includes(version)) return false;
      }
      if (!q) return true;
      const haystack = `${run.runId} ${run.artifactId} ${run.response?.modelId ?? ""} ${
        run.trace?.userId ?? ""
      } ${run.trace?.environment ?? ""}`;
      return haystack.toLowerCase().includes(q);
    });
  }, [runs, query, statusFilters, versionFilters]);

  return (
    <div className={cx("flex flex-col gap-3", className)}>
      {hideHeader ? null : (
        <div className="flex flex-wrap items-center gap-2 rounded-[2px] border border-l-border-faint bg-l-wash-1 px-3 py-2">
          <Input
            density="compact"
            search
            placeholder="Search runs"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            className="max-w-[240px]"
          />
          <div className="flex items-center gap-1.5">
            {STATUS_FILTERS.map((s) => (
              <Chip
                key={s}
                density="compact"
                active={statusFilters.includes(s)}
                onClick={() => toggleStatus(s)}
                icon={
                  <span
                    aria-hidden
                    className={cx("size-1.5 rounded-pill", STATUS_DOT[s])}
                  />
                }
              >
                {STATUS_LABEL[s]}
              </Chip>
            ))}
          </div>
          {versions.length > 1 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {versions.map((v) => (
                <Chip
                  key={v.artifact.version}
                  density="compact"
                  active={versionFilters.includes(v.artifact.version)}
                  onClick={() => toggleVersion(v.artifact.version)}
                >
                  v{v.artifact.version}
                </Chip>
              ))}
            </div>
          ) : null}
          <span className="ml-auto font-sans text-[11px] text-l-ink-dim">
            {filtered.length} of {runs.length}
          </span>
        </div>
      )}

      <div className="rounded-[4px] border border-l-border bg-l-surface-raised">
        {!hideHeader && density === "default" ? (
          <div
            className={cx(
              "grid items-center gap-3 border-b border-l-border-faint bg-l-surface-input/40 px-4 py-1.5",
              "grid-cols-[16px_minmax(0,76px)_minmax(0,90px)_minmax(0,80px)_minmax(0,80px)_minmax(0,1fr)_minmax(0,140px)]",
              "font-sans text-[11px] text-l-ink-dim",
            )}
          >
            <span aria-hidden />
            <span>Started</span>
            <span>Version</span>
            <span>Op</span>
            <span className="text-right">Duration</span>
            <span>Tokens</span>
            <span className="text-right">User · Env</span>
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center font-sans text-[12px] text-l-ink-dim">
            No runs match.
          </div>
        ) : (
          filtered.map((run) => (
            <AgentRunRow
              key={run.runId}
              run={run}
              isActive={selectedRunId === run.runId}
              onSelect={onSelect}
              density={density}
            />
          ))
        )}
      </div>
    </div>
  );

  function onSelect(runId: string) {
    onSelectRun(selectedRunId === runId ? null : runId);
  }
}
