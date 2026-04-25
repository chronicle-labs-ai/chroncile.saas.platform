"use client";

/*
 * Switch — iOS-style on/off toggle. RAC supplies the toggle state +
 * keyboard accessibility; we style the track and thumb.
 */

import * as React from "react";
import {
  Switch as RACSwitch,
  type SwitchProps as RACSwitchProps,
} from "react-aria-components";

import { tv } from "../utils/tv";
import { composeTwRenderProps } from "../utils/compose";

const switchStyles = tv({
  slots: {
    base:
      "inline-flex items-center gap-s-2 cursor-pointer " +
      "data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50",
    track:
      "relative inline-flex shrink-0 items-center rounded-pill " +
      "transition-colors duration-fast ease-out " +
      "data-[selected=true]:bg-ember data-[selected=true]:border-ember " +
      "data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1 " +
      "data-[focus-visible=true]:outline-ember",
    thumb:
      "inline-block rounded-full bg-white shadow-sm " +
      "transition-transform duration-fast ease-out",
    label: "font-sans text-sm text-ink",
  },
  variants: {
    size: {
      sm: {
        track: "h-[14px] w-[26px] border-0 bg-l-wash-5",
        thumb:
          "h-[10px] w-[10px] translate-x-[2px] data-[selected=true]:translate-x-[12px]",
        label: "text-[12.5px] text-l-ink",
      },
      md: {
        track: "h-[20px] w-[36px] border border-hairline-strong bg-surface-03",
        thumb:
          "h-[14px] w-[14px] translate-x-[2px] data-[selected=true]:translate-x-[18px]",
        label: "text-sm text-ink",
      },
    },
  },
  defaultVariants: { size: "md" },
});

export interface SwitchProps
  extends Omit<RACSwitchProps, "className" | "children"> {
  className?: string;
  classNames?: { base?: string; track?: string; thumb?: string; label?: string };
  children?: React.ReactNode;
  /**
   * Visual size. `"sm"` is the Linear-density 26×14 mini-toggle, `"md"`
   * (default) is the 36×20 brand-density iOS-style toggle.
   */
  size?: "sm" | "md";
}

export function Switch({
  className,
  classNames,
  children,
  size = "md",
  ...rest
}: SwitchProps) {
  const slots = switchStyles({ size });
  return (
    <RACSwitch
      {...rest}
      className={composeTwRenderProps(
        className,
        slots.base({ className: classNames?.base }),
      )}
    >
      {(state) => (
        <>
          <span
            className={slots.track({ className: classNames?.track })}
            data-selected={state.isSelected || undefined}
            data-focus-visible={state.isFocusVisible || undefined}
          >
            <span
              className={slots.thumb({ className: classNames?.thumb })}
              data-selected={state.isSelected || undefined}
            />
          </span>
          {children ? (
            <span className={slots.label({ className: classNames?.label })}>
              {children}
            </span>
          ) : null}
        </>
      )}
    </RACSwitch>
  );
}
