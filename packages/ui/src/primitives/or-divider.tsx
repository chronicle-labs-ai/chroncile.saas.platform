"use client";

import * as React from "react";
import { cva } from "class-variance-authority";

/*
 * OrDivider — labeled hairline used between SSO and email forms:
 *
 *   <OrDivider />                             // "or continue with email"
 *   <OrDivider label="or sign up with email" />
 *
 * Renders a centered mono uppercase label flanked by hairlines. Pure
 * presentation — no role / aria.
 */

export const orDividerRootVariants = cva(
  "flex items-center my-s-2 select-none gap-[10px]"
);

export const orDividerLineVariants = cva("h-px flex-1 bg-l-border");

export const orDividerLabelVariants = cva(
  "font-sans text-[12px] font-medium text-l-ink-dim"
);

export interface OrDividerProps extends React.HTMLAttributes<HTMLDivElement> {
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
  return (
    <div
      className={orDividerRootVariants({ className })}
      aria-hidden
      {...rest}
    >
      <span className={orDividerLineVariants()} />
      {label != null ? (
        <span className={orDividerLabelVariants()}>{label}</span>
      ) : null}
      <span className={orDividerLineVariants()} />
    </div>
  );
}
