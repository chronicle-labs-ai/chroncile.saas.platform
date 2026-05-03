import * as React from "react";

import { cn } from "../utils/cn";

export interface OptionTileProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: React.ReactNode;
  meta?: React.ReactNode;
  rightTag?: React.ReactNode;
  isSelected?: boolean;
}

export function OptionTile({
  label,
  meta,
  rightTag,
  isSelected = false,
  className,
  type = "button",
  ...props
}: OptionTileProps) {
  return (
    <button
      type={type}
      data-selected={isSelected || undefined}
      className={cn(
        "grid w-full grid-cols-[16px_1fr_auto] items-center gap-[14px] rounded-sm border bg-surface-00 px-[14px] py-s-3 text-left",
        "transition-colors duration-fast ease-out",
        "hover:border-hairline-strong hover:bg-surface-02",
        "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
        isSelected
          ? "border-ember bg-[rgba(216,67,10,0.04)]"
          : "border-hairline",
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "relative h-[14px] w-[14px] rounded-full border",
          isSelected ? "border-ember" : "border-hairline-strong"
        )}
      >
        {isSelected ? (
          <span className="absolute inset-[3px] rounded-full bg-ember" />
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="block font-sans text-[13px] font-medium tracking-[-0.005em] text-ink-hi">
          {label}
        </span>
        {meta ? (
          <span className="mt-[2px] block font-mono text-[10.5px] tracking-[0.02em] text-ink-dim">
            {meta}
          </span>
        ) : null}
      </span>
      {rightTag ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-dim">
          {rightTag}
        </span>
      ) : null}
    </button>
  );
}
