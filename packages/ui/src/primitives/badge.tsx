import * as React from "react";
import { tv, type VariantProps } from "../utils/tv";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

/**
 * Badges cover the full event palette plus brand + structural variants.
 * Legacy names (`critical`, `caution`, `nominal`, `data`, `neutral`) still
 * work — they map onto the new tokens so call sites upgrade in place.
 */
export type BadgeVariant =
  | "neutral"
  | "ember"
  | "teal"
  | "amber"
  | "green"
  | "orange"
  | "pink"
  | "violet"
  | "red"
  | "critical"
  | "caution"
  | "nominal"
  | "data";

export type BadgeDensity = "compact" | "brand";

const badge = tv({
  base: "inline-flex items-center border",
  variants: {
    density: {
      brand:
        "gap-s-2 rounded-xs px-s-2 py-[3px] font-mono text-mono-sm uppercase tracking-tactical",
      compact:
        "gap-[4px] rounded-l px-[6px] py-[1px] font-sans text-[11px] font-medium leading-[16px]",
    },
    variant: {
      neutral: "border-hairline-strong bg-surface-02 text-ink-lo",
      ember: "border-ember/40 bg-[rgba(216,67,10,0.08)] text-ember",
      teal: "border-event-teal/40 bg-[rgba(45,212,191,0.1)] text-event-teal",
      amber: "border-event-amber/40 bg-[rgba(251,191,36,0.1)] text-event-amber",
      green: "border-event-green/40 bg-[rgba(74,222,128,0.1)] text-event-green",
      orange:
        "border-event-orange/40 bg-[rgba(216,107,61,0.1)] text-event-orange",
      pink: "border-event-pink/40 bg-[rgba(244,114,182,0.1)] text-event-pink",
      violet:
        "border-event-violet/40 bg-[rgba(139,92,246,0.1)] text-event-violet",
      red: "border-event-red/40 bg-[rgba(239,68,68,0.1)] text-event-red",
      critical: "border-event-red/40 bg-[rgba(239,68,68,0.1)] text-event-red",
      caution:
        "border-event-amber/40 bg-[rgba(251,191,36,0.1)] text-event-amber",
      nominal:
        "border-event-green/40 bg-[rgba(74,222,128,0.1)] text-event-green",
      data: "border-event-teal/40 bg-[rgba(45,212,191,0.1)] text-event-teal",
    },
  },
  defaultVariants: { variant: "neutral", density: "brand" },
});

type BadgeVariantProps = VariantProps<typeof badge>;

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    BadgeVariantProps {
  variant?: BadgeVariant;
  density?: BadgeDensity;
}

export function Badge({
  variant = "neutral",
  density: densityProp,
  className,
  children,
  ...props
}: BadgeProps) {
  const density = useResolvedChromeDensity(densityProp);
  return (
    <span
      className={badge({ variant, density, className })}
      data-variant={variant}
      data-density={density}
      {...props}
    >
      {children}
    </span>
  );
}
