"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../utils/cn";

/**
 * Input is a styled `<input>` with Chronicle validation variants.
 * Form wiring is explicit through native `id`, `aria-describedby`, and
 * `aria-invalid` props.
 */
/*
 * Touch zoom guard: iOS Safari zooms the viewport when a focused input
 * has a font-size below 16px. We keep desktop density (`text-[13px]` /
 * `h-[28px]`) but bump to 16px / 36px on coarse pointers so iPad and
 * iPhone don't zoom.
 */
export const inputVariants = cva(
  "w-full border outline-none transition-[border-color,box-shadow,background-color] duration-fast ease-out h-[28px] [@media(pointer:coarse)]:h-9 rounded-md border-hairline-strong bg-l-surface-input px-[10px] font-sans text-[13px] [@media(pointer:coarse)]:text-[16px] text-l-ink placeholder:text-l-ink-dim hover:border-l-border-strong focus:border-[rgba(216,67,10,0.5)] focus:shadow-[0_0_0_3px_rgba(216,67,10,0.12)] data-[invalid=true]:border-event-red focus:data-[invalid=true]:border-event-red disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "",
        auth: "border-hairline-strong bg-transparent text-ink-hi focus:border-ink-hi",
      },
      search: {
        true: "pl-[36px]",
      },
      invalid: {
        true: "border-event-red focus:border-event-red",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

type InputVariantProps = VariantProps<typeof inputVariants>;

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "className">,
    InputVariantProps {
  className?: string;
  /** Render a leading search glyph and adjust padding. */
  search?: boolean;
  invalid?: boolean;
  variant?: "default" | "auth";
  /** Wrapper className when `search` is true. */
  wrapperClassName?: string;
  ref?: React.Ref<HTMLInputElement>;
}

export function Input({
  search = false,
  invalid = false,
  variant = "default",
  className,
  wrapperClassName,
  ref,
  ...props
}: InputProps) {
  const field = (
    <input
      {...props}
      ref={ref}
      data-invalid={invalid || undefined}
      className={cn(inputVariants({ variant, search, invalid }), className)}
    />
  );

  if (!search) return field;

  return (
    <div className={`relative ${wrapperClassName ?? ""}`}>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="pointer-events-none absolute left-[10px] top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-l-ink-dim"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
      </svg>
      {field}
    </div>
  );
}
