import * as React from "react";
import { cx } from "../utils/cx";

export type DisplaySize = "sm" | "md" | "lg" | "xl" | "xxl";

export interface DisplayProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "div";
  size?: DisplaySize;
  /** Use the warm bone color for italic emphasis inside the headline. */
  muted?: boolean;
}

const sizes: Record<DisplaySize, string> = {
  sm: "text-display-sm",
  md: "text-display-md",
  lg: "text-display-lg",
  xl: "text-display-xl",
  xxl: "text-display-xxl",
};

/**
 * Display — Kalice at the big end of the scale. Use for page headlines,
 * card hero copy, and section openers. Italic children should be wrapped
 * in `<em>` for the Kalice italic pairing.
 */
export function Display({
  as: Tag = "h1",
  size = "md",
  muted = false,
  className,
  children,
  ...props
}: DisplayProps) {
  return (
    <Tag
      className={cx(
        "font-display font-medium tracking-display leading-[0.96]",
        muted ? "text-bone" : "text-ink-hi",
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
