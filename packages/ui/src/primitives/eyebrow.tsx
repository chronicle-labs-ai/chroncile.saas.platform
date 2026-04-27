import * as React from "react";
import { tv } from "../utils/tv";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

/**
 * Eyebrow — the tactical uppercase mono label used above section headers
 * and inside panels. The one ubiquitous chrome element of the system.
 *
 * Nested `<b>` is auto-highlighted with the high-ink color + medium
 * weight, so the auth-flow pattern works out of the box:
 *
 *   <Eyebrow><b>SIGN IN</b> · CHRONICLE</Eyebrow>
 */
export type EyebrowDensity = "compact" | "brand";

const eyebrow = tv({
  base: "leading-none [&>b]:font-medium",
  variants: {
    density: {
      brand:
        "font-mono text-mono uppercase tracking-eyebrow text-ink-dim " +
        "[&>b]:text-ink-hi",
      compact:
        "font-sans text-[11px] font-medium uppercase tracking-[0.04em] text-l-ink-dim " +
        "[&>b]:text-l-ink",
    },
  },
  defaultVariants: { density: "brand" },
});

export interface EyebrowProps extends React.HTMLAttributes<HTMLSpanElement> {
  as?: "span" | "div" | "p";
  density?: EyebrowDensity;
}

export function Eyebrow({
  as: Tag = "span",
  density: densityProp,
  className,
  children,
  ...props
}: EyebrowProps) {
  const density = useResolvedChromeDensity(densityProp);
  return (
    <Tag
      className={eyebrow({ density, className })}
      data-density={density}
      {...props}
    >
      {children}
    </Tag>
  );
}
