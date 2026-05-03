"use client";

import * as React from "react";
import { LayoutGrid, List, Plus } from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import { Chip } from "../primitives/chip";
import { Input } from "../primitives/input";
import { CONNECTION_HEALTH_FILTERS, type ConnectionHealth } from "./data";
import { ConnectionHealthBadge } from "./connection-health-badge";

/*
 * ConnectionsToolbar — controls strip above the connection list/grid.
 *
 *   [ search ]   [chip · live × ] [chip · paused] …   [list/grid] [+ Add]
 *
 * Presentational + uncontrolled-friendly. State (query, filters,
 * view) is owned by the consumer (`ConnectionsManager`); this is
 * just the shaped controls.
 */

export type ConnectionsView = "list" | "grid";

export interface ConnectionsToolbarProps {
  query: string;
  onQueryChange: (next: string) => void;
  /** Selected health filters. Empty = "show all". */
  selectedHealth: readonly ConnectionHealth[];
  onHealthToggle: (health: ConnectionHealth) => void;
  view: ConnectionsView;
  onViewChange: (next: ConnectionsView) => void;
  /** Hide the primary "Add connection" CTA. */
  hideAdd?: boolean;
  onAdd?: () => void;
  /** Total connection count, rendered as a faint counter next to search. */
  totalCount?: number;
  className?: string;
}

export function ConnectionsToolbar({
  query,
  onQueryChange,
  selectedHealth,
  onHealthToggle,
  view,
  onViewChange,
  hideAdd,
  onAdd,
  totalCount,
  className,
}: ConnectionsToolbarProps) {
  const selectedSet = new Set(selectedHealth);
  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-3 rounded-[2px] border border-divider bg-[rgba(255,255,255,0.012)] px-3 py-2",
        className,
      )}
    >
      <div className="flex min-w-[220px] flex-1 items-center gap-2">
        <Input
          search
          placeholder={
            totalCount != null
              ? `Search ${totalCount} connections`
              : "Search connections"
          }
          value={query}
          onChange={(e) => onQueryChange(e.currentTarget.value)}
          className="max-w-[320px]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {CONNECTION_HEALTH_FILTERS.map((h) => {
          const active = selectedSet.has(h);
          return (
            <Chip
              key={h}
              active={active}
              onClick={() => onHealthToggle(h)}
              icon={<ConnectionHealthBadge health={h} iconOnly />}
            >
              {capitalize(h)}
            </Chip>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-[2px] border border-divider">
          <button
            type="button"
            aria-label="List view"
            aria-pressed={view === "list"}
            data-active={view === "list" || undefined}
            onClick={() => onViewChange("list")}
            className={cx(
              "flex h-7 w-7 items-center justify-center text-ink-dim",
              "hover:bg-[rgba(255,255,255,0.025)]",
              "data-[active=true]:bg-[rgba(255,255,255,0.04)] data-[active=true]:text-ink-hi",
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
              "flex h-7 w-7 items-center justify-center border-l border-divider text-ink-dim",
              "hover:bg-[rgba(255,255,255,0.025)]",
              "data-[active=true]:bg-[rgba(255,255,255,0.04)] data-[active=true]:text-ink-hi",
            )}
          >
            <LayoutGrid className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>
        {!hideAdd ? (
          <Button
            variant="primary"
            size="sm"
            onPress={onAdd}
            leadingIcon={<Plus className="size-3.5" strokeWidth={1.75} />}
          >
            Add connection
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
