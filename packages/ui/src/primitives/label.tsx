import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../utils/cn";

/**
 * Label — a colored pill with a leading dot. Used to tag rows by
 * domain (`teal` = intercom / support, `amber` = shopify / commerce,
 * `green` = stripe / billing, `pink` = slack, `violet` = sandbox,
 * `ember` = hot signal, `red` = divergence).
 *
 * Distinct from `<Tag>` (which is a smaller event/role chip) and
 * `<Badge>` (which carries semantic state). Reach for `<Label>` when
 * you want the dot-as-key encoding, like Linear's labels.
 */
export const labelVariants = cva(
  "inline-flex items-center border gap-[4px] h-[20px] px-[7px] rounded-[10px] bg-l-wash-3 border-hairline-strong text-[11px] font-mono",
  {
    variants: {
      color: {
        neutral: "text-l-ink-lo",
        teal: "text-event-teal",
        amber: "text-event-amber",
        green: "text-event-green",
        orange: "text-event-orange",
        pink: "text-event-pink",
        violet: "text-event-violet",
        ember: "text-ember",
        red: "text-event-red",
      },
    },
    defaultVariants: {
      color: "neutral",
    },
  }
);

export const labelDotVariants = cva("rounded-pill bg-current h-[6px] w-[6px]");

export type LabelColor =
  | "neutral"
  | "teal"
  | "amber"
  | "green"
  | "orange"
  | "pink"
  | "violet"
  | "ember"
  | "red";

export interface LabelProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    Omit<VariantProps<typeof labelVariants>, "color"> {
  color?: LabelColor;
  /** When false, hide the leading dot. Defaults to true. */
  dot?: boolean;
  ref?: React.Ref<HTMLSpanElement>;
}

export function Label({
  className,
  children,
  color = "neutral",
  dot = true,
  ref,
  ...props
}: LabelProps) {
  return (
    <span
      ref={ref}
      className={cn(labelVariants({ color }), className)}
      data-color={color}
      {...props}
    >
      {dot ? <span className={labelDotVariants()} /> : null}
      {children}
    </span>
  );
}
