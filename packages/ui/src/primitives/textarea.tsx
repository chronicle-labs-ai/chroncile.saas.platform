"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../utils/cn";

export const textareaVariants = cva(
  "min-h-[120px] w-full resize-y border outline-none transition-[border-color,box-shadow,background-color] duration-fast ease-out disabled:cursor-not-allowed disabled:opacity-50 data-[invalid=true]:border-event-red focus:data-[invalid=true]:border-event-red rounded-md border-hairline-strong bg-l-surface-input px-[10px] py-[6px] font-sans text-[13px] leading-snug text-l-ink placeholder:text-l-ink-dim hover:border-l-border-strong focus:border-[rgba(216,67,10,0.5)] focus:shadow-[0_0_0_3px_rgba(216,67,10,0.12)]",
  {
    variants: {
      variant: {
        default: "",
        auth: "border-hairline-strong bg-transparent text-ink-hi focus:border-ink-hi",
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

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "color">,
    VariantProps<typeof textareaVariants> {
  invalid?: boolean;
  variant?: "default" | "auth";
  ref?: React.Ref<HTMLTextAreaElement>;
}

export function Textarea({
  invalid = false,
  variant = "default",
  className,
  ref,
  ...props
}: TextareaProps) {
  return (
    <textarea
      {...props}
      ref={ref}
      data-invalid={invalid || undefined}
      className={cn(textareaVariants({ variant, invalid }), className)}
    />
  );
}
