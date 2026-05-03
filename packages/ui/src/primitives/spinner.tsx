"use client";

/*
 * Spinner — pure CSS ring. Not an RAC primitive since indeterminate
 * loading UI doesn't need accessibility wiring (aria-busy is usually
 * applied on the parent element). Provide via `ProgressBar` if you need
 * a live-region announcement.
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

export const spinnerVariants = cva(
  "inline-block shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin",
  {
    variants: {
      size: {
        sm: "h-3 w-3 border-[1.5px]",
        md: "h-4 w-4",
        lg: "h-6 w-6",
        xl: "h-8 w-8 border-[3px]",
      },
      tone: {
        default: "text-ink-dim",
        ember: "text-ember",
        inverse: "text-ink-inv",
        success: "text-event-green",
        danger: "text-event-red",
      },
    },
    defaultVariants: {
      size: "md",
      tone: "default",
    },
  }
);

type SpinnerVariantProps = VariantProps<typeof spinnerVariants>;

export interface SpinnerProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "role">,
    SpinnerVariantProps {
  /** Accessible label — announced to screen readers via `aria-label`. */
  label?: string;
}

export function Spinner({
  size,
  tone,
  className,
  label = "Loading",
  ...props
}: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={spinnerVariants({ size, tone, className })}
      {...props}
    />
  );
}
