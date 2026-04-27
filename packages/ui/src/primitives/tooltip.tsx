"use client";

/*
 * Tooltip — hover/focus-triggered flyout with a short description of
 * the element it anchors to. Use exclusively for non-interactive content
 * — anything actionable belongs in a Popover or Menu. RAC wires in the
 * hover + focus delays, dismissal on escape, and `aria-describedby`.
 *
 *   <Tooltip content="Save changes">
 *     <Button isIconOnly>Save</Button>
 *   </Tooltip>
 */

import * as React from "react";
import {
  TooltipTrigger as RACTooltipTrigger,
  Tooltip as RACTooltip,
  OverlayArrow as RACOverlayArrow,
  type TooltipProps as RACTooltipProps,
  type TooltipTriggerComponentProps,
} from "react-aria-components";

import { tv } from "../utils/tv";
import { composeTwRenderProps } from "../utils/compose";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

const tooltipStyles = tv({
  slots: {
    tooltip:
      "z-50 border bg-surface-02 shadow-card outline-none " +
      "data-[entering=true]:animate-in data-[entering=true]:fade-in " +
      "data-[exiting=true]:animate-out data-[exiting=true]:fade-out",
    arrow: "fill-surface-02 stroke-hairline-strong",
  },
  variants: {
    density: {
      brand: {
        tooltip:
          "rounded-xs border-hairline-strong px-s-2 py-s-1 font-mono text-mono-sm text-ink",
      },
      compact: {
        tooltip:
          "rounded-l border-l-border px-[8px] py-[4px] font-sans text-[12px] font-medium text-l-ink",
      },
    },
  },
  defaultVariants: { density: "brand" },
});

export interface TooltipProps extends Omit<
  TooltipTriggerComponentProps,
  "children"
> {
  children: React.ReactElement;
  content: React.ReactNode;
  placement?: RACTooltipProps["placement"];
  showArrow?: boolean;
  className?: string;
  classNames?: { tooltip?: string; arrow?: string };
  /** Milliseconds before the tooltip appears. Defaults to RAC's 1500ms. */
  delay?: number;
  closeDelay?: number;
  density?: "compact" | "brand";
}

export function Tooltip({
  children,
  content,
  placement = "top",
  showArrow = false,
  className,
  classNames,
  delay,
  closeDelay,
  density: densityProp,
  ...rest
}: TooltipProps) {
  const density = useResolvedChromeDensity(densityProp);
  const slots = tooltipStyles({ density });
  return (
    <RACTooltipTrigger delay={delay} closeDelay={closeDelay} {...rest}>
      {children}
      <RACTooltip
        placement={placement}
        className={composeTwRenderProps(
          className ?? classNames?.tooltip,
          slots.tooltip()
        )}
      >
        {showArrow ? (
          <RACOverlayArrow>
            <svg
              viewBox="0 0 8 8"
              className={slots.arrow({ className: classNames?.arrow })}
            >
              <path d="M0 0 L4 4 L8 0" />
            </svg>
          </RACOverlayArrow>
        ) : null}
        {content}
      </RACTooltip>
    </RACTooltipTrigger>
  );
}
