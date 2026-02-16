"use client";

interface LabelBadgeProps {
  label: string;
  value: string;
  variant?: "neutral" | "data" | "nominal" | "caution" | "critical";
}

const LABEL_DISPLAY: Record<string, string> = {
  // Action verdicts
  correct: "Correct",
  partial: "Partially Correct",
  incorrect: "Incorrect",
  unnecessary: "Unnecessary",
  // General statuses
  resolved: "Resolved",
  unresolved: "Unresolved",
  escalated: "Escalated",
  abandoned: "Abandoned",
  pending: "Pending",
};

const VERDICT_VARIANT: Record<string, LabelBadgeProps["variant"]> = {
  correct: "nominal",
  partial: "caution",
  incorrect: "critical",
  unnecessary: "neutral",
};

export function LabelBadge({ label, value, variant = "neutral" }: LabelBadgeProps) {
  const displayValue = LABEL_DISPLAY[value] ?? value;
  // Auto-detect variant for verdict values
  const resolvedVariant = VERDICT_VARIANT[value] ?? variant;

  return (
    <span className={`badge badge--${resolvedVariant}`}>
      <span className="opacity-60">{label}:</span> {displayValue}
    </span>
  );
}
