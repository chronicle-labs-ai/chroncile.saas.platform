"use client";

import * as React from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  search?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ search = false, className = "", ...props }, ref) => {
    const classes = ["input", search ? "input--search" : "", className]
      .filter(Boolean)
      .join(" ");

    if (search) {
      return (
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary pointer-events-none"
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
