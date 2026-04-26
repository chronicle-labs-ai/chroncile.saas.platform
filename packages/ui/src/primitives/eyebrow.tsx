import * as React from "react";
import { tv } from "../utils/tv";

/**
 * Eyebrow — the tactical uppercase mono label used above section headers
 * and inside panels. The one ubiquitous chrome element of the system.
 *
 * Nested `<b>` is auto-highlighted with the high-ink color + medium
 * weight, so the auth-flow pattern works out of the box:
 *
 *   <Eyebrow><b>SIGN IN</b> · CHRONICLE</Eyebrow>
 */
const eyebrow = tv({
  base:
    "font-mono text-mono uppercase tracking-eyebrow text-ink-dim leading-none " +
    "[&>b]:text-ink-hi [&>b]:font-medium",
});

export interface EyebrowProps extends React.HTMLAttributes<HTMLSpanElement> {
  as?: "span" | "div" | "p";
}

export function Eyebrow({
  as: Tag = "span",
  className,
  children,
  ...props
}: EyebrowProps) {
  return (
    <Tag className={eyebrow({ className })} {...props}>
      {children}
    </Tag>
  );
}
