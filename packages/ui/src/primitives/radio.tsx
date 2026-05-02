"use client";

/*
 * RadioGroup + Radio — single-select exclusive choice. Keyboard nav
 * and ARIA state are provided by Radix RadioGroup.
 *
 *   <RadioGroup value={v} onChange={setV}>
 *     <Radio value="stg">Staging</Radio>
 *     <Radio value="prod">Production</Radio>
 *   </RadioGroup>
 */

import * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { cva } from "class-variance-authority";

import { cn } from "../utils/cn";

export const radioGroupVariants = cva(
  "flex flex-col gap-s-2 data-[orientation=horizontal]:flex-row"
);

/*
 * Radio is wrapped around Radix `RadioGroup.Item` (a `<button>`). The
 * indicator/dot live on inner `<span>` nodes where `data-selected` is
 * set imperatively. Hover/focus styles use the `group-` selectors so
 * they fire from the outer button (which gets the CSS pseudo states).
 */
export const radioBaseVariants = cva(
  "group inline-flex items-center gap-s-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 outline-none"
);

export const radioIndicatorVariants = cva(
  "relative flex shrink-0 items-center justify-center rounded-full transition-colors duration-fast ease-out group-focus-visible:outline group-focus-visible:outline-1 group-focus-visible:outline-ember data-[selected=true]:border-ember data-[invalid=true]:border-event-red",
  {
    variants: {
      size: {
        sm: "h-[14px] w-[14px] border border-l-border-strong bg-transparent group-hover:border-l-border-hover",
        md: "h-[16px] w-[16px] border border-hairline-strong bg-surface-00 group-hover:border-ink-dim",
      },
    },
    defaultVariants: {
      size: "sm",
    },
  }
);

export const radioDotVariants = cva(
  "rounded-full bg-ember opacity-0 data-[selected=true]:opacity-100",
  {
    variants: {
      size: {
        sm: "h-[6px] w-[6px]",
        md: "h-[6px] w-[6px]",
      },
    },
    defaultVariants: {
      size: "sm",
    },
  }
);

export const radioLabelVariants = cva("font-sans text-sm text-ink", {
  variants: {
    size: {
      sm: "text-[12.5px] text-l-ink",
      md: "text-sm text-ink",
    },
  },
  defaultVariants: {
    size: "sm",
  },
});

export type RadioSize = "sm" | "md";

export interface RadioGroupProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>,
    "className" | "children"
  > {
  className?: string;
  children: React.ReactNode;
  /**
   * Default size for Radios inside this group. Individual `<Radio size>`
   * still wins. `"sm"` is the Linear-density product default.
   */
  size?: RadioSize;
  ref?: React.Ref<HTMLDivElement>;
}

const RadioSizeContext = React.createContext<RadioSize>("sm");
const RadioValueContext = React.createContext<string | undefined>(undefined);

export function RadioGroup({
  className,
  children,
  size = "sm",
  value,
  defaultValue,
  onValueChange,
  ref,
  ...rest
}: RadioGroupProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
  const selectedValue = value ?? uncontrolled;

  const handleValueChange = React.useCallback(
    (next: string) => {
      if (value === undefined) setUncontrolled(next);
      onValueChange?.(next);
    },
    [onValueChange, value]
  );

  return (
    <RadioGroupPrimitive.Root
      {...rest}
      ref={ref}
      value={value}
      defaultValue={defaultValue}
      onValueChange={handleValueChange}
      className={cn(radioGroupVariants(), className)}
    >
      <RadioSizeContext.Provider value={size}>
        <RadioValueContext.Provider value={selectedValue}>
          {children as React.ReactNode}
        </RadioValueContext.Provider>
      </RadioSizeContext.Provider>
    </RadioGroupPrimitive.Root>
  );
}

export interface RadioProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>,
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
  ref?: React.Ref<HTMLButtonElement>;
}

export function Radio({
  className,
  classNames,
  children,
  size,
  ref,
  value,
  disabled,
  ...rest
}: RadioProps) {
  const ctxSize = React.useContext(RadioSizeContext);
  const selectedValue = React.useContext(RadioValueContext);
  const resolved: RadioSize = size ?? ctxSize;
  const selected = selectedValue === value;

  return (
    <RadioGroupPrimitive.Item
      {...rest}
      ref={ref}
      value={value}
      disabled={disabled}
      data-disabled={disabled || undefined}
      className={cn(
        radioBaseVariants({ className: classNames?.base }),
        className
      )}
    >
      <span
        className={radioIndicatorVariants({
          size: resolved,
          className: classNames?.indicator,
        })}
        data-selected={selected || undefined}
      >
        <RadioGroupPrimitive.Indicator forceMount>
          <span
            className={radioDotVariants({
              size: resolved,
              className: classNames?.dot,
            })}
            data-selected={selected || undefined}
          />
        </RadioGroupPrimitive.Indicator>
      </span>
      {children ? (
        <span
          className={radioLabelVariants({
            size: resolved,
            className: classNames?.label,
          })}
        >
          {children}
        </span>
      ) : null}
    </RadioGroupPrimitive.Item>
  );
}
