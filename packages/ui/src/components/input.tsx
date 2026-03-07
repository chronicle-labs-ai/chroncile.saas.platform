"use client";

import * as React from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  search?: boolean;
  invalid?: boolean;
  variant?: "default" | "auth";
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ search = false, invalid = false, variant = "default", className = "", ...props }, ref) => {
    const classes = [
      variant === "default"
        ? "input"
        : "w-full px-3 py-2.5 bg-transparent border rounded-[0.75rem] text-base text-[hsl(0,0%,8%)] placeholder:text-[hsl(0,0%,45%)] focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors",
      search ? (variant === "default" ? "input--search" : "pl-10") : "",
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

    if (search) {
      return (
        <div className="relative">
          <svg
            className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
              variant === "default"
                ? "text-tertiary"
                : "text-[hsl(0,0%,45%)]"
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input ref={ref} className={classes} {...props} />
        </div>
      );
    }

    return <input ref={ref} className={classes} {...props} />;
  }
);

Input.displayName = "Input";
