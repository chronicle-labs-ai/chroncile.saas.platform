import * as React from "react";

import { cx } from "../utils/cx";

export type EnvBadgeVariant = "prod" | "stg" | "dev" | "local" | "ephemeral";

const variantClass: Record<EnvBadgeVariant, string> = {
  prod: "text-l-ink-lo",
  stg: "text-l-ink-lo",
  dev: "text-l-ink-lo",
  local: "text-l-ink-dim",
  ephemeral: "text-l-ink-lo",
};

const dotClass: Record<EnvBadgeVariant, string> = {
  prod: "bg-event-red",
  stg: "bg-event-violet",
  dev: "bg-event-teal",
  local: "bg-l-ink-dim",
  ephemeral: "bg-[var(--l-accent)]",
};

const labelByVariant: Record<EnvBadgeVariant, string> = {
  prod: "PROD",
  stg: "STG",
  dev: "DEV",
  local: "LOCAL",
  ephemeral: "EPH",
};

export interface EnvBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: EnvBadgeVariant;
  children?: React.ReactNode;
}

export function EnvBadge({
  variant,
  children,
  className,
  ...props
}: EnvBadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex h-[18px] items-center gap-[5px] rounded-md border border-hairline-strong bg-l-surface-raised px-[7px] font-sans text-[11px] font-medium leading-none",
        variantClass[variant],
        className
      )}
      data-variant={variant}
      {...props}
    >
      <span
        aria-hidden
        className={cx(
          "h-[6px] w-[6px] shrink-0 rounded-full",
          dotClass[variant]
        )}
      />
      {children ?? labelByVariant[variant]}
    </span>
  );
}
