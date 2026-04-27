import * as React from "react";
import { tv, type VariantProps } from "../utils/tv";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

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

export type LabelDensity = "compact" | "brand";

const label = tv({
  slots: {
    base: "inline-flex items-center border",
    dot: "rounded-pill bg-current",
  },
  variants: {
    density: {
      compact: {
        base:
          "gap-[4px] h-[20px] px-[7px] rounded-[10px] " +
          "bg-l-wash-3 border-l-border text-[11px] font-mono",
        dot: "w-[6px] h-[6px]",
      },
      brand: {
        base:
          "gap-s-1 h-[22px] px-s-2 rounded-pill " +
          "bg-surface-02 border-hairline-strong " +
          "font-mono text-mono-xs uppercase tracking-tactical",
        dot: "w-[6px] h-[6px]",
      },
    },
    color: {
      neutral: { base: "" },
      teal: { base: "text-event-teal" },
      amber: { base: "text-event-amber" },
      green: { base: "text-event-green" },
      orange: { base: "text-event-orange" },
      pink: { base: "text-event-pink" },
      violet: { base: "text-event-violet" },
      ember: { base: "text-ember" },
      red: { base: "text-event-red" },
    },
  },
  compoundVariants: [
    { density: "compact", color: "neutral", class: { base: "text-l-ink-lo" } },
    { density: "brand", color: "neutral", class: { base: "text-ink-lo" } },
  ],
  defaultVariants: { color: "neutral", density: "compact" },
});

type LabelVariantProps = VariantProps<typeof label>;

export interface LabelProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    LabelVariantProps {
  color?: LabelColor;
  density?: LabelDensity;
  /** When false, hide the leading dot. Defaults to true. */
  dot?: boolean;
}

export function Label({
  color = "neutral",
  density: densityProp,
  dot = true,
  className,
  children,
  ...props
}: LabelProps) {
  const density = useResolvedChromeDensity(densityProp);
  const slots = label({ color, density });
  return (
    <span
      className={slots.base({ className })}
      data-color={color}
      data-density={density}
      {...props}
    >
      {dot ? <span className={slots.dot()} /> : null}
      {children}
    </span>
  );
}
