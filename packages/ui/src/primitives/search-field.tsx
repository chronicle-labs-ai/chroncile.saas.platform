"use client";

/*
 * SearchField — a text input with an auto-managed clear button and ESC
 * to clear. RAC wires in the clear button's press handler and the
 * keyboard semantics; we just style it.
 *
 * Contract is intentionally explicit (does NOT extend
 * `RACSearchFieldProps`). Each forwarded prop is plucked + passed by
 * name below, so consumers (e.g. `SelectWorkspace`) don't depend on
 * RAC's compound state shape — if RAC ever renames a prop, only this
 * single forward point breaks at compile time, never callers.
 */

import * as React from "react";
import {
  SearchField as RACSearchField,
  Input as RACInput,
  Button as RACButton,
} from "react-aria-components";

import { tv } from "../utils/tv";
import { composeTwRenderProps } from "../utils/compose";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

export type SearchFieldDensity = "compact" | "brand";

const searchFieldStyles = tv({
  slots: {
    root: "relative flex w-full items-center transition-colors duration-fast ease-out",
    input: "flex-1 bg-transparent outline-none data-[empty=true]:pr-0",
    icon: "pointer-events-none absolute top-1/2 -translate-y-1/2",
    clear:
      "inline-flex items-center justify-center rounded-l " +
      "transition-colors duration-fast ease-out " +
      "data-[empty=true]:hidden " +
      "data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1 " +
      "data-[focus-visible=true]:outline-ember",
  },
  variants: {
    density: {
      compact: {
        root:
          "h-[28px] rounded-l border border-l-border bg-l-surface-input pl-[34px] pr-[6px] " +
          "data-[focus-within=true]:border-[rgba(216,67,10,0.5)] " +
          "data-[focus-within=true]:shadow-[0_0_0_3px_rgba(216,67,10,0.12)] " +
          "data-[disabled=true]:opacity-50",
        input: "font-sans text-[13px] text-l-ink placeholder:text-l-ink-dim",
        icon: "left-[10px] h-[14px] w-[14px] text-l-ink-dim",
        clear:
          "h-[20px] w-[20px] text-l-ink-dim data-[hovered=true]:text-l-ink data-[hovered=true]:bg-l-wash-3",
      },
      brand: {
        root:
          "rounded-sm border border-hairline-strong bg-surface-00 pl-[40px] pr-[8px] " +
          "data-[focus-within=true]:border-ember data-[disabled=true]:opacity-50",
        input:
          "py-s-2 font-mono text-mono-lg text-ink placeholder:text-ink-faint",
        icon: "left-s-3 h-4 w-4 text-ink-dim",
        clear:
          "h-6 w-6 text-ink-dim data-[hovered=true]:text-ink-hi data-[hovered=true]:bg-surface-03",
      },
    },
  },
  defaultVariants: { density: "compact" },
});

export interface SearchFieldProps {
  className?: string;
  placeholder?: string;
  density?: SearchFieldDensity;
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
  isDisabled?: boolean;
  autoFocus?: boolean;
  id?: string;
}

export function SearchField({
  className,
  placeholder,
  density: densityProp,
  value,
  onChange,
  defaultValue,
  onSubmit,
  onClear,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  name,
  isDisabled,
  autoFocus,
  id,
}: SearchFieldProps) {
  const density = useResolvedChromeDensity(densityProp);
  const slots = searchFieldStyles({ density });
  return (
    <RACSearchField
      value={value}
      onChange={onChange}
      defaultValue={defaultValue}
      onSubmit={onSubmit}
      onClear={onClear}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      name={name}
      isDisabled={isDisabled}
      autoFocus={autoFocus}
      id={id}
      data-density={density}
      className={composeTwRenderProps(className, slots.root())}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className={slots.icon()}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
      </svg>
      <RACInput placeholder={placeholder} className={slots.input()} />
      <RACButton className={slots.clear()} aria-label="Clear">
        <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3">
          <path
            d="M6 18L18 6M6 6l12 12"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </svg>
      </RACButton>
    </RACSearchField>
  );
}
