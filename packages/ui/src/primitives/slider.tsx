"use client";

/*
 * Slider — Radix-backed single or range value within a min/max.
 *
 *   <Slider defaultValue={50} minValue={0} maxValue={100}>
 *     <SliderOutput />
 *   </Slider>
 *
 *   <Slider defaultValue={[10, 90]} minValue={0} maxValue={100}>
 *     <SliderOutput />
 *   </Slider>
 */

import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";
import { cva } from "class-variance-authority";

import { cn } from "../utils/cn";

export const sliderRootVariants = cva("flex flex-col gap-s-2 w-full");

export const sliderTrackVariants = cva(
  "relative w-full rounded-pill data-[orientation=vertical]:h-full h-[4px] bg-l-wash-3 data-[orientation=vertical]:w-[4px]"
);

export const sliderFillVariants = cva(
  "absolute inset-y-0 left-0 rounded-pill bg-ember pointer-events-none"
);

/*
 * Radix Slider Thumb emits `data-disabled` when disabled and
 * `data-orientation`. Active drag uses the standard `:active` pseudo
 * class. Earlier `data-[dragging=true]`/`data-[focus-visible=true]`
 * (RAC vintage) never fire under Radix.
 */
export const sliderThumbVariants = cva(
  "rounded-full bg-white border border-ember shadow-card cursor-grab active:cursor-grabbing active:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember focus-visible:outline-offset-2 data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed h-[12px] w-[12px]"
);

export const sliderOutputVariants = cva(
  "self-end font-sans text-[11px] font-medium text-l-ink-dim"
);

export interface SliderProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
    "className" | "children" | "value" | "defaultValue" | "onValueChange"
  > {
  className?: string;
  value?: number | number[];
  defaultValue?: number | number[];
  onValueChange?: (value: number[]) => void;
  minValue?: number;
  maxValue?: number;
  /** Show the numeric value(s) above the track. */
  showOutput?: boolean;
  /** Show a filled track between min and the current value / between thumbs. */
  showFill?: boolean;
  ref?: React.Ref<HTMLSpanElement>;
}

function toArray(value: number | number[] | undefined) {
  return Array.isArray(value) ? value : [value ?? 0];
}

function formatOutput(value: number[]) {
  return value.length > 1 ? value.join(" – ") : (value[0] ?? 0).toString();
}

export function Slider<_T extends number | number[] = number[]>({
  className,
  value,
  defaultValue = [0],
  onValueChange,
  minValue,
  maxValue,
  showOutput = true,
  showFill = true,
  ref,
  ...rest
}: SliderProps) {
  const defaultArray = React.useMemo(() => toArray(defaultValue), [defaultValue]);
  const [uncontrolled, setUncontrolled] = React.useState(defaultArray);
  const values = value === undefined ? uncontrolled : toArray(value);

  const handleValueChange = React.useCallback(
    (next: number[]) => {
      if (value === undefined) setUncontrolled(next);
      onValueChange?.(next);
    },
    [onValueChange, value]
  );

  return (
    <SliderPrimitive.Root
      {...rest}
      ref={ref}
      min={minValue ?? rest.min}
      max={maxValue ?? rest.max}
      value={value === undefined ? undefined : toArray(value)}
      defaultValue={defaultArray}
      onValueChange={handleValueChange}
      className={cn(sliderRootVariants(), className)}
    >
      {showOutput ? (
        <output className={sliderOutputVariants()}>
          {formatOutput(values)}
        </output>
      ) : null}
      <SliderPrimitive.Track className={sliderTrackVariants()}>
        {showFill ? (
          <SliderPrimitive.Range className={sliderFillVariants()} />
        ) : null}
      </SliderPrimitive.Track>
      {values.map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          className={sliderThumbVariants()}
        />
      ))}
    </SliderPrimitive.Root>
  );
}
