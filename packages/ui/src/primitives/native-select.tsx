"use client";

/*
 * NativeSelect is the previous `Select` implementation preserved for
 * back-compat: a styled `<select>` with `<option>` children. Use this for
 * quick forms that don't need search/typeahead/custom rendering. For
 * anything richer, use the Radix-based `Select` compound in `./select`.
 */

import * as React from "react";
import { cn } from "../utils/cn";

export interface NativeSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  variant?: "default" | "auth";
  ref?: React.Ref<HTMLSelectElement>;
}

export function NativeSelect({
  invalid = false,
  variant = "default",
  className,
  children,
  ref,
  ...props
}: NativeSelectProps) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "w-full appearance-none border transition-[border-color,background-color] duration-fast ease-out focus:outline-none touch-manipulation",
          /*
           * Density matches `<Input>` exactly — desktop runs at the
           * compact 28px / 13px rhythm; coarse-pointer devices bump
           * to 36px / 16px so the field feels reachable AND so iOS
           * Safari doesn't auto-zoom on focus (anything <16px does).
           */
          "h-[28px] rounded-md bg-l-surface-input px-[10px] pr-[28px] font-sans text-[13px] leading-none text-l-ink",
          "[@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:text-[16px]",
          variant === "auth"
            ? "bg-transparent border-hairline-strong text-ink-hi focus:border-ink-hi"
            : invalid
              ? "border-event-red focus:border-event-red"
              : "border-hairline-strong hover:border-l-border-strong focus:border-[rgba(216,67,10,0.5)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="pointer-events-none absolute top-1/2 -translate-y-1/2 right-[10px] h-3.5 w-3.5 text-l-ink-dim"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m19.5 8.25-7.5 7.5-7.5-7.5"
        />
      </svg>
    </div>
  );
}
