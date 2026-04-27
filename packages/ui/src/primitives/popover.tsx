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
import {
  DialogTrigger as RACDialogTrigger,
  Popover as RACPopover,
  Dialog as RACDialog,
  OverlayArrow as RACOverlayArrow,
  type PopoverProps as RACPopoverProps,
  type DialogTriggerProps,
} from "react-aria-components";

import { tv } from "../utils/tv";
import { composeTwRenderProps } from "../utils/compose";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

const popoverStyles = tv({
  slots: {
    popover:
      "z-50 border bg-surface-02 shadow-panel outline-none " +
      "data-[entering=true]:animate-in data-[entering=true]:fade-in " +
      "data-[exiting=true]:animate-out data-[exiting=true]:fade-out",
    dialog: "outline-none",
    arrow:
      "fill-surface-02 stroke-hairline-strong " +
      "data-[placement=top]:rotate-180 " +
      "data-[placement=left]:-rotate-90 " +
      "data-[placement=right]:rotate-90",
  },
  variants: {
    density: {
      brand: { popover: "rounded-md border-hairline-strong" },
      compact: { popover: "rounded-l border-l-border" },
    },
  },
  defaultVariants: { density: "brand" },
});

export interface PopoverProps extends DialogTriggerProps {}

export function Popover(props: PopoverProps) {
  return <RACDialogTrigger {...props} />;
}

/**
 * Marker component that pairs with `<PopoverContent>`. RAC's
 * `DialogTrigger` treats the first non-overlay child as the trigger;
 * this lets callers wrap their `<Button>` in a named slot for clarity.
 * It's a pass-through — RAC auto-wires the press handler.
 */
export function PopoverTrigger({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export interface PopoverContentProps extends Omit<
  RACPopoverProps,
  "className"
> {
  className?: string;
  classNames?: { popover?: string; dialog?: string; arrow?: string };
  /** Render a directional arrow pointing at the trigger. Off by default. */
  showArrow?: boolean;
  density?: "compact" | "brand";
  children: React.ReactNode;
}

export function PopoverContent({
  className,
  classNames,
  showArrow = false,
  density: densityProp,
  children,
  ...rest
}: PopoverContentProps) {
  const density = useResolvedChromeDensity(densityProp);
  const slots = popoverStyles({ density });
  return (
    <RACPopover
      {...rest}
      className={composeTwRenderProps(
        className ?? classNames?.popover,
        slots.popover()
      )}
    >
      {showArrow ? (
        <RACOverlayArrow>
          <svg
            viewBox="0 0 12 12"
            className={slots.arrow({ className: classNames?.arrow })}
          >
            <path d="M0 0 L6 6 L12 0" />
          </svg>
        </RACOverlayArrow>
      ) : null}
      <RACDialog className={slots.dialog({ className: classNames?.dialog })}>
        {children}
      </RACDialog>
    </RACPopover>
  );
}
