"use client";

/*
 * Combobox — a text input paired with a filterable listbox.
 *
 *   <Combobox
 *     placeholder="Pick a source"
 *     defaultSelectedKey="intercom"
 *     onSelectionChange={setValue}
 *   >
 *     <ComboboxItem id="intercom">Intercom</ComboboxItem>
 *     <ComboboxItem id="shopify">Shopify</ComboboxItem>
 *   </Combobox>
 *
 * Uses native input/button semantics and a lightweight popover list.
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../utils/cn";

export const comboboxRootVariants = cva("flex flex-col gap-s-1 w-full");
export const comboboxInputWrapperVariants = cva("relative");

export const comboboxInputVariants = cva(
  "w-full border outline-none transition-colors duration-fast ease-out data-[invalid=true]:border-event-red disabled:opacity-50 disabled:cursor-not-allowed h-[28px] rounded-md bg-l-surface-input px-[10px] pr-[28px] font-sans text-[13px] leading-none text-l-ink placeholder:text-l-ink-dim hover:border-l-border-strong focus:border-[rgba(216,67,10,0.5)] focus:shadow-[0_0_0_3px_rgba(216,67,10,0.12)]",
  {
    variants: {
      variant: {
        default: "border-hairline-strong",
        auth: "bg-transparent border-hairline-strong text-ink-hi focus:border-ink-hi",
      },
      invalid: {
        true: "border-event-red focus:border-event-red",
      },
    },
    compoundVariants: [
      { variant: "default", className: "border-hairline-strong" },
    ],
    defaultVariants: {
      variant: "default",
    },
  }
);

export const comboboxButtonVariants = cva(
  "absolute top-1/2 -translate-y-1/2 inline-flex items-center justify-center outline-none focus-visible:outline focus-visible:outline-1 right-[8px] h-4 w-4 text-l-ink-dim hover:text-l-ink focus-visible:outline-[rgba(216,67,10,0.5)]"
);

export const comboboxPopoverVariants = cva(
  "z-50 min-w-[var(--trigger-width)] outline-none rounded-md border border-hairline-strong bg-l-surface-raised p-[2px] shadow-panel animate-in fade-in-0"
);

export const comboboxListboxVariants = cva(
  "max-h-[320px] overflow-auto outline-none"
);

/*
 * Combobox items are plain `<button>`s. The `data-selected` attribute is
 * set manually in the component (`data-selected={selected || undefined}`)
 * so `data-[selected=true]:` is the correct selector.
 */
export const comboboxItemVariants = cva(
  "relative cursor-pointer select-none outline-none disabled:opacity-50 disabled:cursor-not-allowed rounded-xs px-[8px] py-[5px] font-sans text-[13px] leading-none text-l-ink hover:bg-l-surface-hover focus-visible:bg-l-surface-hover data-[selected=true]:text-l-ink data-[selected=true]:bg-l-surface-selected"
);

export const comboboxSectionVariants = cva("py-s-1");

export const comboboxSectionHeaderVariants = cva(
  "px-[8px] pt-[6px] pb-[3px] font-sans text-[11px] font-medium tracking-normal text-l-ink-dim"
);

export const comboboxEmptyVariants = cva(
  "px-[10px] py-[12px] font-sans text-[12px] text-l-ink-dim"
);

type ComboboxVariantProps = VariantProps<typeof comboboxInputVariants>;

export interface ComboboxProps
  extends Omit<
      React.HTMLAttributes<HTMLDivElement>,
      "className" | "children" | "onChange"
    >,
    ComboboxVariantProps {
  className?: string;
  classNames?: {
    root?: string;
    input?: string;
    popover?: string;
    listbox?: string;
  };
  placeholder?: string;
  emptyMessage?: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  selectedKey?: string;
  defaultSelectedKey?: string;
  onSelectionChange?: (value: string) => void;
  children: React.ReactNode;
}

const ComboboxSelectionContext = React.createContext<{
  value?: string;
  onSelect?: (value: string, label: React.ReactNode) => void;
}>({});

export function Combobox({
  className,
  classNames,
  placeholder,
  variant = "default",
  invalid = false,
  emptyMessage = "No matches",
  value,
  defaultValue = "",
  onValueChange,
  selectedKey,
  defaultSelectedKey,
  onSelectionChange,
  children,
  ...rest
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const resolvedValue = value ?? selectedKey;
  const resolvedDefaultValue = defaultValue || defaultSelectedKey || "";
  const [inputValue, setInputValue] = React.useState(resolvedDefaultValue);
  const currentValue = resolvedValue ?? inputValue;

  const setValue = React.useCallback(
    (next: string) => {
      if (value === undefined) setInputValue(next);
      onValueChange?.(next);
      onSelectionChange?.(next);
    },
    [onSelectionChange, onValueChange, value]
  );

  return (
    <div
      {...rest}
      className={cn(comboboxRootVariants(), classNames?.root, className)}
    >
      <div className={comboboxInputWrapperVariants()}>
        <input
          value={currentValue}
          onChange={(event) => {
            setValue(event.currentTarget.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={cn(
            comboboxInputVariants({ variant, invalid }),
            classNames?.input
          )}
        />
        <button
          type="button"
          onClick={() => setOpen((next) => !next)}
          className={comboboxButtonVariants()}
          aria-label="Toggle options"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
            <path
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      {open ? (
        <div
          className={cn(
            comboboxPopoverVariants(),
            "absolute z-50 mt-[4px]",
            classNames?.popover
          )}
        >
          <ComboboxSelectionContext.Provider
            value={{
              value: currentValue,
              onSelect: (next, label) => {
                setValue(typeof label === "string" ? label : next);
                setOpen(false);
              },
            }}
          >
            <div
              role="listbox"
              className={cn(comboboxListboxVariants(), classNames?.listbox)}
            >
              {children ? (
                children
              ) : (
                <div className={comboboxEmptyVariants()}>{emptyMessage}</div>
              )}
            </div>
          </ComboboxSelectionContext.Provider>
        </div>
      ) : null}
    </div>
  );
}

export interface ComboboxItemProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "className" | "value"
  > {
  className?: string;
  value?: string;
  id?: string;
}

export function ComboboxItem({
  className,
  value,
  id,
  onClick,
  children,
  ...props
}: ComboboxItemProps) {
  const selection = React.useContext(ComboboxSelectionContext);
  const itemValue = value ?? id ?? "";
  const selected = selection.value === itemValue;

  return (
    <button
      {...props}
      type="button"
      role="option"
      aria-selected={selected}
      data-selected={selected || undefined}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) selection.onSelect?.(itemValue, children);
      }}
      className={cn(comboboxItemVariants(), className)}
    >
      {children}
    </button>
  );
}

export interface ComboboxSectionProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    "className" | "children" | "title"
  > {
  className?: string;
  title?: React.ReactNode;
  children?: React.ReactNode;
}

export function ComboboxSection({
  className,
  title,
  children,
  ...rest
}: ComboboxSectionProps) {
  return (
    <div
      {...rest}
      role="group"
      className={comboboxSectionVariants({ className })}
    >
      {title ? (
        <div className={comboboxSectionHeaderVariants()}>{title}</div>
      ) : null}
      {children as React.ReactNode}
    </div>
  );
}
