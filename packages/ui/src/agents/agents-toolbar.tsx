"use client";

import * as React from "react";
import { Hash, LayoutGrid, List } from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import { Chip } from "../primitives/chip";
import { Input } from "../primitives/input";

import type { AgentRunStatus } from "./types";

/*
 * AgentsToolbar — controls strip above the agents list/grid.
 *
 *   [ search ]   [chip · healthy] [chip · drifting] [chip · errored] …   [list/grid]  [Hashes ↗]
 *
 * Health chips filter on the manager's roll-up:
 *
 *   - "healthy"   → success rate ≥ 95%
 *   - "drifting"  → resolved-modelId differs from declared modelId
 *   - "errored"   → at least one error in the last 24h
 *
 * Framework is NOT exposed as a primary filter (per the design plan):
 *   it stays on the badge inside each row.
 */

export type AgentsView = "list" | "grid";

export type AgentHealthFilter = "healthy" | "drifting" | "errored";

export const AGENT_HEALTH_FILTERS: readonly AgentHealthFilter[] = [
  "healthy",
  "drifting",
  "errored",
];

const HEALTH_META: Record<
  AgentHealthFilter,
  { label: string; dot: string }
> = {
  healthy: { label: "Healthy", dot: "bg-event-green" },
  drifting: { label: "Drifting", dot: "bg-event-amber" },
  errored: { label: "Recent errors", dot: "bg-event-red" },
};

export interface AgentsToolbarProps {
  query: string;
  onQueryChange: (next: string) => void;
  selectedHealth: readonly AgentHealthFilter[];
  onHealthToggle: (health: AgentHealthFilter) => void;
  view: AgentsView;
  onViewChange: (next: AgentsView) => void;
  totalCount?: number;
  onOpenHashSearch?: () => void;
  className?: string;
}

export function AgentsToolbar({
  query,
  onQueryChange,
  selectedHealth,
  onHealthToggle,
  view,
  onViewChange,
  totalCount,
  onOpenHashSearch,
  className,
}: AgentsToolbarProps) {
  const selectedSet = new Set(selectedHealth);

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
        {AGENT_HEALTH_FILTERS.map((health) => {
          const meta = HEALTH_META[health];
          const active = selectedSet.has(health);
          return (
            <Chip
              key={health}
              active={active}
              onClick={() => onHealthToggle(health)}
              icon={
                <span aria-hidden className={cx("size-1.5 rounded-pill", meta.dot)} />
              }
            >
              {meta.label}
            </Chip>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-[2px] border border-hairline-strong">
          <button
            type="button"
            aria-label="List view"
            aria-pressed={view === "list"}
            data-active={view === "list" || undefined}
            onClick={() => onViewChange("list")}
            className={cx(
              "flex h-7 w-7 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 items-center justify-center text-l-ink-dim touch-manipulation",
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
