import * as React from "react";

import { CopyButton } from "../primitives/copy-button";
import { cx } from "../utils/cx";

export interface EndpointRowProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value?: string | null;
  pendingLabel?: React.ReactNode;
  externalHref?: string;
  copyLabel?: string;
}

export function EndpointRow({
  label,
  value,
  pendingLabel = "pending",
  externalHref,
  copyLabel = "Copy",
  className,
  ...props
}: EndpointRowProps) {
  const href = externalHref ?? value ?? undefined;

  return (
    <div
      className={cx(
        "grid grid-cols-[160px_1fr_auto_auto] items-center gap-[14px] border-t border-divider px-s-5 py-[10px] font-mono text-[11.5px] first:border-t-0 hover:bg-row-hover",
        className
      )}
      {...props}
    >
      <span className="text-[9.5px] uppercase tracking-[0.06em] text-ink-dim">
        {label}
      </span>
      {value ? (
        <span className="min-w-0 truncate text-ink-hi">{value}</span>
      ) : (
        <span className="text-event-amber italic">{pendingLabel}</span>
      )}
      {value ? (
        <CopyButton appearance="text" text={value} label={copyLabel} />
      ) : (
        <span />
      )}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-xs px-[6px] py-[2px] font-mono text-[10px] uppercase tracking-[0.04em] text-ink-dim transition-colors hover:bg-surface-03 hover:text-ink-hi focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
          aria-label="Open endpoint"
        >
          EXT
        </a>
      ) : (
        <span />
      )}
    </div>
  );
}
