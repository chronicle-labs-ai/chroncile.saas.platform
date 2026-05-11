"use client";

/* Select compound backed by Radix Select. */

import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../utils/cn";

export const selectRootVariants = cva("flex flex-col gap-s-1 w-full");

/*
 * Radix Select emits:
 *   - Trigger: `data-state="open"|"closed"`, `data-disabled`, `data-placeholder`
 *   - Item:    `data-state="checked"|"unchecked"`, `data-disabled`, `data-highlighted`
 *   - Content: `data-state`, `data-side`, `data-align`
 *
 * Earlier revisions targeted RAC-vintage `data-[hovered=true]`,
 * `data-[focused=true]`, `data-[selected=true]`, `data-[entering=true]`
 * which never fire under Radix.
 */
export const selectTriggerVariants = cva(
  "flex w-full items-center justify-between gap-s-2 border transition-colors duration-fast ease-out outline-none text-left h-[28px] rounded-md bg-l-surface-input px-[10px] pr-[28px] font-sans text-[13px] leading-none text-l-ink " +
    "hover:border-l-border-strong " +
    "focus-visible:outline focus-visible:outline-1 focus-visible:outline-[rgba(216,67,10,0.5)] focus-visible:border-[rgba(216,67,10,0.5)] focus-visible:shadow-[0_0_0_3px_rgba(216,67,10,0.12)] " +
    "data-[state=open]:border-[rgba(216,67,10,0.5)] " +
    "data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed",
  {
    variants: {
      variant: {
        default: "border-hairline-strong",
        auth: "bg-transparent border-hairline-strong text-ink-hi focus-visible:border-ink-hi",
      },
      invalid: {
        true: "border-event-red focus-visible:border-event-red data-[state=open]:border-event-red",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export const selectValueVariants = cva(
  "truncate text-l-ink data-[placeholder]:text-ink-faint"
);

export const selectChevronVariants = cva(
  "pointer-events-none absolute top-1/2 -translate-y-1/2 transition-transform duration-fast ease-out right-[10px] h-3.5 w-3.5 text-l-ink-dim"
);

export const selectPopoverVariants = cva(
  "z-50 min-w-[var(--trigger-width)] outline-none rounded-md border border-hairline-strong bg-l-surface-raised p-[2px] shadow-panel " +
    "data-[state=open]:animate-in data-[state=open]:fade-in-0 " +
    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
);

export const selectListboxVariants = cva(
  "max-h-[320px] overflow-auto outline-none"
);

export const selectItemVariants = cva(
  "relative cursor-pointer select-none outline-none rounded-xs px-[8px] py-[5px] font-sans text-[13px] leading-none text-l-ink " +
    "data-[highlighted]:bg-l-surface-hover " +
    "data-[state=checked]:text-l-ink data-[state=checked]:bg-l-surface-selected " +
    "data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
);

export const selectSectionVariants = cva("py-s-1");

export const selectSectionHeaderVariants = cva(
  "px-[8px] pt-[6px] pb-[3px] font-sans text-[11px] font-medium tracking-normal text-l-ink-dim"
);

type SelectVariantProps = VariantProps<typeof selectTriggerVariants>;

export interface SelectProps
  extends Omit<
      React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>,
      "children"
    >,
    SelectVariantProps {
  className?: string;
  placeholder?: string;
  /** Optional controlled open state. */
  classNames?: {
    root?: string;
    trigger?: string;
    value?: string;
    popover?: string;
    listbox?: string;
  };
  children: React.ReactNode;
  selectedKey?: string;
  defaultSelectedKey?: string;
  onSelectionChange?: (key: string) => void;
}

export function Select({
  children,
  placeholder,
  variant = "default",
  invalid = false,
  className,
  classNames,
  value,
  defaultValue,
  onValueChange,
  selectedKey,
  defaultSelectedKey,
  onSelectionChange,
  ...rest
}: SelectProps) {
  return (
    <SelectPrimitive.Root
      {...rest}
      value={value ?? selectedKey}
      defaultValue={defaultValue ?? defaultSelectedKey}
      onValueChange={(next) => {
        onValueChange?.(next);
        onSelectionChange?.(next);
      }}
    >
      <div className={cn(selectRootVariants(), classNames?.root, className)}>
        <div className="relative">
          <SelectPrimitive.Trigger
            className={cn(
              selectTriggerVariants({ variant, invalid }),
              classNames?.trigger
            )}
          >
            <SelectPrimitive.Value
              placeholder={placeholder ?? "Select..."}
              className={selectValueVariants({ className: classNames?.value })}
            />
          </SelectPrimitive.Trigger>
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className={selectChevronVariants()}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
            />
          </svg>
        </div>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className={cn(selectPopoverVariants(), classNames?.popover)}
            position="popper"
          >
            <SelectPrimitive.Viewport
              className={cn(selectListboxVariants(), classNames?.listbox)}
            >
              {children}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </div>
    </SelectPrimitive.Root>
  );
}

export interface SelectItemProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>,
    "className" | "value"
  > {
  className?: string;
  value?: string;
  id?: string;
}

export function SelectItem({
  className,
  value,
  id,
  ...props
}: SelectItemProps) {
  return (
    <SelectPrimitive.Item
      {...props}
      value={value ?? id ?? ""}
      className={cn(selectItemVariants(), className)}
    >
      <SelectPrimitive.ItemText>{props.children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export interface SelectSectionProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof SelectPrimitive.Group>,
    "className" | "children" | "title"
  > {
  className?: string;
  /** Section title rendered as a non-interactive group header. */
  title?: React.ReactNode;
  children?: React.ReactNode;
}

export function SelectSection({
  className,
  title,
  children,
  ...rest
}: SelectSectionProps) {
  return (
    <SelectPrimitive.Group
      {...rest}
      className={selectSectionVariants({ className })}
    >
      {title ? (
        <SelectPrimitive.Label className={selectSectionHeaderVariants()}>
          {title}
        </SelectPrimitive.Label>
      ) : null}
      {children as React.ReactNode}
    </SelectPrimitive.Group>
  );
}
