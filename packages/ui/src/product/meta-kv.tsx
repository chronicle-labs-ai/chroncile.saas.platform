import * as React from "react";
import { cx } from "../utils/cx";

/**
 * MetaKV — a compact mono definition-list used for page metadata,
 * event-detail headers, scenario-runner meta, etc. Each entry is a
 * `{ label, value }` row.
 */
export interface MetaKVEntry {
  label: React.ReactNode;
  value: React.ReactNode;
}

export interface MetaKVProps extends React.HTMLAttributes<HTMLDListElement> {
  entries: MetaKVEntry[];
}

export function MetaKV({ entries, className, ...props }: MetaKVProps) {
  return (
    <dl
      className={cx(
        "grid grid-cols-[auto_1fr] gap-y-s-2 gap-x-s-5 font-mono text-mono text-left",
        className
      )}
      {...props}
    >
      {entries.map((e, i) => (
        <React.Fragment key={i}>
          <dt className="uppercase tracking-tactical text-ink-dim">
            {e.label}
          </dt>
          <dd className="m-0 text-ink-lo">{e.value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
