"use client";

import * as React from "react";
import { Filter, Hash, PanelRight } from "lucide-react";

import { cx } from "../utils/cx";
import { Input } from "../primitives/input";

import type { AgentRunStatus } from "./types";

/*
 * AgentsToolbar — calm controls strip above the grouped Linear-style
 * agent list:
 *
 *   [ search ]   [filter] [panel] [Hashes]
 *
 * Scope (`all` · `active` · `idle`) lives on the toolbar via the
 * `selectedScope` prop; the chips themselves render in the facet rail
 * to keep the toolbar visually quiet — the toolbar exposes the state
 * so the manager can wire one ↔ the other.
 *
 * Mirrors `DatasetsToolbar` so both surfaces feel like the same
 * product. KPI strip + grid view + group-by chips were retired to cut
 * the tab's noise: health rolls into a single dot in the row, and
 * grouping is fixed (framework/category) inside the manager.
 */

const TOOLBAR_ICON_BUTTON_CN = cx(
  "relative inline-flex size-8 shrink-0 items-center justify-center rounded-[10px]",
  "border border-l-border-faint bg-l-wash-1 text-l-ink-lo",
  "transition-colors duration-fast ease-out motion-reduce:transition-none",
  "hover:bg-l-wash-3 hover:text-l-ink",
  "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
  "disabled:cursor-not-allowed disabled:opacity-40"
);

export type AgentsScope = "all" | "active" | "idle";

export const AGENT_SCOPE_FILTERS: readonly {
  value: AgentsScope;
  label: string;
}[] = [
  { value: "all", label: "All agents" },
  { value: "active", label: "Active" },
  { value: "idle", label: "Idle" },
];

/* Health tags retained as a typed surface for the row's status dot.
 * Filtering is no longer chip-based — it's facet-rail driven. */
export type AgentHealthFilter = "healthy" | "drifting" | "errored";

export const AGENT_HEALTH_FILTERS: readonly AgentHealthFilter[] = [
  "healthy",
  "drifting",
  "errored",
];

export interface AgentsToolbarProps {
  query: string;
  onQueryChange: (next: string) => void;
  /** Selected scope. Kept for parent-level filtering; the toolbar
   *  itself doesn't render scope chips (they live in the facet rail). */
  selectedScope?: AgentsScope;
  onScopeChange?: (scope: AgentsScope) => void;
  /** Total agent count rendered as a faint counter in the search
   *  placeholder (e.g. "Search 18 agents"). */
  totalCount?: number;
  /** Whether the right-side facet panel is currently visible. */
  panelOpen?: boolean;
  onPanelToggle?: () => void;
  /** Optional jump-out for the global hash search surface. */
  onOpenHashSearch?: () => void;
  className?: string;
}

export function AgentsToolbar({
  query,
  onQueryChange,
  totalCount,
  panelOpen,
  onPanelToggle,
  onOpenHashSearch,
  className,
}: AgentsToolbarProps) {
  return (
    <div className={cx("flex flex-wrap items-center gap-2", className)}>
      <div className="ml-auto flex items-center gap-2">
        <Input
          search
          placeholder={
            totalCount != null
              ? `Search ${totalCount} agents`
              : "Search agents"
          }
          value={query}
          onChange={(e) => onQueryChange(e.currentTarget.value)}
          className="max-w-[240px]"
          wrapperClassName="hidden w-[240px] xl:block"
        />
        <button
          type="button"
          aria-label="Filter agents"
          title="Filter"
          className={TOOLBAR_ICON_BUTTON_CN}
        >
          <Filter className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={panelOpen ? "Hide side panel" : "Show side panel"}
          title={panelOpen ? "Hide side panel" : "Show side panel"}
          aria-pressed={panelOpen ?? undefined}
          data-active={panelOpen || undefined}
          onClick={onPanelToggle}
          className={cx(
            TOOLBAR_ICON_BUTTON_CN,
            "data-[active=true]:bg-l-wash-3 data-[active=true]:text-l-ink"
          )}
        >
          <PanelRight className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
        {onOpenHashSearch ? (
          <button
            type="button"
            aria-label="Open hash search"
            title="Hash search"
            onClick={onOpenHashSearch}
            className={TOOLBAR_ICON_BUTTON_CN}
          >
            <Hash className="size-4" strokeWidth={1.75} aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* Health classifier — used by the row's status dot and the facet
 * rail. The toolbar no longer renders chips for these, but consumers
 * (KPI strip, drift timeline) still rely on the predicate. */
export function matchesHealthFilter(
  agent: {
    successRate: number;
    totalRuns: number;
    lastDriftAt?: string;
    recentErrorAt?: string;
  },
  filter: AgentHealthFilter,
): boolean {
  switch (filter) {
    case "healthy":
      return agent.totalRuns > 0 && agent.successRate >= 0.95;
    case "drifting":
      return Boolean(agent.lastDriftAt);
    case "errored":
      return agent.totalRuns > 0 && agent.successRate < 0.95;
  }
}

/* Re-export `AgentRunStatus` to avoid downstream needing its own
 * import path. Mirrors the historical surface. */
export type { AgentRunStatus };
