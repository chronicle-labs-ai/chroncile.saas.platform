"use client";

/*
 * RadioGroup + Radio — single-select exclusive choice. Keyboard nav
 * (arrows), focus rings, required/invalid ARIA all come from RAC.
 *
 *   <RadioGroup value={v} onChange={setV}>
 *     <Radio value="stg">Staging</Radio>
 *     <Radio value="prod">Production</Radio>
 *   </RadioGroup>
 */

import * as React from "react";
import {
  RadioGroup as RACRadioGroup,
  Radio as RACRadio,
  type RadioGroupProps as RACRadioGroupProps,
  type RadioProps as RACRadioProps,
} from "react-aria-components";

import { tv } from "../utils/tv";
import { composeTwRenderProps } from "../utils/compose";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

const radioStyles = tv({
  slots: {
    group: "flex flex-col gap-s-2 data-[orientation=horizontal]:flex-row",
    radio:
      "inline-flex items-center gap-s-2 cursor-pointer " +
      "data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50",
    indicator:
      "relative flex shrink-0 items-center justify-center rounded-full " +
      "transition-colors duration-fast ease-out " +
      "data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1 " +
      "data-[focus-visible=true]:outline-ember " +
      "data-[selected=true]:border-ember " +
      "data-[invalid=true]:border-event-red",
    dot: "rounded-full bg-ember opacity-0 data-[selected=true]:opacity-100",
    label: "font-sans text-sm text-ink",
  },
  variants: {
    size: {
      sm: {
        indicator:
          "h-[14px] w-[14px] border border-l-border-strong bg-transparent " +
          "data-[hovered=true]:border-l-border-hover",
        dot: "h-[6px] w-[6px]",
        label: "text-[12.5px] text-l-ink",
      },
      md: {
        indicator:
          "h-[16px] w-[16px] border border-hairline-strong bg-surface-00 " +
          "data-[hovered=true]:border-ink-dim",
        dot: "h-[6px] w-[6px]",
        label: "text-sm text-ink",
      },
    },
  },
  defaultVariants: { size: "md" },
});

export type RadioSize = "sm" | "md";

export interface RadioGroupProps extends Omit<
  RACRadioGroupProps,
  "className" | "children"
> {
  className?: string;
  children: React.ReactNode;
  /**
   * Default size for Radios inside this group. Individual `<Radio size>`
   * still wins. Reach for `"sm"` on Linear-density product surfaces.
   * When omitted, the surrounding `ChromeStyleProvider` decides
   * (`compact` → `sm`, `brand` → `md`).
   */
  size?: RadioSize;
  /** Explicit density override (alias for choosing between `sm` and `md`). */
  density?: "compact" | "brand";
}

const RadioSizeContext = React.createContext<RadioSize>("md");

export function RadioGroup({
  className,
  children,
  size,
  density: densityProp,
  ...rest
}: RadioGroupProps) {
  const density = useResolvedChromeDensity(densityProp);
  const resolvedSize: RadioSize = size ?? (density === "compact" ? "sm" : "md");
  const slots = radioStyles({ size: resolvedSize });
  return (
    <RACRadioGroup
      {...rest}
      data-density={density}
      className={composeTwRenderProps(className, slots.group())}
    >
      <RadioSizeContext.Provider value={resolvedSize}>
        {children as React.ReactNode}
      </RadioSizeContext.Provider>
    </RACRadioGroup>
  );
}

export interface RadioProps extends Omit<
  RACRadioProps,
  "className" | "children"
> {
  className?: string;
  classNames?: {
    base?: string;
    indicator?: string;
    dot?: string;
    label?: string;
  };
  children?: React.ReactNode;
  size?: RadioSize;
}

export function Radio({
  className,
  classNames,
  children,
  size,
  ...rest
}: RadioProps) {
  const ctxSize = React.useContext(RadioSizeContext);
  const resolved: RadioSize = size ?? ctxSize;
  const slots = radioStyles({ size: resolved });
  return (
    <RACRadio
      {...rest}
      className={composeTwRenderProps(
        className,
        slots.radio({ className: classNames?.base })
      )}
    >
      <span className={slots.indicator({ className: classNames?.indicator })}>
        <span className={slots.dot({ className: classNames?.dot })} />
      </span>
      {children ? (
        <span className={slots.label({ className: classNames?.label })}>
          {children}
        </span>
      ) : null}
    </RACRadio>
  );
}
