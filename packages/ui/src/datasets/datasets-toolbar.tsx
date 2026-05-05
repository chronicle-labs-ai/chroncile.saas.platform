"use client";

import * as React from "react";
import {
  BarChart3,
  Filter,
  LayoutGrid,
  List,
  PanelRight,
  Plus,
  SlidersHorizontal,
} from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import { Input } from "../primitives/input";
import { Kbd } from "../primitives/kbd";

import type { DatasetPurpose } from "./types";

/** Shared chrome for the toolbar's 32×32 icon buttons. Mirrors the
 *  dataset detail toolbar so the two surfaces feel like the same
 *  product. */
const TOOLBAR_ICON_BUTTON_CN = cx(
  "relative inline-flex size-8 shrink-0 items-center justify-center rounded-[10px]",
  "border border-l-border-faint bg-l-wash-1 text-l-ink-lo",
  "transition-colors duration-fast ease-out motion-reduce:transition-none",
  "hover:bg-l-wash-3 hover:text-l-ink",
  "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
  "disabled:cursor-not-allowed disabled:opacity-40"
);

/*
 * DatasetsToolbar — controls strip above the dataset list/grid.
 *
 *   [ search ]   [filter] [sort] [analytics] [panel] [list/grid] [+ New]
 *
 * Filter chips (scope + purpose) live in the rail / facet sidebar; the
 * toolbar is reserved for global controls. Fully controlled by the
 * parent (`DatasetsManager`).
 */

export type DatasetsView = "list" | "grid";
export type DatasetsScope = "all" | "active" | "empty";

export const DATASET_SCOPE_FILTERS: readonly {
  value: DatasetsScope;
  label: string;
}[] = [
  { value: "all", label: "All datasets" },
  { value: "active", label: "Active" },
  { value: "empty", label: "Empty" },
];

export const DATASET_PURPOSE_FILTERS: readonly DatasetPurpose[] = [
  "eval",
  "training",
  "replay",
  "review",
];

export interface DatasetsToolbarProps {
  query: string;
  onQueryChange: (next: string) => void;
  /** Selected purpose filters. Empty = "show all". The toolbar no
   *  longer renders purpose chips, but the prop is kept so the rail
   *  and stats panel can stay in sync via the manager's state. */
  selectedPurposes?: readonly DatasetPurpose[];
  onPurposeToggle?: (purpose: DatasetPurpose) => void;
  /** Primary scope filter. Defaults to all. The toolbar no longer
   *  renders the scope chip group; kept for parent-level filtering. */
  selectedScope?: DatasetsScope;
  onScopeChange?: (scope: DatasetsScope) => void;
  view: DatasetsView;
  onViewChange: (next: DatasetsView) => void;
  /** Total dataset count, rendered as a faint counter in the search placeholder. */
  totalCount?: number;
  /** Hide the primary "New dataset" CTA. */
  hideAdd?: boolean;
  onCreate?: () => void;
  /** Whether the analytics rail is currently open. The button reflects
   *  this with a pressed surface and `aria-pressed`. */
  analyticsActive?: boolean;
  /** Fired when the user toggles the analytics rail. */
  onAnalyticsToggle?: () => void;
  /** Whether the right side panel (facets / stats rail) is currently
   *  visible. The toggle button reflects this with a pressed surface. */
  panelOpen?: boolean;
  /** Fired when the user toggles the side panel visibility. */
  onPanelToggle?: () => void;
  className?: string;
}

export function DatasetsToolbar({
  query,
  onQueryChange,
  view,
  onViewChange,
  totalCount,
  hideAdd,
  onCreate,
  analyticsActive,
  onAnalyticsToggle,
  panelOpen,
  onPanelToggle,
  className,
}: DatasetsToolbarProps) {
  return (
    <div className={cx("flex flex-wrap items-center gap-2", className)}>
      <div className="ml-auto flex items-center gap-2">
        <Input
          search
          placeholder={
            totalCount != null
              ? `Search ${totalCount} datasets`
              : "Search datasets"
          }
          value={query}
          onChange={(e) => onQueryChange(e.currentTarget.value)}
          className="max-w-[240px]"
          wrapperClassName="hidden w-[240px] xl:block"
        />
        <button
          type="button"
          aria-label="Filter datasets"
          title="Filter"
          className={TOOLBAR_ICON_BUTTON_CN}
        >
          <Filter className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Sort datasets"
          title="Sort"
          className={TOOLBAR_ICON_BUTTON_CN}
        >
          <SlidersHorizontal className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Dataset analytics"
          title="Analytics"
          aria-pressed={analyticsActive ?? undefined}
          data-active={analyticsActive || undefined}
          onClick={onAnalyticsToggle}
          className={cx(
            TOOLBAR_ICON_BUTTON_CN,
            "data-[active=true]:bg-l-wash-3 data-[active=true]:text-l-ink"
          )}
        >
          <BarChart3 className="size-4" strokeWidth={1.75} aria-hidden />
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
        <div className="inline-flex overflow-hidden rounded-[2px] border border-hairline-strong">
          <button
            type="button"
            aria-label="List view"
            aria-pressed={view === "list"}
            data-active={view === "list" || undefined}
            onClick={() => onViewChange("list")}
            className={cx(
              "flex h-7 w-7 items-center justify-center text-l-ink-dim",
              "hover:bg-l-surface-hover",
              "data-[active=true]:bg-l-wash-3 data-[active=true]:text-l-ink"
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
              "flex h-7 w-7 items-center justify-center border-l border-hairline-strong text-l-ink-dim",
              "hover:bg-l-surface-hover",
              "data-[active=true]:bg-l-wash-3 data-[active=true]:text-l-ink"
            )}
          >
            <LayoutGrid className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>
        {hideAdd ? null : (
          <Button
            variant="primary"
            size="sm"
            onPress={onCreate}
            leadingIcon={<Plus className="size-3.5" strokeWidth={1.75} />}
            trailingIcon={<Kbd size="sm">N</Kbd>}
          >
            New dataset
          </Button>
        )}
      </div>
    </div>
  );
}
