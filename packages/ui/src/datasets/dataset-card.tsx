"use client";

import * as React from "react";
import { MoreHorizontal, Tag as TagIcon } from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import { formatNumber, RelativeTime } from "../connections/time";

import { DATASET_PURPOSE_META } from "./purpose-meta";
import type { Dataset } from "./types";

/*
 * DatasetCard — grid-view tile for a single dataset on the manager
 * page. Companion to `DatasetRow` (list view).
 *
 * Linear-density: no drop shadow, 1px hairline, 4px radius. The
 * leading icon tile is colored by `purpose` via `DATASET_PURPOSE_META`.
 *
 * The actions trigger renders the lucide `MoreHorizontal` glyph but
 * the dropdown menu itself is owned by the parent
 * (`DatasetActionsMenu`, lands in the CRUD phase) — so this card is
 * pure presentation.
 */

export interface DatasetCardProps {
  dataset: Dataset;
  /** Click handler for the card chrome (not the actions slot). */
  onOpen?: (id: string) => void;
  /** Trailing render slot — the dataset actions dropdown. When
   *  omitted, falls back to a no-op icon button so the card still
   *  reads as actionable. */
  actionsSlot?: React.ReactNode;
  /** Active selection tone. */
  isActive?: boolean;
  className?: string;
}

export function DatasetCard({
  dataset,
  onOpen,
  actionsSlot,
  isActive,
  className,
}: DatasetCardProps) {
  const purpose = dataset.purpose;
  const meta = purpose ? DATASET_PURPOSE_META[purpose] : null;
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
      data-purpose={purpose ?? undefined}
      className={cx(
        "group relative flex flex-col gap-3 rounded-[4px] border border-l-border bg-l-surface-raised p-3.5",
        "transition-colors duration-fast",
        onOpen
          ? "cursor-pointer hover:bg-l-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40"
          : null,
        isActive
          ? "border-ember/45 bg-l-surface-selected"
          : null,
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cx(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px]",
            meta?.tile ?? "bg-l-surface-input",
          )}
          aria-hidden
        >
          {PurposeIcon ? (
            <PurposeIcon
              className={cx("size-4", meta?.ink)}
              strokeWidth={1.6}
            />
          ) : (
            <span className="size-1.5 rounded-pill bg-l-ink-dim" />
          )}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <span className="truncate font-sans text-[14px] font-medium text-l-ink">
            {dataset.name}
          </span>
          <span className="flex items-center gap-1.5 truncate font-mono text-[10.5px] text-l-ink-dim">
            <span className={cx("size-1.5 rounded-pill", meta?.dot ?? "bg-l-ink-dim")} aria-hidden />
            {meta?.label ?? "Dataset"}
            {dataset.createdBy ? (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{dataset.createdBy}</span>
              </>
            ) : null}
          </span>
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          {actionsSlot ?? (
            <Button
              density="compact"
              variant="icon"
              size="sm"
              aria-label={`Actions for ${dataset.name}`}
            >
              <MoreHorizontal className="size-4" strokeWidth={1.75} />
            </Button>
          )}
        </div>
      </div>

      {dataset.description ? (
        <p className="line-clamp-2 font-sans text-[12.5px] leading-snug text-l-ink-lo">
          {dataset.description}
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-2">
        <Stat
          label="Traces"
          value={formatNumber(dataset.traceCount)}
        />
        <Stat
          label="Events"
          value={
            dataset.eventCount != null ? formatNumber(dataset.eventCount) : "—"
          }
        />
      </dl>

      <div className="mt-auto flex items-center justify-between gap-2 text-[11px] text-l-ink-dim">
        <span className="flex flex-1 items-center gap-1.5 overflow-hidden">
          {dataset.tags && dataset.tags.length > 0 ? (
            <>
              <TagIcon className="size-3 shrink-0" strokeWidth={1.75} />
              <span className="truncate font-mono">
                {dataset.tags.slice(0, 3).join(", ")}
                {dataset.tags.length > 3
                  ? ` +${dataset.tags.length - 3}`
                  : ""}
              </span>
            </>
          ) : (
            <span className="font-mono">untagged</span>
          )}
        </span>
        <span className="font-mono">
          <RelativeTime
            iso={dataset.updatedAt ?? new Date(0).toISOString()}
            fallback="—"
          />
        </span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[2px]">
      <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-l-ink-dim">
        {label}
      </dt>
      <dd className="font-sans text-[14px] font-medium text-l-ink">
        {value}
      </dd>
    </div>
  );
}
