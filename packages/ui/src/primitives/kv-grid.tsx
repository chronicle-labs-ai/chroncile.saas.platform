import * as React from "react";

import { cn } from "../utils/cn";

export interface KvGridItem {
  label: React.ReactNode;
  value: React.ReactNode;
}

export interface KvGridProps extends React.HTMLAttributes<HTMLDListElement> {
  items: KvGridItem[];
  labelWidthClassName?: string;
}

export function KvGrid({
  items,
  labelWidthClassName = "min-w-[140px]",
  className,
  ...props
}: KvGridProps) {
  return (
    <dl
      className={cn("grid gap-x-[18px] gap-y-s-2 font-mono text-xs", className)}
      {...props}
    >
      {items.map((item, index) => (
        <div key={index} className="grid grid-cols-[auto_1fr] gap-x-[18px]">
          <dt
            className={cn(
              "text-[10px] uppercase tracking-[0.08em] text-ink-dim",
              labelWidthClassName
            )}
          >
            {item.label}
          </dt>
          <dd className="min-w-0 break-words text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
