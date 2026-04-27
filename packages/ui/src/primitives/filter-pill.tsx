"use client";

import * as React from "react";
import { cx } from "../utils/cx";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

/**
 * FilterPill — Linear-style applied-filter pill.
 *
 *   [ icon | dimension ]  is  [ value ]  ×
 *
 * Three click targets, three callbacks:
 *   - clicking the dimension or value re-opens the dim's option list
 *     (via `onEditDim` / `onEditValue`)
 *   - clicking × clears the filter (via `onRemove`)
 *
 * Reach for this in `FilterBar` (Phase 4) above lists and timelines.
 * For one-shot dropdown triggers without an applied value, use `<Chip>`.
 */
export interface FilterPillProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onChange"
> {
  icon?: React.ReactNode;
  dimension: React.ReactNode;
  /** "is" / "is not" / "in" — defaults to "is". */
  verb?: React.ReactNode;
  value: React.ReactNode;
  onEditDim?: () => void;
  onEditValue?: () => void;
  onRemove?: () => void;
  /** Force a density flavor. Defaults to whichever the surrounding
   * `ChromeStyleProvider` resolves to. */
  density?: "compact" | "brand";
}

const RemoveX = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

const baseSegment =
  "inline-flex items-center px-[7px] gap-[5px] cursor-pointer " +
  "transition-colors duration-fast";

export function FilterPill({
  icon,
  dimension,
  verb = "is",
  value,
  onEditDim,
  onEditValue,
  onRemove,
  className,
  density: densityProp,
  ...props
}: FilterPillProps) {
  const density = useResolvedChromeDensity(densityProp);
  const isBrand = density === "brand";
  return (
    <div
      data-component="filter-pill"
      data-density={density}
      className={cx(
        "inline-flex items-stretch select-none overflow-hidden border",
        isBrand
          ? "h-[26px] text-mono text-ink rounded-xs border-hairline-strong bg-surface-01 [&>span+span]:border-l [&>span+span]:border-hairline"
          : "h-[22px] text-[11.5px] text-l-ink rounded-[4px] border-l-border bg-l-wash-2 [&>span+span]:border-l [&>span+span]:border-l-border",
        className
      )}
      {...props}
    >
      <span
        className={cx(
          baseSegment,
          isBrand
            ? "font-mono uppercase tracking-tactical text-ink-lo hover:bg-surface-02 hover:text-ink-hi"
            : "text-l-ink-lo hover:bg-l-wash-3 hover:text-l-ink"
        )}
        onClick={onEditDim}
      >
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <span>{dimension}</span>
      </span>
      <span
        className={cx(
          "inline-flex items-center cursor-default",
          isBrand
            ? "px-[6px] font-mono text-mono-sm uppercase tracking-tactical text-ink-dim"
            : "px-[6px] font-mono text-[10.5px] text-l-ink-dim"
        )}
      >
        {verb}
      </span>
      <span
        className={cx(
          baseSegment,
          isBrand
            ? "font-mono text-ink hover:bg-surface-02"
            : "font-medium text-l-ink hover:bg-l-wash-3"
        )}
        onClick={onEditValue}
      >
        {value}
      </span>
      {onRemove ? (
        <span
          role="button"
          tabIndex={-1}
          aria-label="Remove filter"
          className={cx(
            "inline-flex items-center px-[5px] cursor-pointer",
            isBrand
              ? "text-ink-dim hover:bg-[rgba(239,68,68,0.12)] hover:text-event-red"
              : "text-l-ink-dim hover:bg-[rgba(239,68,68,0.12)] hover:text-event-red"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <RemoveX />
        </span>
      ) : null}
    </div>
  );
}
