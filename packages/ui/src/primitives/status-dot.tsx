import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../utils/cn";

/**
 * StatusDot — the colored dot used inline in status labels, nav items,
 * and event rails. New tokens use the event palette; legacy names map on.
 *
 * Fill + halo colors live in an inline `style` so consumers can mix
 * in their own without us having to expose Tailwind classes for every
 * rgba halo value. Token names come from `tokens.css`.
 */
export const statusDotVariants = cva(
  "inline-block h-[8px] w-[8px] shrink-0 rounded-full",
  {
    variants: {
      pulse: {
        true: "animate-chron-pulse",
      },
    },
  }
);

export type StatusDotVariant =
  | "ember"
  | "teal"
  | "amber"
  | "green"
  | "orange"
  | "pink"
  | "violet"
  | "red"
  | "offline";

export interface StatusDotProps
  extends Omit<
    React.HTMLAttributes<HTMLSpanElement>,
    "color"
  >,
    Omit<VariantProps<typeof statusDotVariants>, "pulse"> {
  variant?: StatusDotVariant;
  pulse?: boolean;
  /** Renders the halo ring used on the event stream selected row. */
  halo?: boolean;
  ref?: React.Ref<HTMLSpanElement>;
}

const palette: Record<StatusDotVariant, { fill: string; halo: string }> = {
  ember: { fill: "var(--c-ember)", halo: "rgba(216,67,10,0.2)" },
  teal: { fill: "var(--c-event-teal)", halo: "rgba(45,212,191,0.12)" },
  amber: { fill: "var(--c-event-amber)", halo: "rgba(251,191,36,0.12)" },
  green: { fill: "var(--c-event-green)", halo: "rgba(74,222,128,0.12)" },
  orange: { fill: "var(--c-event-orange)", halo: "rgba(216,107,61,0.12)" },
  pink: { fill: "var(--c-event-pink)", halo: "rgba(244,114,182,0.12)" },
  violet: { fill: "var(--c-event-violet)", halo: "rgba(139,92,246,0.12)" },
  red: { fill: "var(--c-event-red)", halo: "rgba(239,68,68,0.12)" },
  offline: { fill: "var(--c-ink-faint)", halo: "rgba(255,255,255,0)" },
};

export function StatusDot({
  variant = "offline",
  pulse = false,
  halo = false,
  className,
  style,
  ref,
  ...props
}: StatusDotProps) {
  const v = palette[variant];
  return (
    <span
      ref={ref}
      aria-hidden
      className={cn(statusDotVariants({ pulse }), className)}
      data-variant={variant}
      style={{
        background: v.fill,
        boxShadow: halo ? `0 0 0 3px ${v.halo}` : undefined,
        ...style,
      }}
      {...props}
    />
  );
}
