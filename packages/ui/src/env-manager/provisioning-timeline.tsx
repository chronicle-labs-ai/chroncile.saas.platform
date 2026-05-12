import * as React from "react";

import { cx } from "../utils/cx";

export type ProvisioningStepStatus = "done" | "active" | "error" | "pending";

export interface ProvisioningTimelineProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  title?: React.ReactNode;
  meta?: React.ReactNode;
  children: React.ReactNode;
}

function ProvisioningTimelineRoot({
  title = "Provision Timeline",
  meta,
  className,
  children,
  ...props
}: ProvisioningTimelineProps) {
  return (
    <div
      className={cx(
        "overflow-hidden rounded-md border border-hairline bg-surface-01",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-[14px] border-b border-hairline bg-surface-02 px-[18px] py-s-3">
        <span className="font-display text-sm font-medium tracking-[-0.005em] text-ink-hi">
          {title}
        </span>
        {meta ? (
          <span className="ml-auto font-mono text-[10px] tracking-[0.04em] text-ink-dim">
            {meta}
          </span>
        ) : null}
      </div>
      <div className="p-s-5">{children}</div>
    </div>
  );
}

export interface ProvisioningStepProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: ProvisioningStepStatus;
  label: React.ReactNode;
  description?: React.ReactNode;
  time?: React.ReactNode;
  isLast?: boolean;
  children?: React.ReactNode;
}

const iconClass: Record<ProvisioningStepStatus, string> = {
  done: "border-event-green bg-[rgba(74,222,128,0.15)] text-event-green",
  active: "border-event-amber bg-[rgba(251,191,36,0.15)] text-event-amber",
  error: "border-event-red bg-[rgba(239,68,68,0.15)] text-event-red",
  pending: "border-hairline-strong bg-surface-00 text-ink-dim",
};

function ProvisioningStep({
  status = "pending",
  label,
  description,
  time,
  isLast = false,
  children,
  className,
  ...props
}: ProvisioningStepProps) {
  return (
    <div className={cx("relative", className)} {...props}>
      {!isLast ? (
        <span
          aria-hidden
          className="absolute bottom-[-8px] left-[11px] top-[30px] w-px bg-hairline"
        />
      ) : null}
      <div className="relative z-[1] grid grid-cols-[24px_1fr_auto] items-start gap-[14px] py-s-2">
        <span
          className={cx(
            "inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border",
            status === "active" && "animate-chron-pulse",
            iconClass[status]
          )}
          aria-hidden
        >
          {status === "done" ? (
            <svg viewBox="0 0 24 24" fill="none" className="h-[13px] w-[13px]">
              <path
                d="m5 12 4 4 10-10"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          ) : status === "error" ? (
            <svg viewBox="0 0 24 24" fill="none" className="h-[13px] w-[13px]">
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth={2}
              />
            </svg>
          ) : (
            <span className="h-[7px] w-[7px] rounded-full bg-current" />
          )}
        </span>
        <div className="min-w-0 pt-px">
          <div
            className={cx(
              "font-sans text-[13px] font-medium tracking-[-0.005em]",
              status === "pending" ? "text-ink-dim" : "text-ink-hi"
            )}
          >
            {label}
          </div>
          {description ? (
            <div className="mt-[2px] font-mono text-[10.5px] tracking-[0.02em] text-ink-dim">
              {description}
            </div>
          ) : null}
          {children ? <div className="mt-s-2">{children}</div> : null}
        </div>
        {time ? (
          <span
            className={cx(
              "self-center font-mono text-[10px] tracking-[0.04em] text-ink-dim",
              status === "active" && "text-event-amber"
            )}
          >
            {time}
          </span>
        ) : null}
      </div>
    </div>
  );
}

interface ProvisioningTimelineNamespace {
  (props: ProvisioningTimelineProps): React.ReactElement;
  Step: typeof ProvisioningStep;
}

const ProvisioningTimeline =
  ProvisioningTimelineRoot as ProvisioningTimelineNamespace;
ProvisioningTimeline.Step = ProvisioningStep;

export { ProvisioningTimeline };
