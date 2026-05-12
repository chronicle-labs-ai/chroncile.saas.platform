import * as React from "react";
import { cx } from "../utils/cx";

export type MonoSize = "xs" | "sm" | "md" | "lg";
export type MonoTone = "default" | "hi" | "lo" | "dim";

export interface MonoProps extends React.HTMLAttributes<HTMLSpanElement> {
  as?: "span" | "code" | "div" | "p" | "time";
  size?: MonoSize;
  tone?: MonoTone;
  uppercase?: boolean;
  tactical?: boolean;
}

const sizes: Record<MonoSize, string> = {
  xs: "text-mono-xs",
  sm: "text-mono-sm",
  md: "text-mono",
  lg: "text-mono-lg",
};

const tones: Record<MonoTone, string> = {
  default: "text-ink",
  hi: "text-ink-hi",
  lo: "text-ink-lo",
  dim: "text-ink-dim",
};

/**
 * Mono — Berkeley Mono (IBM Plex Mono substitute) for time, topics,
 * tool calls, IDs — every piece of machine evidence. Pairs with
 * Display (Kalice) for the "serif for judgement, mono for evidence"
 * principle.
 */
export function Mono({
  as: Tag = "span",
  size = "md",
  tone = "lo",
  uppercase = false,
  tactical = false,
  className,
  children,
  ...props
}: MonoProps) {
  return (
    <Tag
      className={cx(
        "font-mono",
        sizes[size],
        tones[tone],
        uppercase && "uppercase",
        tactical && "tracking-tactical",
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
