"use client";

/*
 * ProgressBar — determinate or indeterminate.
 */

import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "../utils/cn";

export const progressRootVariants = cva("flex flex-col w-full gap-[6px]");

export const progressLabelVariants = cva(
  "flex items-center justify-between font-sans text-[12px] font-medium text-l-ink-dim"
);

export const progressTrackVariants = cva(
  "relative w-full overflow-hidden h-[3px] rounded-md bg-l-wash-5"
);

export const progressFillVariants = cva(
  "absolute inset-y-0 left-0 bg-ember transition-[width] duration-fast ease-out"
);

export const progressIndeterminateVariants = cva(
  "absolute inset-y-0 w-1/3 bg-ember animate-chron-indeterminate"
);

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  label?: React.ReactNode;
  value?: number;
  min?: number;
  max?: number;
  valueText?: string;
  isIndeterminate?: boolean;
}

export function ProgressBar({
  className,
  label,
  value,
  min = 0,
  max = 100,
  valueText,
  isIndeterminate = value === undefined,
  ...rest
}: ProgressBarProps) {
  const percentage =
    isIndeterminate || value === undefined
      ? 0
      : ((value - min) / Math.max(1, max - min)) * 100;
  const displayValueText =
    valueText ??
    (!isIndeterminate && value !== undefined
      ? `${Math.round(percentage)}%`
      : undefined);

  return (
    <div
      {...rest}
      role="progressbar"
      aria-valuemin={isIndeterminate ? undefined : min}
      aria-valuemax={isIndeterminate ? undefined : max}
      aria-valuenow={isIndeterminate ? undefined : value}
      aria-valuetext={displayValueText}
      className={cn(progressRootVariants(), className)}
    >
      {label || displayValueText ? (
        <div className={progressLabelVariants()}>
          {label ? <span>{label}</span> : <span />}
          {displayValueText ? <span>{displayValueText}</span> : null}
        </div>
      ) : null}
      <div className={progressTrackVariants()}>
        {isIndeterminate ? (
          <div className={progressIndeterminateVariants()} />
        ) : (
          <div
            className={progressFillVariants()}
            style={{ width: `${percentage}%` }}
          />
        )}
      </div>
    </div>
  );
}
