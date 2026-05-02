"use client";

/*
 * NumberField — numeric input with increment/decrement controls.
 */

import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "../utils/cn";

export const numberFieldRootVariants = cva("flex flex-col gap-s-1");

export const numberFieldGroupVariants = cva(
  "flex items-stretch transition-colors duration-fast ease-out data-[invalid=true]:border-event-red has-[input:disabled]:opacity-50 has-[input:disabled]:cursor-not-allowed h-[28px] rounded-md border border-hairline-strong bg-l-surface-input focus-within:border-[rgba(216,67,10,0.5)] focus-within:shadow-[0_0_0_3px_rgba(216,67,10,0.12)]"
);

export const numberFieldInputVariants = cva(
  "flex-1 bg-transparent outline-none px-[10px] font-sans text-[13px] text-l-ink placeholder:text-l-ink-dim"
);

export const numberFieldButtonVariants = cva(
  "inline-flex items-center justify-center transition-colors duration-fast ease-out focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember disabled:opacity-50 disabled:cursor-not-allowed h-full w-[24px] text-l-ink-dim hover:bg-l-wash-3 hover:text-l-ink"
);

export interface NumberFieldProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "className" | "children" | "value" | "defaultValue" | "onChange" | "type"
  > {
  className?: string;
  placeholder?: string;
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  onChange?: (value: number) => void;
  minValue?: number;
  maxValue?: number;
  formatOptions?: Intl.NumberFormatOptions;
}

export function NumberField({
  className,
  placeholder,
  value,
  defaultValue = 0,
  onValueChange,
  onChange,
  min,
  max,
  minValue,
  maxValue,
  formatOptions: _formatOptions,
  step = 1,
  disabled,
  ...rest
}: NumberFieldProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const currentValue = value ?? internalValue;
  const numericStep = typeof step === "number" ? step : Number(step) || 1;
  const resolvedMin = minValue ?? (min === undefined ? undefined : Number(min));
  const resolvedMax = maxValue ?? (max === undefined ? undefined : Number(max));

  const setValue = React.useCallback(
    (next: number) => {
      const clamped = Math.min(
        resolvedMax ?? Number.POSITIVE_INFINITY,
        Math.max(resolvedMin ?? Number.NEGATIVE_INFINITY, next)
      );
      if (value === undefined) setInternalValue(clamped);
      onValueChange?.(clamped);
      onChange?.(clamped);
    },
    [onChange, onValueChange, resolvedMax, resolvedMin, value]
  );

  return (
    <div className={cn(numberFieldRootVariants(), className)}>
      <div className={numberFieldGroupVariants()}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setValue(currentValue - numericStep)}
          className={numberFieldButtonVariants()}
          aria-label="Decrement"
        >
          −
        </button>
        <input
          {...rest}
          type="number"
          value={currentValue}
          min={resolvedMin}
          max={resolvedMax}
          step={step}
          disabled={disabled}
          onChange={(event) => setValue(event.currentTarget.valueAsNumber || 0)}
          placeholder={placeholder}
          className={numberFieldInputVariants()}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setValue(currentValue + numericStep)}
          className={numberFieldButtonVariants()}
          aria-label="Increment"
        >
          +
        </button>
      </div>
    </div>
  );
}
