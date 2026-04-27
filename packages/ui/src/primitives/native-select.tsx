"use client";

/*
 * NativeSelect is the previous `Select` implementation preserved for
 * back-compat: a styled `<select>` with `<option>` children. Use this for
 * quick forms that don't need search/typeahead/custom rendering. For
 * anything richer, use the RAC-based `Select` compound in `./select`.
 */

import * as React from "react";
import { cx } from "../utils/cx";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

export interface NativeSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  variant?: "default" | "auth";
  /** `"compact"` Linear-density (28 px) or `"brand"` mono input. */
  density?: "compact" | "brand";
}

export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  NativeSelectProps
>(function NativeSelect(
  { invalid = false, variant = "default", density: densityProp, className, children, ...props },
  ref
) {
  const density = useResolvedChromeDensity(densityProp);
  const isCompact = density === "compact";
  return (
    <div className="relative" data-density={density}>
      <select
        ref={ref}
        className={cx(
          "w-full appearance-none border transition-colors duration-fast ease-out focus:outline-none",
          isCompact
            ? "h-[28px] rounded-l bg-l-surface-input px-[10px] pr-[28px] font-sans text-[13px] leading-none text-l-ink"
            : "rounded-sm bg-surface-00 px-s-3 py-s-2 pr-[32px] font-mono text-mono-lg text-ink",
          variant === "auth"
            ? "bg-transparent border-hairline-strong text-ink-hi focus:border-ink-hi"
            : invalid
              ? "border-event-red focus:border-event-red"
              : isCompact
                ? "border-l-border hover:border-l-border-strong focus:border-[rgba(216,67,10,0.5)]"
                : "border-hairline-strong hover:border-ink-dim focus:border-ember",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className={cx(
          "pointer-events-none absolute top-1/2 -translate-y-1/2",
          isCompact
            ? "right-[10px] h-3.5 w-3.5 text-l-ink-dim"
            : "right-s-3 h-4 w-4 text-ink-dim",
        )}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m19.5 8.25-7.5 7.5-7.5-7.5"
        />
      </svg>
    </div>
  );
});
