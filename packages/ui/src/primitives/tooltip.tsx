"use client";

/*
 * Tooltip — hover/focus-triggered flyout with a short description of
 * the element it anchors to. Use exclusively for non-interactive content
 * — anything actionable belongs in a Popover or Menu.
 *
 *   <Tooltip content="Save changes">
 *     <Button isIconOnly>Save</Button>
 *   </Tooltip>
 */

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cva } from "class-variance-authority";

import { cn } from "../utils/cn";

/*
 * Radix Tooltip emits `data-state="delayed-open" | "instant-open" | "closed"`
 * on `Content`, plus `data-side="…"`. We match on state presence (`open` /
 * `closed`) using attribute wildcards.
 */
export const tooltipVariants = cva(
  "z-50 border bg-surface-02 shadow-card outline-none " +
    "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 " +
    "data-[state=instant-open]:animate-in data-[state=instant-open]:fade-in-0 data-[state=instant-open]:zoom-in-95 " +
    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 " +
    "data-[side=bottom]:slide-in-from-top-2 " +
    "data-[side=left]:slide-in-from-right-2 " +
    "data-[side=right]:slide-in-from-left-2 " +
    "data-[side=top]:slide-in-from-bottom-2 rounded-md border-hairline-strong px-[8px] py-[4px] font-sans text-[12px] font-medium text-l-ink"
);

export const tooltipArrowVariants = cva(
  "fill-surface-02 stroke-hairline-strong"
);

export interface TooltipProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>,
    "children"
  > {
  children: React.ReactElement;
  content: React.ReactNode;
  placement?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>["side"];
  side?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>["side"];
  align?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>["align"];
  showArrow?: boolean;
  className?: string;
  classNames?: { tooltip?: string; arrow?: string };
  /** Milliseconds before the tooltip appears. */
  delay?: number;
  closeDelay?: number;
}

export function Tooltip({
  children,
  content,
  placement,
  side = "top",
  align = "center",
  showArrow = false,
  className,
  classNames,
  delay,
  ...rest
}: TooltipProps) {
  const resolvedSide = placement ?? side;
  return (
    <TooltipPrimitive.Provider delayDuration={delay}>
      <TooltipPrimitive.Root {...rest}>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={resolvedSide}
            align={align}
            className={cn(tooltipVariants(), classNames?.tooltip, className)}
          >
            {showArrow ? (
              <TooltipPrimitive.Arrow asChild>
                <svg
                  viewBox="0 0 8 8"
                  className={tooltipArrowVariants({
                    className: classNames?.arrow,
                  })}
                >
                  <path d="M0 0 L4 4 L8 0" />
                </svg>
              </TooltipPrimitive.Arrow>
            ) : null}
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
