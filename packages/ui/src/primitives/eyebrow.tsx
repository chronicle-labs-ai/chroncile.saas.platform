import * as React from "react";
import { cva } from "class-variance-authority";

/**
 * Eyebrow — the tactical uppercase mono label used above section headers
 * and inside panels. The one ubiquitous chrome element of the system.
 *
 * Nested `<b>` is auto-highlighted with the high-ink color + medium
 * weight, so the auth-flow pattern works out of the box:
 *
 *   <Eyebrow><b>SIGN IN</b> · CHRONICLE</Eyebrow>
 */
export const eyebrowVariants = cva(
  "leading-none font-sans text-[11px] font-medium uppercase tracking-[0.04em] text-l-ink-dim [&>b]:text-l-ink [&>b]:font-medium"
);

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
    <Tag className={eyebrowVariants({ className })} {...props}>
      {children}
    </Tag>
  );
}
