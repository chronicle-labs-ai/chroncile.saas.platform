"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../utils/cn";

/*
 * Alert — inline notice with optional icon, title, and description. For
 * destructive confirmation flows (Cancel / Confirm), use `AlertDialog`.
 * For ephemeral success / failure feedback, use the `useToast()` queue.
 *
 *   <Alert>
 *     <AlertTitle>Heads up</AlertTitle>
 *     <AlertDescription>Verify your email to publish.</AlertDescription>
 *   </Alert>
 *
 *   <Alert variant="destructive">
 *     <AlertTitle>Sync failed</AlertTitle>
 *     <AlertDescription>Doppler returned 401. Re-auth and retry.</AlertDescription>
 *   </Alert>
 *
 * Tone aliases (`info`/`success`/`warning`/`danger`) are retained as
 * Chronicle extensions; `danger` and `destructive` are interchangeable.
 */

export const alertVariants = cva(
  "relative w-full rounded-md border px-[14px] py-[10px] grid has-[>svg]:grid-cols-[16px_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-[10px] gap-y-[2px] items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground border-hairline",
        destructive: "bg-[rgba(239,68,68,0.06)] text-event-red border-event-red/40 [&_[data-slot=alert-description]]:text-l-ink-lo",
        info: "bg-[rgba(45,212,191,0.06)] text-event-teal border-event-teal/40 [&_[data-slot=alert-description]]:text-l-ink-lo",
        success: "bg-[rgba(74,222,128,0.06)] text-event-green border-event-green/40 [&_[data-slot=alert-description]]:text-l-ink-lo",
        warning: "bg-[rgba(251,191,36,0.06)] text-event-amber border-event-amber/40 [&_[data-slot=alert-description]]:text-l-ink-lo",
        danger: "bg-[rgba(239,68,68,0.06)] text-event-red border-event-red/40 [&_[data-slot=alert-description]]:text-l-ink-lo",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

/**
 * Canonical Alert variants. `tone` is accepted as a deprecated alias for
 * `variant`; new code should pass `variant`.
 */
export type AlertVariant =
  | "default"
  | "destructive"
  | "info"
  | "success"
  | "warning"
  | "danger";

/** @deprecated Use `AlertVariant`. */
export type AlertTone = AlertVariant;

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    Omit<VariantProps<typeof alertVariants>, "variant"> {
  variant?: AlertVariant;
  /** @deprecated Use `variant`. Retained for source compatibility. */
  tone?: AlertVariant;
  ref?: React.Ref<HTMLDivElement>;
}

export function Alert({
  className,
  variant,
  tone,
  ref,
  ...props
}: AlertProps) {
  const resolved = variant ?? tone ?? "default";
  return (
    <div
      ref={ref}
      role="alert"
      data-slot="alert"
      className={cn(alertVariants({ variant: resolved }), className)}
      {...props}
    />
  );
}

export interface AlertTitleProps
  extends React.HTMLAttributes<HTMLHeadingElement> {
  ref?: React.Ref<HTMLHeadingElement>;
}

export function AlertTitle({ className, ref, ...props }: AlertTitleProps) {
  return (
    <h5
      ref={ref}
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 m-0 font-sans text-[13px] font-medium tracking-normal",
        className
      )}
      {...props}
    />
  );
}

export interface AlertDescriptionProps
  extends React.HTMLAttributes<HTMLParagraphElement> {
  ref?: React.Ref<HTMLParagraphElement>;
}

export function AlertDescription({
  className,
  ref,
  ...props
}: AlertDescriptionProps) {
  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      data-slot="alert-description"
      className={cn(
        "col-start-2 grid justify-items-start gap-1 font-sans text-[12px] leading-snug text-l-ink-lo [&_p]:leading-snug",
        className
      )}
      {...props}
    />
  );
}
