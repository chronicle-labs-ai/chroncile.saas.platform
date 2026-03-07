"use client";

import * as React from "react";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  variant?: "default" | "auth";
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ invalid = false, variant = "default", className = "", ...props }, ref) => {
    const classes = [
      variant === "default"
        ? "input min-h-24 resize-y"
        : "w-full min-h-[120px] px-3 py-2.5 bg-transparent border rounded-[0.75rem] text-base text-[hsl(0,0%,8%)] placeholder:text-[hsl(0,0%,45%)] focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors resize-y",
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

    return <textarea ref={ref} className={classes} {...props} />;
  }
);

Textarea.displayName = "Textarea";
