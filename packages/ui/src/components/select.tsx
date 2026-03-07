"use client";

import * as React from "react";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  variant?: "default" | "auth";
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ invalid = false, variant = "default", className = "", children, ...props }, ref) => {
    const classes = [
      variant === "default"
        ? "input pr-10 appearance-none"
        : "w-full px-3 py-2.5 pr-10 bg-transparent border rounded-[0.75rem] text-base text-[hsl(0,0%,8%)] focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors appearance-none",
      invalid
        ? variant === "default"
          ? "border-[var(--critical)] focus:border-[var(--critical)] focus:ring-2 focus:ring-[var(--critical)]"
          : "border-[#ff3b3b] focus:ring-[#ff3b3b]"
        : variant === "auth"
          ? "border-[hsl(0,0%,90%)] focus:ring-[hsl(0,0%,8%)]"
          : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="relative">
        <select ref={ref} className={classes} {...props}>
          {children}
        </select>
        <svg
          className={`absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none ${
            variant === "default" ? "text-tertiary" : "text-[hsl(0,0%,45%)]"
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
    );
  }
);

Select.displayName = "Select";
