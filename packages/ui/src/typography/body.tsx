import * as React from "react";
import { cx } from "../utils/cx";

export type BodySize = "sm" | "md" | "lg";
export type BodyTone = "default" | "lo" | "dim";

export interface BodyProps extends React.HTMLAttributes<HTMLParagraphElement> {
  as?: "p" | "span" | "div";
  size?: BodySize;
  tone?: BodyTone;
}

const sizes: Record<BodySize, string> = {
  sm: "text-body-sm",
  md: "text-body",
  lg: "text-body-lg",
};

const tones: Record<BodyTone, string> = {
  default: "text-ink",
  lo: "text-ink-lo",
  dim: "text-ink-dim",
};

/**
 * Body — TWK Lausanne, light weight, generous line-height. The "reading"
 * text of the system. Headlines go to Display, evidence goes to Mono.
 */
export function Body({
  as: Tag = "p",
  size = "md",
  tone = "default",
  className,
  children,
  ...props
}: BodyProps) {
  return (
    <Tag
      className={cx(
        "font-sans font-light leading-[1.5]",
        sizes[size],
        tones[tone],
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
