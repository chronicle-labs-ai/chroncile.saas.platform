"use client";

/*
 * Popover — positioned overlay anchored to a trigger.
 *
 * Use for action confirmations, settings flyouts, pickers, and any
 * floating surface where the trigger itself is interactive. For modal
 * dialogs (backdrop + focus trap over full viewport) use `Modal`. For
 * tooltips (hover-only, no trigger semantics beyond hover/focus) use
 * `Tooltip`.
 *
 * Compound API:
 *
 *   <Popover>
 *     <PopoverTrigger>
 *       <Button>Open</Button>
 *     </PopoverTrigger>
 *     <PopoverContent placement="bottom">...</PopoverContent>
 *   </Popover>
 */

import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { cva } from "class-variance-authority";

import { cn } from "../utils/cn";

/*
 * Radix Popover emits `data-state="open" | "closed"` on `Content` and
 * `data-side="top" | "right" | "bottom" | "left"` on `Content` / `Arrow`.
 */
export const popoverVariants = cva(
  "z-50 border bg-surface-02 shadow-panel outline-none " +
    "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 " +
    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 " +
    "data-[side=bottom]:slide-in-from-top-2 " +
    "data-[side=left]:slide-in-from-right-2 " +
    "data-[side=right]:slide-in-from-left-2 " +
    "data-[side=top]:slide-in-from-bottom-2 rounded-md border-hairline-strong"
);

export const popoverDialogVariants = cva("outline-none");

export const popoverArrowVariants = cva(
  "fill-surface-02 stroke-hairline-strong"
);

type PopoverSide = React.ComponentPropsWithoutRef<
  typeof PopoverPrimitive.Content
>["side"];
type PopoverAlign = React.ComponentPropsWithoutRef<
  typeof PopoverPrimitive.Content
>["align"];

export interface PopoverProps
  extends React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Root> {}

export function Popover(props: PopoverProps) {
  return <PopoverPrimitive.Root {...props} />;
}

export interface PopoverTriggerProps
  extends React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Trigger> {
  /**
   * Render the child element instead of wrapping it in a `<button>`.
   * Defaults to `false` (matches upstream shadcn). Pass `asChild` when
   * the trigger is already an interactive element (Button, Link, …).
   *
   *   <PopoverTrigger asChild>
   *     <Button>Open</Button>
   *   </PopoverTrigger>
   *
   *   <PopoverTrigger>Open</PopoverTrigger>
   */
  asChild?: boolean;
}

export function PopoverTrigger({
  asChild = false,
  ...props
}: PopoverTriggerProps) {
  return <PopoverPrimitive.Trigger asChild={asChild} {...props} />;
}

export interface PopoverContentProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>,
    "className"
  > {
  className?: string;
  classNames?: { popover?: string; dialog?: string; arrow?: string };
  /** Render a directional arrow pointing at the trigger. Off by default. */
  showArrow?: boolean;
  placement?: "top" | "bottom" | "left" | "right" | string;
  children: React.ReactNode;
}

export function PopoverContent({
  className,
  classNames,
  showArrow = false,
  placement,
  side,
  align,
  children,
  ...rest
}: PopoverContentProps) {
  const [placementSide, placementAlign] = String(placement ?? "").split(" ");
  const resolvedSide =
    side ?? (placementSide ? (placementSide as PopoverSide) : undefined);
  const resolvedAlign =
    align ?? (placementAlign ? (placementAlign as PopoverAlign) : undefined);
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        {...rest}
        side={resolvedSide}
        align={resolvedAlign}
        className={cn(popoverVariants(), classNames?.popover, className)}
      >
        {showArrow ? (
          <PopoverPrimitive.Arrow asChild>
            <svg
              viewBox="0 0 12 12"
              className={popoverArrowVariants({ className: classNames?.arrow })}
            >
              <path d="M0 0 L6 6 L12 0" />
            </svg>
          </PopoverPrimitive.Arrow>
        ) : null}
        <div
          role="dialog"
          className={popoverDialogVariants({ className: classNames?.dialog })}
        >
          {children}
        </div>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}
