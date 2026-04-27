"use client";

import * as React from "react";
import { tv, type VariantProps } from "../utils/tv";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

/**
 * Chip — Linear-density filter chip / dropdown trigger. Sits in the
 * filter bar above tables and timelines:
 *   <Chip icon={<TriangleIcon/>} count={2}>Outcome</Chip>
 *
 * Activates with an ember tint when a value is applied. `removable`
 * surfaces a small × on the right so a trailing click-handler can
 * clear the chip without needing a separate button next to it.
 */
export type ChipDensity = "compact" | "brand";

const chip = tv({
  slots: {
    base:
      "inline-flex items-center border whitespace-nowrap " +
      "transition-[background-color,border-color,color] duration-fast ease-out " +
      "cursor-pointer select-none",
    count: "inline-flex items-center justify-center",
    removeBtn:
      "inline-flex items-center justify-center transition-colors duration-fast",
    sep: "w-px",
  },
  variants: {
    density: {
      compact: {
        base: "gap-[6px] h-[26px] px-[8px] rounded-l text-[12px] font-medium font-sans",
        count:
          "font-mono text-[10.5px] px-[5px] py-[1px] rounded-pill bg-l-wash-5 text-l-ink",
        removeBtn: "text-l-ink-dim hover:text-l-ink",
        sep: "h-[12px] bg-l-border-strong mx-[2px]",
      },
      brand: {
        base: "gap-s-2 h-[28px] px-s-2 rounded-xs font-mono text-mono-sm uppercase tracking-tactical",
        count:
          "font-mono text-mono-xs px-s-1 py-[1px] rounded-xs bg-surface-03 text-ink",
        removeBtn: "text-ink-dim hover:text-ink-hi",
        sep: "h-[14px] bg-hairline-strong mx-s-1",
      },
    },
    active: { false: "", true: "" },
  },
  compoundVariants: [
    {
      density: "compact",
      active: false,
      class: {
        base:
          "bg-l-wash-2 border-l-border text-l-ink-lo " +
          "hover:bg-l-wash-5 hover:border-l-border-strong hover:text-l-ink",
      },
    },
    {
      density: "compact",
      active: true,
      class: {
        base:
          "bg-l-surface-selected border-[rgba(216,67,10,0.35)] text-l-ink " +
          "hover:bg-l-surface-selected",
      },
    },
    {
      density: "brand",
      active: false,
      class: {
        base:
          "bg-surface-01 border-hairline-strong text-ink-lo " +
          "hover:bg-surface-02 hover:text-ink-hi",
      },
    },
    {
      density: "brand",
      active: true,
      class: {
        base:
          "bg-[rgba(216,67,10,0.08)] border-ember/40 text-ember " +
          "hover:bg-[rgba(216,67,10,0.12)]",
      },
    },
  ],
  defaultVariants: { active: false, density: "compact" },
});

type ChipVariantProps = VariantProps<typeof chip>;

export interface ChipProps
  extends
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">,
    ChipVariantProps {
  icon?: React.ReactNode;
  /** Optional count badge rendered after the label. */
  count?: React.ReactNode;
  /** When true, render a trailing × that fires `onRemove` (stops bubbling). */
  removable?: boolean;
  onRemove?: () => void;
  active?: boolean;
  density?: ChipDensity;
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
  density: densityProp,
  className,
  children,
  ...props
}: ChipProps) {
  const density = useResolvedChromeDensity(densityProp);
  const slots = chip({ active, density });
  return (
    <button
      type="button"
      className={slots.base({ className })}
      data-active={active || undefined}
      data-density={density}
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
