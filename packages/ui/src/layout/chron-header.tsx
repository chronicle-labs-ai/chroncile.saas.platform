"use client";

import * as React from "react";

import { tv } from "../utils/tv";
import { Logo } from "../primitives/logo";

/**
 * ChronHeader — the spare top-left wordmark header used across the
 * handoff pages. Nothing else. Perfect for marketing/docs shells.
 *
 */
const chronHeader = tv({
  slots: {
    root: "px-s-16 py-s-16 pl-[72px] pr-[72px]",
    link:
      "inline-block h-[8px] opacity-70 outline-none " +
      "transition-opacity duration-base ease-out " +
      "hover:opacity-100 " +
      "focus-visible:outline focus-visible:outline-1 " +
      "focus-visible:outline-ember",
  },
});

export interface ChronHeaderProps extends React.HTMLAttributes<HTMLElement> {
  href?: string;
  label?: string;
}

export function ChronHeader({
  href = "/",
  label = "Chronicle Labs",
  className,
  ...props
}: ChronHeaderProps) {
  const slots = chronHeader({});
  return (
    <header className={slots.root({ className })} {...props}>
      <a href={href} aria-label={label} className={slots.link()}>
        <Logo variant="wordmark" className="h-full w-auto" />
      </a>
    </header>
  );
}
