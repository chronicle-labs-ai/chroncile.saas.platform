import * as React from "react";

import { cn } from "../utils/cn";

export interface MetaStripItem {
  label?: React.ReactNode;
  value: React.ReactNode;
}

export interface MetaStripProps extends React.HTMLAttributes<HTMLDivElement> {
  items: MetaStripItem[];
}

export function MetaStrip({ items, className, ...props }: MetaStripProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-s-4 gap-y-s-2 font-mono text-[11px] tracking-[0.02em] text-ink-dim",
        className
      )}
      {...props}
    >
      {items.map((item, index) => (
        <span key={index} className="inline-flex items-center gap-[6px]">
          {item.label ? (
            <span className="uppercase tracking-[0.08em]">{item.label}</span>
          ) : null}
          <span className="text-ink-lo">{item.value}</span>
        </span>
      ))}
    </div>
  );
}
