import * as React from "react";

import { cn } from "../utils/cn";

export type SparklineTone = "ember" | "green" | "amber" | "red" | "teal";

const strokeByTone: Record<SparklineTone, string> = {
  ember: "var(--c-ember)",
  green: "var(--c-event-green)",
  amber: "var(--c-event-amber)",
  red: "var(--c-event-red)",
  teal: "var(--c-event-teal)",
};

export interface SparklineProps extends Omit<
  React.SVGAttributes<SVGSVGElement>,
  "values"
> {
  values: number[];
  tone?: SparklineTone;
  width?: number;
  height?: number;
}

export function Sparkline({
  values,
  tone = "ember",
  width = 240,
  height = 60,
  className,
  ...props
}: SparklineProps) {
  const path = React.useMemo(
    () => buildSparklinePath(values, width, height),
    [values, width, height]
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Metric trend"
      className={cn("block h-[60px] w-full", className)}
      {...props}
    >
      <path
        d={`M0 ${height - 1} H${width}`}
        fill="none"
        stroke="var(--c-hairline)"
      />
      <path
        d={path}
        fill="none"
        stroke={strokeByTone[tone]}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function buildSparklinePath(values: number[], width: number, height: number) {
  if (values.length === 0) return "";
  if (values.length === 1) return `M0 ${height / 2} H${width}`;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 6;
  const innerHeight = height - padding * 2;
  const step = width / (values.length - 1);

  return values
    .map((value, index) => {
      const x = index * step;
      const y = padding + (1 - (value - min) / range) * innerHeight;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}
