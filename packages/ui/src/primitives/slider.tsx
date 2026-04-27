"use client";

/*
 * Slider — single or range value within a min/max. RAC owns keyboard
 * (arrow/home/end/page), drag, and multi-thumb state; we style the
 * track, fill, and thumb.
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
import {
  Slider as RACSlider,
  SliderTrack as RACSliderTrack,
  SliderThumb as RACSliderThumb,
  SliderOutput as RACSliderOutput,
  type SliderProps as RACSliderProps,
} from "react-aria-components";

import { tv } from "../utils/tv";
import { composeTwRenderProps } from "../utils/compose";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

const sliderStyles = tv({
  slots: {
    root: "flex flex-col gap-s-2 w-full",
    track:
      "relative w-full rounded-pill " +
      "data-[orientation=vertical]:h-full",
    fill: "absolute inset-y-0 left-0 rounded-pill bg-ember pointer-events-none",
    thumb:
      "rounded-full bg-white border border-ember " +
      "shadow-card cursor-grab " +
      "data-[dragging=true]:cursor-grabbing data-[dragging=true]:scale-110 " +
      "data-[focus-visible=true]:outline data-[focus-visible=true]:outline-2 " +
      "data-[focus-visible=true]:outline-ember data-[focus-visible=true]:outline-offset-2 " +
      "data-[disabled=true]:opacity-50 data-[disabled=true]:cursor-not-allowed",
    output: "self-end",
  },
  variants: {
    density: {
      brand: {
        track: "h-[6px] bg-surface-03 data-[orientation=vertical]:w-[6px]",
        thumb: "h-[16px] w-[16px]",
        output: "font-mono text-mono-sm text-ink-dim",
      },
      compact: {
        track: "h-[4px] bg-l-wash-3 data-[orientation=vertical]:w-[4px]",
        thumb: "h-[12px] w-[12px]",
        output: "font-sans text-[11px] font-medium text-l-ink-dim",
      },
    },
  },
  defaultVariants: { density: "brand" },
});

export interface SliderProps<T extends number | number[] = number> extends Omit<
  RACSliderProps<T>,
  "className" | "children"
> {
  className?: string;
  density?: "compact" | "brand";
  /** Show the numeric value(s) above the track. */
  showOutput?: boolean;
  /** Show a filled track between min and the current value / between thumbs. */
  showFill?: boolean;
}

export function Slider<T extends number | number[] = number>({
  className,
  density: densityProp,
  showOutput = true,
  showFill = true,
  ...rest
}: SliderProps<T>) {
  const density = useResolvedChromeDensity(densityProp);
  const slots = sliderStyles({ density });
  return (
    <RACSlider<T>
      {...(rest as RACSliderProps<T>)}
      data-density={density}
      className={composeTwRenderProps(className, slots.root())}
    >
      {showOutput ? <RACSliderOutput className={slots.output()} /> : null}
      <RACSliderTrack className={slots.track()}>
        {({ state }) => (
          <>
            {showFill && state.values.length === 1 ? (
              <span
                className={slots.fill()}
                style={{ width: `${state.getThumbPercent(0) * 100}%` }}
              />
            ) : null}
            {showFill && state.values.length === 2 ? (
              <span
                className={slots.fill()}
                style={{
                  left: `${state.getThumbPercent(0) * 100}%`,
                  width: `${
                    (state.getThumbPercent(1) - state.getThumbPercent(0)) * 100
                  }%`,
                }}
              />
            ) : null}
            {state.values.map((_, i) => (
              <RACSliderThumb key={i} index={i} className={slots.thumb()} />
            ))}
          </>
        )}
      </RACSliderTrack>
    </RACSlider>
  );
}
