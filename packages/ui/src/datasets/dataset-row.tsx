"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import { formatNumber, RelativeTime } from "../connections/time";

import { DATASET_PURPOSE_META } from "./purpose-meta";
import type { Dataset } from "./types";

/*
 * DatasetRow — list-view row for a single dataset on the manager
 * page. Companion to `DatasetCard`. 36px tall, dense Linear grid.
 */

export interface DatasetRowProps {
  dataset: Dataset;
  onOpen?: (id: string) => void;
  /** Trailing render slot — the dataset actions dropdown. */
  actionsSlot?: React.ReactNode;
  isActive?: boolean;
  className?: string;
}

export function DatasetRow({
  dataset,
  onOpen,
  actionsSlot,
  isActive,
  className,
}: DatasetRowProps) {
  const meta = dataset.purpose ? DATASET_PURPOSE_META[dataset.purpose] : null;
  const PurposeIcon = meta?.Icon;

  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(dataset.id);
              }
            }
          : undefined
      }
      onClick={onOpen ? () => onOpen(dataset.id) : undefined}
      data-active={isActive || undefined}
      data-purpose={dataset.purpose ?? undefined}
      className={cx(
        "group relative grid items-center gap-3 px-3",
        "grid-cols-[28px_minmax(0,2fr)_minmax(0,1fr)_72px_72px_minmax(0,0.8fr)_28px]",
        "h-9 border-b border-l-border-faint last:border-b-0 first:rounded-t-[4px] last:rounded-b-[4px]",
        "font-sans text-[12.5px] text-l-ink",
        onOpen
          ? "cursor-pointer hover:bg-l-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40"
          : null,
        isActive
          ? "bg-l-surface-selected before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[2px] before:bg-ember"
          : null,
        className,
      )}
    >
      <span
        className={cx(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px]",
          meta?.tile ?? "bg-l-surface-input",
        )}
        aria-hidden
      >
        {PurposeIcon ? (
          <PurposeIcon
            className={cx("size-3.5", meta?.ink)}
            strokeWidth={1.6}
          />
        ) : (
          <span className="size-1.5 rounded-pill bg-l-ink-dim" />
        )}
      </span>

      <div className="flex min-w-0 flex-col gap-[1px]">
        <span className="truncate font-medium text-l-ink">
          {dataset.name}
        </span>
        {dataset.description ? (
          <span className="truncate text-[11px] text-l-ink-dim">
            {dataset.description}
          </span>
        ) : null}
      </div>

      <span className="flex min-w-0 items-center gap-1.5 truncate font-mono text-[11px] text-l-ink-dim">
        <span
          aria-hidden
          className={cx("size-1.5 shrink-0 rounded-pill", meta?.dot ?? "bg-l-ink-dim")}
        />
        <span className="truncate">{meta?.label ?? "Dataset"}</span>
        {dataset.tags && dataset.tags.length > 0 ? (
          <span className="truncate text-l-ink-dim">
            · {dataset.tags.slice(0, 2).join(", ")}
            {dataset.tags.length > 2 ? ` +${dataset.tags.length - 2}` : ""}
          </span>
        ) : null}
      </span>

      <span className="text-right font-mono text-[11px] text-l-ink-lo">
        {formatNumber(dataset.traceCount)}
      </span>

      <span className="text-right font-mono text-[11px] text-l-ink-lo">
        {dataset.eventCount != null ? formatNumber(dataset.eventCount) : "—"}
      </span>

      <span className="truncate font-mono text-[11px] text-l-ink-dim">
        {dataset.createdBy ? (
          <>
            {dataset.createdBy} · <RelativeTime iso={dataset.updatedAt ?? new Date(0).toISOString()} fallback="—" />
          </>
        ) : (
          <RelativeTime iso={dataset.updatedAt ?? new Date(0).toISOString()} fallback="—" />
        )}
      </span>

      <div
        className="flex items-center justify-end"
        onClick={(e) => e.stopPropagation()}
      >
        {actionsSlot ?? (
          <Button
            variant="icon"
            size="sm"
            aria-label={`Actions for ${dataset.name}`}
          >
            <MoreHorizontal className="size-4" strokeWidth={1.75} />
          </Button>
        )}
      </div>
    </div>
  );
}
