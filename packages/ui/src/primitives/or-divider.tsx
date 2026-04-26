"use client";

import * as React from "react";
import { tv } from "../utils/tv";

/*
 * OrDivider — labeled hairline used between SSO and email forms:
 *
 *   <OrDivider />                             // "or continue with email"
 *   <OrDivider label="or sign up with email" />
 *
 * Renders a centered mono uppercase label flanked by hairlines. Pure
 * presentation — no role / aria.
 */

const divider = tv({
  slots: {
    root: "flex items-center gap-s-3 my-s-2 select-none",
    line: "h-px flex-1 bg-hairline",
    label:
      "font-mono text-mono-sm uppercase tracking-tactical text-ink-dim",
  },
});

export interface OrDividerProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Center label. Defaults to "or continue with email". Pass `null` for a bare hairline. */
  label?: React.ReactNode;
}

/**
 * Hairline divider with a centered "or" label — the visual break
 * between SSO and email-password sign-in.
 */
export function OrDivider({
  label = "or continue with email",
  className,
  ...rest
}: OrDividerProps) {
  const slots = divider();
  return (
    <div className={slots.root({ className })} aria-hidden {...rest}>
      <span className={slots.line()} />
      {label != null ? <span className={slots.label()}>{label}</span> : null}
      <span className={slots.line()} />
    </div>
  );
}
