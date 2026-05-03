"use client";

import * as React from "react";
import { Hash, LayoutGrid, List } from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import { Chip } from "../primitives/chip";
import { Input } from "../primitives/input";

import type { AgentRunStatus } from "./types";

/*
 * AgentsToolbar — secondary control strip below the hero + KPI band:
 *
 *   [ search ]   [ group: Purpose · Framework · Flat ]   [list/grid]  [Hashes ↗]
 *
 * Health filters used to live here as primary chips. They have moved
 * up to the KPI strip (`AgentsKpiStrip`), where each health bucket
 * doubles as a click-to-filter tile. Framework grouping replaces the
 * old framework-as-a-chip pattern.
 */

export type AgentsView = "list" | "grid";

export type AgentHealthFilter = "healthy" | "drifting" | "errored";

export const AGENT_HEALTH_FILTERS: readonly AgentHealthFilter[] = [
  "healthy",
  "drifting",
  "errored",
];

export type AgentsGroupBy = "purpose" | "framework" | "flat";

export const AGENT_GROUP_BY_OPTIONS: readonly AgentsGroupBy[] = [
  "purpose",
  "framework",
  "flat",
];

const GROUP_BY_LABEL: Record<AgentsGroupBy, string> = {
  purpose: "Purpose",
  framework: "Framework",
  flat: "Flat",
};

export interface AgentsToolbarProps {
  query: string;
  onQueryChange: (next: string) => void;
  view: AgentsView;
  onViewChange: (next: AgentsView) => void;
  groupBy: AgentsGroupBy;
  onGroupByChange: (next: AgentsGroupBy) => void;
  totalCount?: number;
  onOpenHashSearch?: () => void;
  className?: string;
}

export function AgentsToolbar({
  query,
  onQueryChange,
  view,
  onViewChange,
  groupBy,
  onGroupByChange,
  totalCount,
  onOpenHashSearch,
  className,
}: AgentsToolbarProps) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-3 rounded-[2px] border border-l-border-faint bg-l-wash-1 px-3 py-2",
        className,
      )}
    >
      <div className="flex min-w-[220px] flex-1 items-center gap-2">
        <Input
          type="search"
          search
          aria-label="Search agents"
          placeholder={
            totalCount != null
              ? `Search ${totalCount} agents`
              : "Search agents"
          }
          value={query}
          onChange={(e) => onQueryChange(e.currentTarget.value)}
          className="max-w-[320px]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span
          aria-hidden
          className="font-sans text-[11px] text-l-ink-dim"
        >
          Group by
        </span>
        {AGENT_GROUP_BY_OPTIONS.map((option) => (
          <Chip
            key={option}
            active={groupBy === option}
            onClick={() => onGroupByChange(option)}
          >
            {GROUP_BY_LABEL[option]}
          </Chip>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div
          className="inline-flex overflow-hidden rounded-[2px] border border-hairline-strong"
          role="group"
          aria-label="Layout"
        >
          <button
            type="button"
            aria-label="List view"
            aria-pressed={view === "list"}
            data-active={view === "list" || undefined}
            onClick={() => onViewChange("list")}
            className={cx(
              "flex h-7 w-7 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 items-center justify-center text-l-ink-dim touch-manipulation",
              "transition-colors duration-fast",
              "hover:bg-l-surface-hover",
              "data-[active=true]:bg-l-wash-3 data-[active=true]:text-l-ink",
            )}
          >
            <List className="size-3.5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            data-active={view === "grid" || undefined}
            onClick={() => onViewChange("grid")}
            className={cx(
              "flex h-7 w-7 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 items-center justify-center border-l border-hairline-strong text-l-ink-dim touch-manipulation",
              "transition-colors duration-fast",
              "hover:bg-l-surface-hover",
              "data-[active=true]:bg-l-wash-3 data-[active=true]:text-l-ink",
            )}
          >
            <LayoutGrid className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>
        {onOpenHashSearch ? (
          <Button
            variant="secondary"
            size="sm"
            onPress={onOpenHashSearch}
            leadingIcon={<Hash className="size-3.5" strokeWidth={1.75} />}
          >
            Hash search
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/* Helper: classify an agent against the health filters. */
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

// Re-export RunStatus to avoid the chip needing its own import.
export type { AgentRunStatus };
