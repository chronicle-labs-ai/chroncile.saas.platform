import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../utils/cn";

/**
 * Tag — the tighter, label-style pill used on events and roles
 * (CUSTOMER / AGENT / SYSTEM / DIVERGENCE). Smaller than Badge, no
 * border.
 */
export const tagVariants = cva(
  "inline-flex items-center rounded-md px-[6px] py-[1px] font-sans text-[11px] font-medium leading-[16px]",
  {
    variants: {
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
    defaultVariants: {
      variant: "neutral",
    },
  }
);

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

export interface TagProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    Omit<VariantProps<typeof tagVariants>, "variant"> {
  variant?: TagVariant;
  ref?: React.Ref<HTMLSpanElement>;
}

export function Tag({
  className,
  variant = "neutral",
  ref,
  ...props
}: TagProps) {
  return (
    <span
      ref={ref}
      className={cn(tagVariants({ variant }), className)}
      data-variant={variant}
      {...props}
    />
  );
}
