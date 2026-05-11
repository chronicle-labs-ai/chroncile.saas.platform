"use client";

/*
 * SearchField — a text input with an auto-managed clear button and ESC
 * to clear.
 */

import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "../utils/cn";

export const searchFieldRootVariants = cva(
  "relative flex w-full items-center transition-colors duration-fast ease-out h-[28px] rounded-md border border-hairline-strong bg-l-surface-input pl-[34px] pr-[6px] focus-within:border-[rgba(216,67,10,0.5)] focus-within:shadow-[0_0_0_3px_rgba(216,67,10,0.12)] has-[input:disabled]:opacity-50"
);

export const searchFieldInputVariants = cva(
  "flex-1 bg-transparent outline-none font-sans text-[13px] text-l-ink placeholder:text-l-ink-dim"
);

export const searchFieldIconVariants = cva(
  "pointer-events-none absolute top-1/2 -translate-y-1/2 left-[10px] h-[14px] w-[14px] text-l-ink-dim"
);

export const searchFieldClearVariants = cva(
  "inline-flex items-center justify-center rounded-md transition-colors duration-fast ease-out focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember h-[20px] w-[20px] text-l-ink-dim hover:text-l-ink hover:bg-l-wash-3 disabled:invisible"
);

export interface SearchFieldProps {
  className?: string;
  placeholder?: string;
  /** Controlled value. */
  value?: string;
  /** Fires with the latest value as the user types or clears. */
  onChange?: (value: string) => void;
  /** Uncontrolled initial value. */
  defaultValue?: string;
  /** Fires when the user submits (Enter). */
  onSubmit?: (value: string) => void;
  /** Fires when the clear button is pressed (after `onChange("")`). */
  onClear?: () => void;
  /** Required when no surrounding `<label>` is present. */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** Form name (for use inside `<form>` POSTs). */
  name?: string;
  /** Disable input + clear button. */
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
}

export function SearchField({
  className,
  placeholder,
  value,
  onChange,
  defaultValue,
  onSubmit,
  onClear,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  name,
  disabled,
  autoFocus,
  id,
}: SearchFieldProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
  const currentValue = value ?? internalValue;

  const setValue = React.useCallback(
    (next: string) => {
      if (value === undefined) setInternalValue(next);
      onChange?.(next);
    },
    [onChange, value]
  );

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(currentValue);
      }}
      className={cn(searchFieldRootVariants(), className)}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className={searchFieldIconVariants()}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
      </svg>
      <input
        id={id}
        name={name}
        value={currentValue}
        onChange={(event) => setValue(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && currentValue) {
            setValue("");
            onClear?.();
          }
        }}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        placeholder={placeholder}
        className={searchFieldInputVariants()}
      />
      <button
        type="button"
        disabled={disabled || !currentValue}
        onClick={() => {
          setValue("");
          onClear?.();
        }}
        className={searchFieldClearVariants()}
        aria-label="Clear"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3">
          <path
            d="M6 18L18 6M6 6l12 12"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </svg>
      </button>
    </form>
  );
}
