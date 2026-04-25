"use client";

import * as React from "react";
import { tv, type VariantProps } from "../utils/tv";

/**
 * Chip — Linear-density filter chip / dropdown trigger. Sits in the
 * filter bar above tables and timelines:
 *   <Chip icon={<TriangleIcon/>} count={2}>Outcome</Chip>
 *
 * Activates with an ember tint when a value is applied. `removable`
 * surfaces a small × on the right so a trailing click-handler can
 * clear the chip without needing a separate button next to it.
 */
const chip = tv({
  slots: {
    base:
      "inline-flex items-center gap-[6px] h-[26px] px-[8px] " +
      "rounded-l border text-[12px] font-medium font-sans whitespace-nowrap " +
      "transition-[background-color,border-color,color] duration-fast ease-out " +
      "cursor-pointer select-none",
    count:
      "inline-flex items-center justify-center font-mono text-[10.5px] " +
      "px-[5px] py-[1px] rounded-pill bg-l-wash-5 text-l-ink",
    removeBtn:
      "inline-flex items-center justify-center text-l-ink-dim " +
      "hover:text-l-ink transition-colors duration-fast",
    sep: "w-px h-[12px] bg-l-border-strong mx-[2px]",
  },
  variants: {
    active: {
      false:
        "bg-l-wash-2 border-l-border text-l-ink-lo " +
        "hover:bg-l-wash-5 hover:border-l-border-strong hover:text-l-ink",
      true:
        "bg-l-surface-selected border-[rgba(216,67,10,0.35)] text-l-ink " +
        "hover:bg-l-surface-selected",
    },
  },
  defaultVariants: { active: false },
});

type ChipVariantProps = VariantProps<typeof chip>;

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
  const slots = chip({ active });
  return (
    <button
      type="button"
      className={slots.base({ className })}
      data-active={active || undefined}
      {...props}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      {children ? <span>{children}</span> : null}
      {count !== undefined ? (
        <span className={slots.count()}>{count}</span>
      ) : null}
      {removable ? (
        <span
          role="button"
          tabIndex={-1}
          aria-label="Remove filter"
          className={slots.removeBtn()}
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
