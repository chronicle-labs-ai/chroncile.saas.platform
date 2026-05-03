"use client";

import * as React from "react";

import { cn } from "../utils/cn";

/*
 * BackLink — small inline back-navigation link, the "Subtle Link
 * Button" from Linear's reference. Renders an `<a>` so it stays
 * navigable / right-clickable / middle-click-openable; pair with
 * your router's `prefetch` etc. via `…rest`.
 *
 * Typography matches the rest of the unified Linear chrome
 * (`font-sans text-[12px] font-medium`, `text-l-ink-lo` →
 * `text-l-ink` on hover) — same role as breadcrumbs and pagination
 * links, so it reads as part of the same family rather than a
 * code-tag (which `font-mono` was implying).
 */

export interface BackLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  children: React.ReactNode;
  ref?: React.Ref<HTMLAnchorElement>;
}

export function BackLink({ children, className, ref, ...props }: BackLinkProps) {
  return (
    <a
      ref={ref}
      data-slot="back-link"
      className={cn(
        "inline-flex items-center gap-[4px] font-sans text-[12px] font-medium leading-none text-l-ink-lo transition-colors duration-fast ease-out hover:text-l-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
        className,
      )}
      {...props}
    >
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-[12px] shrink-0"
      >
        <path d="M10 12L6 8l4-4" />
      </svg>
      {children}
    </a>
  );
}
