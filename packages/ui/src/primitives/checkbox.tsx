"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../utils/cn";

/*
 * Checkbox is wrapped around Radix `Checkbox.Root` (a `<button>`) but
 * the box and mark live on inner `<div>`/`<svg>` nodes where the
 * `data-selected`/`data-indeterminate`/`data-disabled` attributes are
 * set imperatively in the component. Hover/focus styles use CSS pseudo
 * classes via `group-` selectors so they fire from the outer button.
 */
export const checkboxBaseVariants = cva(
  "group inline-flex items-center gap-s-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 outline-none"
);

export const checkboxBoxVariants = cva(
  "relative flex shrink-0 items-center justify-center transition-colors duration-fast ease-out group-focus-visible:outline group-focus-visible:outline-1 group-focus-visible:outline-ember data-[selected=true]:bg-ember data-[selected=true]:border-ember data-[indeterminate=true]:bg-ember data-[indeterminate=true]:border-ember data-[invalid=true]:border-event-red",
  {
    variants: {
      variant: {
        default: "",
        auth: "bg-transparent",
      },
      size: {
        sm: "h-[14px] w-[14px] rounded-xs border border-l-border-strong bg-transparent group-hover:border-l-border-hover",
        md: "h-[16px] w-[16px] rounded-xs border border-hairline-strong bg-surface-00 group-hover:border-ink-dim",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  }
);

export const checkboxMarkVariants = cva(
  "stroke-white stroke-[3] opacity-0 data-[selected=true]:opacity-100 data-[indeterminate=true]:opacity-100",
  {
    variants: {
      size: {
        sm: "h-[10px] w-[10px]",
        md: "h-[10px] w-[10px]",
      },
    },
    defaultVariants: {
      size: "sm",
    },
  }
);

export const checkboxLabelVariants = cva("font-sans text-l-ink", {
  variants: {
    size: {
      sm: "text-[13px]",
      md: "text-[14px]",
    },
  },
  defaultVariants: {
    size: "sm",
  },
});

type CheckboxVariantProps = VariantProps<typeof checkboxBoxVariants>;

export interface CheckboxProps
  extends Omit<
      React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
      "className" | "children" | "onChange"
    >,
    CheckboxVariantProps {
  className?: string;
  classNames?: {
    base?: string;
    box?: string;
    mark?: string;
    label?: string;
  };
  /**
   * Visual size. `"sm"` (14 px, default — Linear-density product
   * chrome) or `"md"` (16 px, larger tap target for marketing /
   * onboarding surfaces).
   */
  size?: "sm" | "md";
  /** Native-style selection (alias for `isSelected`). */
  checked?: boolean | "indeterminate";
  defaultChecked?: boolean | "indeterminate";
  isSelected?: boolean;
  defaultSelected?: boolean;
  isDisabled?: boolean;
  onChange?: (checked: boolean) => void;
  ref?: React.Ref<HTMLButtonElement>;
  variant?: "default" | "auth";
  children?: React.ReactNode;
}

export function Checkbox({
  checked,
  defaultChecked,
  isSelected: selectedProp,
  defaultSelected,
  disabled,
  isDisabled,
  onChange,
  onCheckedChange,
  className,
  classNames,
  variant = "default",
  size = "sm",
  ref,
  children,
  ...rest
}: CheckboxProps) {
  const resolvedChecked = checked ?? selectedProp;
  const resolvedDefaultChecked = defaultChecked ?? defaultSelected;
  const resolvedDisabled = disabled ?? isDisabled;
  const [uncontrolled, setUncontrolled] = React.useState(
    resolvedDefaultChecked ?? false
  );
  const selected = resolvedChecked ?? uncontrolled;
  const isSelected = selected === true || selected === "indeterminate";

  const handleCheckedChange = React.useCallback(
    (next: boolean | "indeterminate") => {
      if (resolvedChecked === undefined) setUncontrolled(next);
      onCheckedChange?.(next);
      onChange?.(next === true);
    },
    [onChange, onCheckedChange, resolvedChecked]
  );

  return (
    <CheckboxPrimitive.Root
      {...rest}
      ref={ref}
      checked={resolvedChecked}
      defaultChecked={resolvedDefaultChecked}
      disabled={resolvedDisabled}
      onCheckedChange={handleCheckedChange}
      data-disabled={resolvedDisabled || undefined}
      className={cn(
        checkboxBaseVariants({ className: classNames?.base }),
        className
      )}
    >
      <div
        className={checkboxBoxVariants({
          variant,
          size,
          className: classNames?.box,
        })}
        data-selected={isSelected || undefined}
        data-indeterminate={selected === "indeterminate" || undefined}
      >
        <CheckboxPrimitive.Indicator forceMount>
          <svg
            aria-hidden
            viewBox="0 0 18 18"
            fill="none"
            className={checkboxMarkVariants({
              size,
              className: classNames?.mark,
            })}
            data-selected={isSelected || undefined}
            data-indeterminate={selected === "indeterminate" || undefined}
          >
            <polyline points="1 9 7 14 15 4" />
          </svg>
        </CheckboxPrimitive.Indicator>
      </div>
      {children ? (
        <span
          className={checkboxLabelVariants({
            size,
            className: classNames?.label,
          })}
        >
          {children}
        </span>
      ) : null}
    </CheckboxPrimitive.Root>
  );
}
