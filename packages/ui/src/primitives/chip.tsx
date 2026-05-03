"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

/**
 * Chip — Linear-density filter chip / dropdown trigger. Sits in the
 * filter bar above tables and timelines:
 *   <Chip icon={<TriangleIcon/>} count={2}>Outcome</Chip>
 *
 * Activates with an ember tint when a value is applied. `removable`
 * surfaces a small × on the right so a trailing click-handler can
 * clear the chip without needing a separate button next to it.
 */
/*
 * Touch hit area: chips stay 26px tall on desktop for Linear-density
 * but expand to a 44px minimum on coarse pointers (touch) so they're
 * comfortable to tap. The visual height grows on touch only — desktop
 * canvas stays unchanged.
 */
export const chipVariants = cva(
  "inline-flex items-center border whitespace-nowrap transition-[background-color,border-color,color] duration-fast ease-out cursor-pointer select-none touch-manipulation gap-[6px] h-[26px] [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:px-3 px-[8px] rounded-md text-[12px] font-medium font-sans",
  {
    variants: {
      active: {
        false: "",
        true: "",
      },
    },
    compoundVariants: [
      {
        active: false,
        className:
          "bg-l-wash-2 border-hairline-strong text-l-ink-lo hover:bg-l-wash-5 hover:border-l-border-strong hover:text-l-ink",
      },
      {
        active: true,
        className:
          "bg-l-surface-selected border-[rgba(216,67,10,0.35)] text-l-ink hover:bg-l-surface-selected",
      },
    ],
    defaultVariants: {
      active: false,
    },
  }
);

export const chipCountVariants = cva(
  "inline-flex items-center justify-center font-mono text-[10.5px] px-[5px] py-[1px] rounded-pill bg-l-wash-5 text-l-ink"
);

export const chipRemoveVariants = cva(
  "inline-flex items-center justify-center transition-colors duration-fast text-l-ink-dim hover:text-l-ink"
);

export const chipSeparatorVariants = cva(
  "w-px h-[12px] bg-l-border-strong mx-[2px]"
);

type ChipVariantProps = VariantProps<typeof chipVariants>;

export interface ChipProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">,
    ChipVariantProps {
  icon?: React.ReactNode;
  /** Optional count badge rendered after the label. */
  count?: React.ReactNode;
  /** When true, render a trailing × that fires `onRemove` (stops bubbling). */
  removable?: boolean;
  onRemove?: () => void;
  active?: boolean;
  children?: React.ReactNode;
}

const RemoveIcon = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

export function Chip({
  icon,
  count,
  removable,
  onRemove,
  active,
  className,
  children,
  ...props
}: ChipProps) {
  return (
    <button
      type="button"
      className={chipVariants({ active, className })}
      data-active={active || undefined}
      {...props}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      {children ? <span>{children}</span> : null}
      {count !== undefined ? (
        <span className={chipCountVariants()}>{count}</span>
      ) : null}
      {removable ? (
        <span
          role="button"
          tabIndex={-1}
          aria-label="Remove filter"
          className={chipRemoveVariants()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
        >
          <RemoveIcon />
        </span>
      ) : null}
    </button>
  );
}
