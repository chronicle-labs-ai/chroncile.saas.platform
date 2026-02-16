"use client";

interface ConfidenceBarProps {
  value: number | null; // 0.0 - 1.0
  showValue?: boolean;
  size?: "sm" | "md";
}

export function ConfidenceBar({ value, showValue = true, size = "md" }: ConfidenceBarProps) {
  const pct = value !== null ? Math.round(value * 100) : 0;

  // Semantic color based on confidence level
  const colorClass =
    pct < 30
      ? "progress-bar__fill--critical"
      : pct < 70
        ? "progress-bar__fill--caution"
        : "progress-bar__fill--nominal";

  const textColor =
    pct < 30
      ? "text-critical"
      : pct < 70
        ? "text-caution"
        : "text-nominal";

  const barHeight = size === "sm" ? "h-[3px]" : "h-[4px]";

  return (
    <div className="flex items-center gap-2">
      <div className={`progress-bar flex-1 min-w-[60px] ${barHeight}`}>
        <div
          className={`progress-bar__fill ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showValue && (
        <span className={`font-mono text-[11px] tabular-nums ${textColor}`}>
          {value !== null ? value.toFixed(2) : "—"}
        </span>
      )}
    </div>
  );
}
