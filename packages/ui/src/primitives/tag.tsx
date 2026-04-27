import * as React from "react";
import { tv, type VariantProps } from "../utils/tv";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

/**
 * Tag — the tighter, label-style pill used on events and roles
 * (CUSTOMER / AGENT / SYSTEM / DIVERGENCE). Smaller than Badge, no border.
 */
export type TagVariant =
  | "neutral"
  | "teal"
  | "amber"
  | "green"
  | "orange"
  | "pink"
  | "violet"
  | "red"
  | "ember";

export type TagDensity = "compact" | "brand";

const tag = tv({
  base: "inline-flex items-center",
  variants: {
    density: {
      brand:
        "rounded-xs px-[6px] py-[3px] font-mono text-mono-xs uppercase tracking-eyebrow",
      compact:
        "rounded-l px-[6px] py-[1px] font-sans text-[11px] font-medium leading-[16px]",
    },
    variant: {
      neutral: "bg-surface-02 text-ink-lo",
      teal: "bg-[rgba(45,212,191,0.1)] text-event-teal",
      amber: "bg-[rgba(251,191,36,0.1)] text-event-amber",
      green: "bg-[rgba(74,222,128,0.1)] text-event-green",
      orange: "bg-[rgba(216,107,61,0.1)] text-event-orange",
      pink: "bg-[rgba(244,114,182,0.1)] text-event-pink",
      violet: "bg-[rgba(139,92,246,0.1)] text-event-violet",
      red: "bg-[rgba(239,68,68,0.1)] text-event-red",
      ember: "bg-[rgba(216,67,10,0.1)] text-ember",
    },
  },
  defaultVariants: { variant: "neutral", density: "brand" },
});

type TagVariantProps = VariantProps<typeof tag>;

export interface TagProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    TagVariantProps {
  variant?: TagVariant;
  density?: TagDensity;
}

export function Tag({
  variant = "neutral",
  density: densityProp,
  className,
  children,
  ...props
}: TagProps) {
  const density = useResolvedChromeDensity(densityProp);
  return (
    <span
      className={tag({ variant, density, className })}
      data-variant={variant}
      data-density={density}
      {...props}
    >
      {children}
    </span>
  );
}
