import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../utils/cn";

/*
 * Badge — Linear "Badge" spec, ported to Chronicle's unified token
 * system.
 *
 * Per the reference:
 *   - Gunmetal background (#383b3f)
 *   - Storm Cloud text (#8a8f98)
 *   - 4px border-radius
 *   - 0px vertical / 6px horizontal padding
 *   - No outline
 *
 * Colored variants follow the same borderless convention: tinted
 * fill (~12% alpha) carries the categorical hue, text color matches.
 * The colored set is a Chronicle extension over Linear's single
 * neutral badge so the event palette (teal/amber/green/orange/pink/
 * violet/red/ember) renders with the same shape.
 */
export const badgeVariants = cva(
  "inline-flex items-center gap-[4px] rounded-badges px-[6px] py-0 font-sans text-[11px] font-medium leading-[16px]",
  {
    variants: {
      variant: {
        neutral: "bg-gunmetal text-storm-cloud",
        ember: "bg-[rgba(216,67,10,0.12)] text-ember",
        teal: "bg-[rgba(45,212,191,0.12)] text-event-teal",
        amber: "bg-[rgba(251,191,36,0.12)] text-event-amber",
        green: "bg-[rgba(74,222,128,0.12)] text-event-green",
        orange: "bg-[rgba(216,107,61,0.12)] text-event-orange",
        pink: "bg-[rgba(244,114,182,0.12)] text-event-pink",
        violet: "bg-[rgba(139,92,246,0.12)] text-event-violet",
        red: "bg-[rgba(239,68,68,0.12)] text-event-red",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export type BadgeVariant =
  | "neutral"
  | "ember"
  | "teal"
  | "amber"
  | "green"
  | "orange"
  | "pink"
  | "violet"
  | "red";

export interface BadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    Omit<VariantProps<typeof badgeVariants>, "variant"> {
  variant?: BadgeVariant;
  ref?: React.Ref<HTMLSpanElement>;
}

export function Badge({
  className,
  variant = "neutral",
  ref,
  ...props
}: BadgeProps) {
  return (
    <span
      ref={ref}
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      data-variant={variant}
      {...props}
    />
  );
}
