"use client";

import * as React from "react";
import { LayoutGrid, List, Plus } from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import { Chip } from "../primitives/chip";
import { Input } from "../primitives/input";
import { Kbd } from "../primitives/kbd";

import { DATASET_PURPOSE_META } from "./purpose-meta";
import type { DatasetPurpose } from "./types";

/*
 * DatasetsToolbar — controls strip above the dataset list/grid.
 *
 *   [ search ]   [chip · eval × ] [chip · training] …   [list/grid] [+ New]
 *
 * Mirrors `ConnectionsToolbar` in shape and density. Fully controlled
 * by the parent (`DatasetsManager`).
 */

export type DatasetsView = "list" | "grid";

export const DATASET_PURPOSE_FILTERS: readonly DatasetPurpose[] = [
  "eval",
  "training",
  "replay",
  "review",
];

export interface DatasetsToolbarProps {
  query: string;
  onQueryChange: (next: string) => void;
  /** Selected purpose filters. Empty = "show all". */
  selectedPurposes: readonly DatasetPurpose[];
  onPurposeToggle: (purpose: DatasetPurpose) => void;
  view: DatasetsView;
  onViewChange: (next: DatasetsView) => void;
  /** Total dataset count, rendered as a faint counter in the search placeholder. */
  totalCount?: number;
  /** Hide the primary "New dataset" CTA. */
  hideAdd?: boolean;
  onCreate?: () => void;
  className?: string;
}

export function DatasetsToolbar({
  query,
  onQueryChange,
  selectedPurposes,
  onPurposeToggle,
  view,
  onViewChange,
  totalCount,
  hideAdd,
  onCreate,
  className,
}: DatasetsToolbarProps) {
  const selectedSet = new Set(selectedPurposes);

  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-3 rounded-[2px] border border-l-border-faint bg-l-wash-1 px-3 py-2",
        className,
      )}
    >
      <div className="flex min-w-[220px] flex-1 items-center gap-2">
        <Input
          density="compact"
          search
          placeholder={
            totalCount != null
              ? `Search ${totalCount} datasets`
              : "Search datasets"
          }
          value={query}
          onChange={(e) => onQueryChange(e.currentTarget.value)}
          className="max-w-[320px]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {DATASET_PURPOSE_FILTERS.map((purpose) => {
          const meta = DATASET_PURPOSE_META[purpose];
          const active = selectedSet.has(purpose);
          return (
            <Chip
              key={purpose}
              active={active}
              density="compact"
              onClick={() => onPurposeToggle(purpose)}
              icon={
                <span
                  aria-hidden
                  className={cx("size-1.5 rounded-pill", meta.dot)}
                />
              }
            >
              {meta.label}
            </Chip>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-[2px] border border-l-border">
          <button
            type="button"
            aria-label="List view"
            aria-pressed={view === "list"}
            data-active={view === "list" || undefined}
            onClick={() => onViewChange("list")}
            className={cx(
              "flex h-7 w-7 items-center justify-center text-l-ink-dim",
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
              "flex h-7 w-7 items-center justify-center border-l border-l-border text-l-ink-dim",
              "hover:bg-l-surface-hover",
              "data-[active=true]:bg-l-wash-3 data-[active=true]:text-l-ink",
            )}
          >
            <LayoutGrid className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>
        {hideAdd ? null : (
          <Button
            density="compact"
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
