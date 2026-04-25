import * as React from "react";
import { tv, type VariantProps } from "../utils/tv";

/**
 * Label — a colored pill with a leading dot. Used to tag rows by
 * domain (`teal` = intercom / support, `amber` = shopify / commerce,
 * `green` = stripe / billing, `pink` = slack, `violet` = sandbox,
 * `ember` = hot signal, `red` = divergence).
 *
 * Distinct from `<Tag>` (which is a brand-density chip) and `<Badge>`
 * (which carries semantic state). Reach for `<Label>` when you want
 * the dot-as-key encoding, like Linear's labels.
 */
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

const label = tv({
  slots: {
    base:
      "inline-flex items-center gap-[4px] h-[20px] px-[7px] " +
      "rounded-[10px] border bg-l-wash-3 border-l-border " +
      "text-[11px] font-mono",
    dot: "w-[6px] h-[6px] rounded-pill bg-current",
  },
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
  defaultVariants: { color: "neutral" },
});

type LabelVariantProps = VariantProps<typeof label>;

export interface LabelProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    LabelVariantProps {
  color?: LabelColor;
  /** When false, hide the leading dot. Defaults to true. */
  dot?: boolean;
}

export function Label({
  color = "neutral",
  dot = true,
  className,
  children,
  ...props
}: LabelProps) {
  const slots = label({ color });
  return (
    <span
      className={slots.base({ className })}
      data-color={color}
      {...props}
    >
      {dot ? <span className={slots.dot()} /> : null}
      {children}
    </span>
  );
}
