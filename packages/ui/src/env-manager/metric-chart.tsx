import * as React from "react";

import { Sparkline, type SparklineTone } from "../primitives/sparkline";
import { cx } from "../utils/cx";

export interface MetricChartProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  label: React.ReactNode;
  value: React.ReactNode;
  values: number[];
  tone?: SparklineTone;
}

export function MetricChart({
  label,
  value,
  values,
  tone = "ember",
  className,
  ...props
}: MetricChartProps) {
  return (
    <div
      className={cx(
        "rounded-md border border-hairline bg-surface-01 px-s-4 pb-[6px] pt-[14px]",
        className
      )}
      {...props}
    >
      <div className="mb-s-2 flex items-baseline justify-between gap-s-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim">
          {label}
        </span>
        <span className="font-display text-[22px] font-medium leading-none tracking-[-0.015em] text-ink-hi">
          {value}
        </span>
      </div>
      <Sparkline values={values} tone={tone} />
    </div>
  );
}
