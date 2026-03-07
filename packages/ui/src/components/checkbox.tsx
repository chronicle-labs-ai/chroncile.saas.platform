"use client";

import * as React from "react";

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "auth";
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ variant = "default", className = "", ...props }, ref) => {
    const classes = [
      "rounded",
      variant === "default"
        ? "border-border-bright bg-elevated text-data focus:ring-data"
        : "border-[hsl(0,0%,70%)] text-[hsl(0,0%,8%)] focus:ring-[hsl(0,0%,8%)]",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return <input ref={ref} type="checkbox" className={classes} {...props} />;
  }
);

Checkbox.displayName = "Checkbox";
