import * as React from "react";

export type BadgeVariant =
  | "critical"
  | "caution"
  | "nominal"
  | "data"
  | "neutral";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClass: Record<BadgeVariant, string> = {
  critical: "badge--critical",
  caution: "badge--caution",
  nominal: "badge--nominal",
  data: "badge--data",
  neutral: "badge--neutral",
};

export function Badge({
  variant = "neutral",
  className = "",
  children,
  ...props
}: BadgeProps) {
  const classes = ["badge", variantClass[variant], className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}
