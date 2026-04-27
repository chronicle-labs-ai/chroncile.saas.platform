"use client";

/*
 * NumberField — locale-aware numeric input with increment/decrement
 * buttons. RAC owns the parsing, clamping, keyboard +/-/arrow semantics,
 * and localized formatting via the `I18nProvider` at the app root.
 */

import * as React from "react";
import {
  NumberField as RACNumberField,
  Input as RACInput,
  Group as RACGroup,
  Button as RACButton,
  type NumberFieldProps as RACNumberFieldProps,
} from "react-aria-components";

import { tv } from "../utils/tv";
import { composeTwRenderProps } from "../utils/compose";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

export type NumberFieldDensity = "compact" | "brand";

const numberFieldStyles = tv({
  slots: {
    root: "flex flex-col gap-s-1",
    group:
      "flex items-stretch transition-colors duration-fast ease-out " +
      "data-[invalid=true]:border-event-red " +
      "data-[disabled=true]:opacity-50 data-[disabled=true]:cursor-not-allowed",
    input: "flex-1 bg-transparent outline-none",
    button:
      "inline-flex items-center justify-center transition-colors duration-fast ease-out " +
      "data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1 " +
      "data-[focus-visible=true]:outline-ember " +
      "data-[disabled=true]:opacity-50 data-[disabled=true]:cursor-not-allowed",
  },
  variants: {
    density: {
      compact: {
        group:
          "h-[28px] rounded-l border border-l-border bg-l-surface-input " +
          "data-[focus-within=true]:border-[rgba(216,67,10,0.5)] " +
          "data-[focus-within=true]:shadow-[0_0_0_3px_rgba(216,67,10,0.12)]",
        input:
          "px-[10px] font-sans text-[13px] text-l-ink placeholder:text-l-ink-dim",
        button:
          "h-full w-[24px] text-l-ink-dim data-[hovered=true]:bg-l-wash-3 data-[hovered=true]:text-l-ink",
      },
      brand: {
        group:
          "rounded-sm border border-hairline-strong bg-surface-00 " +
          "data-[focus-within=true]:border-ember",
        input:
          "px-s-3 py-s-2 font-mono text-mono-lg text-ink placeholder:text-ink-faint",
        button:
          "h-full w-[28px] text-ink-dim data-[hovered=true]:bg-surface-03 data-[hovered=true]:text-ink-hi",
      },
    },
  },
  defaultVariants: { density: "compact" },
});

export interface NumberFieldProps extends Omit<
  RACNumberFieldProps,
  "className" | "children"
> {
  className?: string;
  placeholder?: string;
  density?: NumberFieldDensity;
}

export function NumberField({
  className,
  placeholder,
  density: densityProp,
  ...rest
}: NumberFieldProps) {
  const density = useResolvedChromeDensity(densityProp);
  const slots = numberFieldStyles({ density });
  return (
    <RACNumberField
      {...rest}
      data-density={density}
      className={composeTwRenderProps(className, slots.root())}
    >
      <RACGroup className={slots.group()}>
        <RACButton
          slot="decrement"
          className={slots.button()}
          aria-label="Decrement"
        >
          −
        </RACButton>
        <RACInput placeholder={placeholder} className={slots.input()} />
        <RACButton
          slot="increment"
          className={slots.button()}
          aria-label="Increment"
        >
          +
        </RACButton>
      </RACGroup>
    </RACNumberField>
  );
}
