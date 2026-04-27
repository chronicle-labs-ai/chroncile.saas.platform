"use client";

/*
 * ProgressBar — determinate or indeterminate. RAC handles `aria-valuenow`
 * / `aria-valuetext` + the indeterminate signal (pass no `value`).
 */

import * as React from "react";
import {
  ProgressBar as RACProgressBar,
  Label as RACLabel,
  type ProgressBarProps as RACProgressBarProps,
} from "react-aria-components";

import { tv } from "../utils/tv";
import { composeTwRenderProps } from "../utils/compose";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

export type ProgressBarDensity = "compact" | "brand";

const progressStyles = tv({
  slots: {
    root: "flex flex-col w-full",
    label: "flex items-center justify-between",
    track: "relative w-full overflow-hidden",
    fill: "absolute inset-y-0 left-0 bg-ember transition-[width] duration-fast ease-out",
    indeterminate:
      "absolute inset-y-0 w-1/3 bg-ember animate-chron-indeterminate",
  },
  variants: {
    density: {
      brand: {
        root: "gap-s-2",
        label:
          "font-mono text-mono-sm uppercase tracking-tactical text-ink-dim",
        track: "h-[4px] rounded-pill bg-surface-03",
      },
      compact: {
        root: "gap-[6px]",
        label: "font-sans text-[12px] font-medium text-l-ink-dim",
        track: "h-[3px] rounded-l bg-l-wash-5",
      },
    },
  },
  defaultVariants: { density: "brand" },
});

export interface ProgressBarProps extends Omit<
  RACProgressBarProps,
  "className" | "children"
> {
  className?: string;
  label?: React.ReactNode;
  density?: ProgressBarDensity;
}

export function ProgressBar({
  className,
  label,
  density: densityProp,
  ...rest
}: ProgressBarProps) {
  const density = useResolvedChromeDensity(densityProp);
  const slots = progressStyles({ density });
  return (
    <RACProgressBar
      {...rest}
      className={composeTwRenderProps(className, slots.root())}
    >
      {({ percentage, valueText, isIndeterminate }) => (
        <>
          {label || valueText ? (
            <div className={slots.label()}>
              {label ? <RACLabel>{label}</RACLabel> : <span />}
              {valueText ? <span>{valueText}</span> : null}
            </div>
          ) : null}
          <div className={slots.track()}>
            {isIndeterminate ? (
              <div className={slots.indeterminate()} />
            ) : (
              <div
                className={slots.fill()}
                style={{ width: `${percentage ?? 0}%` }}
              />
            )}
          </div>
        </>
      )}
    </RACProgressBar>
  );
}
