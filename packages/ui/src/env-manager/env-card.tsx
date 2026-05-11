import * as React from "react";

import { StatusDot, type StatusDotVariant } from "../primitives/status-dot";
import { cx } from "../utils/cx";
import { EnvBadge, type EnvBadgeVariant } from "./env-badge";

export type EnvCardType = EnvBadgeVariant;

const accentByType: Record<EnvCardType, string> = {
  prod: "bg-event-red",
  stg: "bg-event-violet",
  dev: "bg-event-teal",
  local: "bg-ink-dim",
  ephemeral: "bg-[var(--l-accent)]",
};

export interface EnvCardProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  type: EnvCardType;
  title: React.ReactNode;
  badgeLabel?: React.ReactNode;
  meta?: React.ReactNode;
  children: React.ReactNode;
}

function EnvCardRoot({
  type,
  title,
  badgeLabel,
  meta,
  className,
  children,
  ...props
}: EnvCardProps) {
  return (
    <div
      className={cx(
        "group relative flex flex-col gap-[12px] overflow-hidden rounded-md border border-hairline-strong bg-l-surface-raised px-[14px] py-[12px]",
        "transition-colors duration-fast ease-out hover:border-l-border-strong hover:bg-l-surface-hover",
        className
      )}
      data-env-type={type}
      {...props}
    >
      <span
        aria-hidden
        className={cx("absolute inset-y-0 left-0 w-[2px]", accentByType[type])}
      />
      <div className="flex items-start justify-between gap-s-3">
        <div className="min-w-0">
          <div className="mb-[6px] flex items-center gap-[6px]">
            <EnvBadge variant={type}>{badgeLabel}</EnvBadge>
            {meta ? (
              <span className="truncate font-mono text-[11px] tracking-mono text-l-ink-dim">
                {meta}
              </span>
            ) : null}
          </div>
          <h3 className="truncate font-sans text-[13px] font-medium leading-[1.2] tracking-normal text-l-ink">
            {title}
          </h3>
        </div>
      </div>
      {children}
    </div>
  );
}

export interface EnvCardHostsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

function EnvCardHosts({ className, children, ...props }: EnvCardHostsProps) {
  return (
    <div
      className={cx(
        "flex flex-col gap-[4px] rounded-md border border-l-border-faint bg-l-surface p-[10px] font-mono text-[11px]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface EnvCardHostRowProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value?: React.ReactNode;
  pendingLabel?: React.ReactNode;
}

function EnvCardHostRow({
  label,
  value,
  pendingLabel = "pending",
  className,
  ...props
}: EnvCardHostRowProps) {
  return (
    <div className={cx("flex items-baseline gap-[10px]", className)} {...props}>
      <span className="w-[60px] shrink-0 text-[9px] uppercase tracking-[0.08em] text-l-ink-dim">
        {label}
      </span>
      {value ? (
        <span className="min-w-0 flex-1 truncate text-l-ink">{value}</span>
      ) : (
        <span className="text-[10.5px] text-event-amber">{pendingLabel}</span>
      )}
    </div>
  );
}

export interface EnvCardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

function EnvCardFooter({ className, children, ...props }: EnvCardFooterProps) {
  return (
    <div
      className={cx(
        "flex items-center gap-[10px] border-t border-l-border-faint pt-[8px]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface EnvCardHealthProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: "hot" | "cold" | "warning" | "error";
  children: React.ReactNode;
}

const healthDot: Record<
  NonNullable<EnvCardHealthProps["status"]>,
  StatusDotVariant
> = {
  hot: "green",
  cold: "offline",
  warning: "amber",
  error: "red",
};

function EnvCardHealth({
  status = "hot",
  children,
  className,
  ...props
}: EnvCardHealthProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-[6px] font-mono text-[10px] uppercase tracking-[0.06em]",
        status === "cold" ? "text-l-ink-dim" : "text-event-green",
        status === "warning" && "text-event-amber",
        status === "error" && "text-event-red",
        className
      )}
      {...props}
    >
      <StatusDot variant={healthDot[status]} pulse={status === "hot"} />
      {children}
    </span>
  );
}

export interface EnvCardTtlProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

function EnvCardTtl({ className, children, ...props }: EnvCardTtlProps) {
  return (
    <span
      className={cx(
        "ml-auto font-mono text-[10px] tracking-[0.04em] text-l-ink-dim",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

interface EnvCardNamespace {
  (props: EnvCardProps): React.ReactElement;
  Hosts: typeof EnvCardHosts;
  HostRow: typeof EnvCardHostRow;
  Footer: typeof EnvCardFooter;
  Health: typeof EnvCardHealth;
  Ttl: typeof EnvCardTtl;
}

const EnvCard = EnvCardRoot as EnvCardNamespace;
EnvCard.Hosts = EnvCardHosts;
EnvCard.HostRow = EnvCardHostRow;
EnvCard.Footer = EnvCardFooter;
EnvCard.Health = EnvCardHealth;
EnvCard.Ttl = EnvCardTtl;

export { EnvCard };
