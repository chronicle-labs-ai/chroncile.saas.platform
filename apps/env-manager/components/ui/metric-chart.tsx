"use client";

import { useMemo } from "react";

interface Point {
  t: number;
  v: number | null;
}

interface MetricChartProps {
  data: Point[];
  color?: string;
  fillColor?: string;
  height?: number;
  yMax?: number;
  unit?: string;
  showGrid?: boolean;
}

const GRID_LINES = 4;

export function MetricChart({
  data,
  color = "var(--data)",
  fillColor,
  height = 80,
  yMax: yMaxOverride,
  unit = "",
  showGrid = true,
}: MetricChartProps) {
  const { path, areaPath, computedMax, gridValues } = useMemo(() => {
    const filtered = data.filter((p) => p.v !== null && isFinite(p.v!));
    if (filtered.length < 2) return { path: "", areaPath: "", computedMax: 0, gridValues: [] };

    const values = filtered.map((p) => p.v!);
    const max = yMaxOverride ?? Math.max(...values, 1) * 1.1;
    const tMin = filtered[0].t;
    const tMax = filtered[filtered.length - 1].t;
    const tRange = tMax - tMin || 1;

    const W = 100;
    const H = 100;
    const pad = 1;

    const points = filtered.map((p) => ({
      x: pad + ((p.t - tMin) / tRange) * (W - 2 * pad),
      y: H - pad - ((p.v! / max) * (H - 2 * pad)),
    }));

    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    const area = `${line} L${points[points.length - 1].x},${H} L${points[0].x},${H} Z`;

    const grid = Array.from({ length: GRID_LINES }, (_, i) =>
      parseFloat(((max / (GRID_LINES + 1)) * (i + 1)).toFixed(1))
    );

    return { path: line, areaPath: area, computedMax: max, gridValues: grid };
  }, [data, yMaxOverride]);

  const fill = fillColor ?? `${color}15`;

  if (!path) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-xs text-tertiary font-mono">
        No data
      </div>
    );
  }

  return (
    <div className="relative" style={{ height }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full h-full"
        style={{ overflow: "visible" }}
      >
        {showGrid && gridValues.map((val, i) => {
          const y = 100 - 1 - ((val / computedMax) * 98);
          return (
            <g key={i}>
              <line
                x1={1} y1={y} x2={99} y2={y}
                stroke="var(--border-dim)"
                strokeWidth={0.3}
                strokeDasharray="1,1"
              />
              <text
                x={99.5} y={y - 0.8}
                fontSize={3.5}
                fill="var(--text-tertiary)"
                textAnchor="end"
                dominantBaseline="auto"
              >
                {val < 10 ? val.toFixed(1) : Math.round(val)}{unit}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill={fill} />
        <path d={path} fill="none" stroke={color} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  current: number | null;
  unit: string;
  series: Point[];
  color: string;
  fillColor?: string;
  yMax?: number;
  formatValue?: (v: number) => string;
}

export function MetricCard({
  title,
  current,
  unit,
  series,
  color,
  fillColor,
  yMax,
  formatValue,
}: MetricCardProps) {
  const displayValue = current !== null && isFinite(current)
    ? (formatValue ? formatValue(current) : current < 10 ? current.toFixed(1) : Math.round(current).toString())
    : "—";

  return (
    <div className="panel">
      <div className="px-3 pt-3 pb-1 flex items-baseline justify-between">
        <span className="label">{title}</span>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-lg font-semibold" style={{ color }}>
            {displayValue}
          </span>
          <span className="font-mono text-[10px] text-tertiary">{unit}</span>
        </div>
      </div>
      <div className="px-1 pb-1">
        <MetricChart
          data={series}
          color={color}
          fillColor={fillColor}
          height={64}
          yMax={yMax}
          unit={unit === "%" ? "%" : ""}
        />
      </div>
    </div>
  );
}
