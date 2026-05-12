import * as React from "react";

import { cn } from "../utils/cn";

export type KpiValueTone = "default" | "ember" | "green" | "amber" | "red";

const valueToneClass: Record<KpiValueTone, string> = {
  default: "text-ink-hi",
  ember: "text-ember",
  green: "text-event-green",
  amber: "text-event-amber",
  red: "text-event-red",
};

export interface KpiCardProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  valueTone?: KpiValueTone;
  valueClassName?: string;
  monoValue?: boolean;
}

export function KpiCard({
  label,
  value,
  sub,
  valueTone = "default",
  valueClassName,
  monoValue = false,
  className,
  ...props
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-[4px] rounded-md border border-hairline bg-surface-01 px-s-4 py-[14px]",
        className
      )}
      {...props}
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-dim">
        {label}
      </span>
      <span
        className={cn(
          monoValue
            ? "font-mono text-sm tracking-normal"
            : "font-display text-[22px] font-medium leading-none tracking-[-0.015em]",
          valueToneClass[valueTone],
          valueClassName
        )}
      >
        {value}
      </span>
      {sub ? (
        <span className="font-mono text-[10px] tracking-[0.04em] text-ink-dim">
          {sub}
        </span>
      ) : null}
    </div>
  );
}

export interface KpiGridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: 2 | 3 | 4;
}

const gridColumns: Record<NonNullable<KpiGridProps["columns"]>, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

export function KpiGrid({
  columns = 4,
  className,
  children,
  ...props
}: KpiGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-s-3",
        gridColumns[columns],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
