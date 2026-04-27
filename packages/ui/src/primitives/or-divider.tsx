"use client";

import * as React from "react";
import { tv } from "../utils/tv";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

/*
 * OrDivider — labeled hairline used between SSO and email forms:
 *
 *   <OrDivider />                             // "or continue with email"
 *   <OrDivider label="or sign up with email" />
 *
 * Renders a centered mono uppercase label flanked by hairlines. Pure
 * presentation — no role / aria.
 */

export type OrDividerDensity = "compact" | "brand";

const divider = tv({
  slots: {
    root: "flex items-center my-s-2 select-none",
    line: "h-px flex-1",
    label: "",
  },
  variants: {
    density: {
      brand: {
        root: "gap-s-3",
        line: "bg-hairline",
        label: "font-mono text-mono-sm uppercase tracking-tactical text-ink-dim",
      },
      compact: {
        root: "gap-[10px]",
        line: "bg-l-border",
        label: "font-sans text-[12px] font-medium text-l-ink-dim",
      },
    },
  },
  defaultVariants: { density: "brand" },
});

export interface OrDividerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Center label. Defaults to "or continue with email". Pass `null` for a bare hairline. */
  label?: React.ReactNode;
  density?: OrDividerDensity;
}

/**
 * Hairline divider with a centered "or" label — the visual break
 * between SSO and email-password sign-in.
 */
export function OrDivider({
  label = "or continue with email",
  density: densityProp,
  className,
  ...rest
}: OrDividerProps) {
  const density = useResolvedChromeDensity(densityProp);
  const slots = divider({ density });
  return (
    <div
      className={slots.root({ className })}
      data-density={density}
      aria-hidden
      {...rest}
    >
      <span className={slots.line()} />
      {label != null ? <span className={slots.label()}>{label}</span> : null}
      <span className={slots.line()} />
    </div>
  );
}
