import * as React from "react";

import { cx } from "../utils/cx";

export type ProductChipTone =
  | "neutral"
  | "data"
  | "caution"
  | "nominal"
  | "critical";

const chipToneClass: Record<ProductChipTone, string> = {
  neutral: "bg-l-wash-2 text-l-ink-dim ring-l-border",
  data: "bg-l-wash-2 text-l-ink-lo ring-l-border",
  caution: "bg-l-wash-2 text-l-ink-lo ring-l-border",
  nominal: "bg-l-wash-2 text-l-ink-lo ring-l-border",
  critical: "bg-l-wash-2 text-l-ink-lo ring-l-border",
};

const chipDotClass: Record<ProductChipTone, string> = {
  neutral: "bg-l-ink-dim",
  data: "bg-event-teal",
  caution: "bg-event-amber",
  nominal: "bg-event-green",
  critical: "bg-event-red",
};

const actionToneClass: Record<ProductChipTone, string> = {
  neutral:
    "border-hairline-strong bg-l-surface-raised text-l-ink-lo hover:border-l-border-strong hover:bg-l-wash-3 hover:text-l-ink",
  data: "border-hairline-strong bg-l-surface-raised text-l-ink-lo hover:border-event-teal/40 hover:bg-[rgba(45,212,191,0.08)] hover:text-event-teal",
  caution:
    "border-hairline-strong bg-l-surface-raised text-l-ink-lo hover:border-event-amber/40 hover:bg-[rgba(251,191,36,0.08)] hover:text-event-amber",
  nominal:
    "border-hairline-strong bg-l-surface-raised text-l-ink-lo hover:border-event-green/40 hover:bg-[rgba(74,222,128,0.08)] hover:text-event-green",
  critical:
    "border-event-red/30 bg-[rgba(239,68,68,0.08)] text-event-red hover:border-event-red/50 hover:bg-[rgba(239,68,68,0.14)]",
};

export interface ProductChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: ProductChipTone;
  dot?: boolean;
}

export function ProductChip({
  tone = "neutral",
  dot,
  className,
  children,
  ...props
}: ProductChipProps) {
  return (
    <span
      className={cx(
        "inline-flex h-[20px] items-center gap-[5px] rounded-md px-[7px]",
        "font-sans text-[11px] font-medium leading-none ring-1 ring-inset",
        chipToneClass[tone],
        className
      )}
      data-tone={tone}
      {...props}
    >
      {dot || tone !== "neutral" ? (
        <span
          aria-hidden
          className={cx(
            "h-[6px] w-[6px] shrink-0 rounded-full",
            chipDotClass[tone]
          )}
        />
      ) : null}
      {children}
    </span>
  );
}

export interface ProductTableActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ProductChipTone;
}

export function ProductTableAction({
  tone = "neutral",
  className,
  children,
  type = "button",
  ...props
}: ProductTableActionProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex h-[24px] items-center justify-center rounded-md border px-[9px]",
        "font-sans text-[12px] font-medium leading-none",
        "transition-[background-color,border-color,color,transform] duration-fast ease-out",
        "active:translate-y-px focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
        actionToneClass[tone],
        className
      )}
      data-tone={tone}
      {...props}
    >
      {children}
    </button>
  );
}
