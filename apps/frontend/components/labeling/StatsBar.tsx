"use client";

import type { TraceStats } from "@/lib/labeling/types";

interface StatsBarProps {
  stats: TraceStats | null;
  loading?: boolean;
}

export function StatsBar({ stats, loading }: StatsBarProps) {
  const metrics = [
    {
      label: "Total Traces",
      value: stats?.total ?? 0,
      color: "",
    },
    {
      label: "Pending Review",
      value: (stats?.pending ?? 0) + (stats?.autoLabeled ?? 0) + (stats?.inReview ?? 0),
      color: "metric__value--caution",
    },
    {
      label: "Labeled",
      value: stats?.labeled ?? 0,
      color: "metric__value--nominal",
    },
    {
      label: "Avg Confidence",
      value: stats?.avgConfidence?.toFixed(2) ?? "0.00",
      color:
        (stats?.avgConfidence ?? 0) < 0.3
          ? "metric__value--critical"
          : (stats?.avgConfidence ?? 0) < 0.7
            ? "metric__value--caution"
            : "metric__value--nominal",
    },
    {
      label: "Labeled Today",
      value: stats?.labeledToday ?? 0,
      color: "metric__value--data",
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="panel p-4">
            <div className="h-3 w-20 bg-hover rounded mb-2 animate-pulse" />
            <div className="h-7 w-16 bg-hover rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {metrics.map((m) => (
        <div key={m.label} className="panel p-4">
          <div className="metric">
            <span className="metric__label">{m.label}</span>
            <span className={`metric__value text-xl ${m.color}`}>{m.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
