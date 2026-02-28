import * as React from "react";

export type StatusDotVariant =
  | "critical"
  | "caution"
  | "nominal"
  | "data"
  | "offline";

export interface StatusDotProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: StatusDotVariant;
  pulse?: boolean;
}

const variantClass: Record<StatusDotVariant, string> = {
  critical: "status-dot--critical",
  caution: "status-dot--caution",
  nominal: "status-dot--nominal",
  data: "status-dot--data",
  offline: "status-dot--offline",
};

export function StatusDot({
  variant = "offline",
  pulse = false,
  className = "",
  ...props
}: StatusDotProps) {
  const classes = [
    "status-dot",
    variantClass[variant],
    pulse ? "status-dot--pulse" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={classes} {...props} />;
}
