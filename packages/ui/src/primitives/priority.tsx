import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Priority — Linear's three-bar glyph encoding urgency.
 *   none   — three flat dim bars
 *   low    — only the smallest bar lit (ink-lo)
 *   med    — two bars lit amber
 *   high   — three bars lit ember (brand "high")
 *   urgent — three bars lit red
 *
 * Renders as a 16×16 inline-flex svg-less glyph so it scales with
 * font-size without extra layout cost. Pairs with `<TraceRow>` and
 * the priority chip / dropdown.
 */
export type PriorityLevel = "none" | "low" | "med" | "high" | "urgent";

export interface PriorityProps extends React.HTMLAttributes<HTMLSpanElement> {
  level: PriorityLevel;
  /** Glyph height in pixels. Defaults to 16. */
  size?: number;
  /** Accessible label. Defaults to `${level} priority`. */
  ariaLabel?: string;
}

export function Priority({
  level,
  size = 16,
  ariaLabel,
  className,
  ...props
}: PriorityProps) {
  const widthFactor = size / 16;
  // bar 1 = 5px, bar 2 = 9px, bar 3 = 13px (at size=16)
  const heights = [5, 9, 13].map((h) => Math.round(h * widthFactor));
  const barW = Math.max(2, Math.round(2.5 * widthFactor));

  const colors = barColorsFor(level);

  return (
    <span
      role="img"
      aria-label={ariaLabel ?? `${level} priority`}
      data-level={level}
      className={cn(
        "inline-flex items-end justify-center",
        // gap stays consistent regardless of size
        "gap-[1.5px]",
        className
      )}
      style={{ width: size, height: size }}
      {...props}
    >
      {heights.map((h, i) => (
        <span
          key={i}
          style={{
            width: barW,
            height: h,
            background: colors[i],
            borderRadius: "0.5px",
          }}
        />
      ))}
    </span>
  );
}

function barColorsFor(level: PriorityLevel): [string, string, string] {
  const dim = "var(--l-p-none)";
  const lo = "var(--l-ink-lo)";
  switch (level) {
    case "urgent":
      return ["var(--l-p-urgent)", "var(--l-p-urgent)", "var(--l-p-urgent)"];
    case "high":
      return ["var(--l-p-high)", "var(--l-p-high)", "var(--l-p-high)"];
    case "med":
      return ["var(--l-p-med)", "var(--l-p-med)", dim];
    case "low":
      return [lo, dim, dim];
    case "none":
    default:
      return [dim, dim, dim];
  }
}
