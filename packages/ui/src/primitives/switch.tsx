"use client";

/*
 * Switch — iOS-style on/off toggle backed by Radix Switch.
 */

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cva } from "class-variance-authority";

import { cn } from "../utils/cn";

/*
 * Switch composes Radix Switch.Root which emits `data-state="checked"|
 * "unchecked"` and `data-disabled`. The component additionally sets
 * `data-selected` on the inner track/thumb spans for the existing
 * Chronicle styles that target `data-[selected=true]:`.
 */
export const switchBaseVariants = cva(
  "group inline-flex items-center gap-s-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 outline-none"
);

export const switchTrackVariants = cva(
  "relative inline-flex shrink-0 items-center rounded-pill transition-colors duration-fast ease-out data-[selected=true]:bg-ember data-[selected=true]:border-ember group-focus-visible:outline group-focus-visible:outline-1 group-focus-visible:outline-ember",
  {
    variants: {
      size: {
        sm: "h-[14px] w-[26px] border-0 bg-l-wash-5",
        md: "h-[20px] w-[36px] border border-hairline-strong bg-surface-03",
      },
    },
    defaultVariants: {
      size: "sm",
    },
  }
);

export const switchThumbVariants = cva(
  "inline-block rounded-full bg-white shadow-sm transition-transform duration-fast ease-out",
  {
    variants: {
      size: {
        sm: "h-[10px] w-[10px] translate-x-[2px] data-[selected=true]:translate-x-[12px]",
        md: "h-[14px] w-[14px] translate-x-[2px] data-[selected=true]:translate-x-[18px]",
      },
    },
    defaultVariants: {
      size: "sm",
    },
  }
);

export const switchLabelVariants = cva("font-sans text-sm text-ink", {
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

export interface SwitchProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>,
    "className" | "children"
  > {
  className?: string;
  classNames?: {
    base?: string;
    track?: string;
    thumb?: string;
    label?: string;
  };
  children?: React.ReactNode;
  /** Visual size. `"sm"` is the Linear-density 26×14 mini-toggle, `"md"`
   * is the larger 36×20 iOS-style toggle. */
  size?: "sm" | "md";
  isDisabled?: boolean;
  defaultSelected?: boolean;
  isSelected?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

export function Switch({
  className,
  classNames,
  children,
  size = "sm",
  checked,
  defaultChecked,
  isSelected,
  defaultSelected,
  onCheckedChange,
  disabled,
  isDisabled,
  ref,
  ...rest
}: SwitchProps) {
  const resolvedChecked = checked ?? isSelected;
  const resolvedDefaultChecked = defaultChecked ?? defaultSelected;
  const resolvedDisabled = disabled ?? isDisabled;
  const [uncontrolled, setUncontrolled] = React.useState(
    resolvedDefaultChecked ?? false
  );
  const selected = resolvedChecked ?? uncontrolled;

  const handleCheckedChange = React.useCallback(
    (next: boolean) => {
      if (resolvedChecked === undefined) setUncontrolled(next);
      onCheckedChange?.(next);
    },
    [onCheckedChange, resolvedChecked]
  );

  return (
    <SwitchPrimitive.Root
      {...rest}
      ref={ref}
      checked={resolvedChecked}
      defaultChecked={resolvedDefaultChecked}
      onCheckedChange={handleCheckedChange}
      disabled={resolvedDisabled}
      data-disabled={resolvedDisabled || undefined}
      className={cn(
        switchBaseVariants({ className: classNames?.base }),
        className
      )}
    >
      <span
        className={switchTrackVariants({
          size,
          className: classNames?.track,
        })}
        data-selected={selected || undefined}
      >
        <SwitchPrimitive.Thumb
          className={switchThumbVariants({
            size,
            className: classNames?.thumb,
          })}
          data-selected={selected || undefined}
        />
      </span>
      {children ? (
        <span
          className={switchLabelVariants({
            size,
            className: classNames?.label,
          })}
        >
          {children}
        </span>
      ) : null}
    </SwitchPrimitive.Root>
  );
}
