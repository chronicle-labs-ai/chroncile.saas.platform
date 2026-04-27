import * as React from "react";
import { tv, type VariantProps } from "../utils/tv";

/**
 * StatusDot — the colored dot used inline in status labels, nav items,
 * and event rails. New tokens use the event palette; legacy names map on.
 *
 * Fill + halo colors still live in an inline `style` so consumers can mix
 * in their own without us having to expose Tailwind classes for every
 * rgba halo value. Token names come from `tokens.css`.
 */
export type StatusDotVariant =
  | "ember"
  | "teal"
  | "amber"
  | "green"
  | "orange"
  | "pink"
  | "violet"
  | "red"
  | "offline"
  | "critical"
  | "caution"
  | "nominal"
  | "data";

const dot = tv({
  base: "inline-block h-[8px] w-[8px] shrink-0 rounded-full",
  variants: {
    pulse: { true: "animate-chron-pulse" },
  },
});

type DotVariantProps = VariantProps<typeof dot>;

export interface StatusDotProps
  extends React.HTMLAttributes<HTMLSpanElement>, DotVariantProps {
  variant?: StatusDotVariant;
  pulse?: boolean;
  /** Renders the halo ring used on the event stream selected row. */
  halo?: boolean;
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
  critical: { fill: "var(--c-event-red)", halo: "rgba(239,68,68,0.12)" },
  caution: { fill: "var(--c-event-amber)", halo: "rgba(251,191,36,0.12)" },
  nominal: { fill: "var(--c-event-green)", halo: "rgba(74,222,128,0.12)" },
  data: { fill: "var(--c-event-teal)", halo: "rgba(45,212,191,0.12)" },
};

export function StatusDot({
  variant = "offline",
  pulse = false,
  halo = false,
  className,
  style,
  ...props
}: StatusDotProps) {
  const v = palette[variant];
  return (
    <span
      aria-hidden
      className={dot({ pulse, className })}
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
