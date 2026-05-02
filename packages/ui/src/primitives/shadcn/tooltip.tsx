import { cva } from "class-variance-authority";

/*
 * Radix Tooltip emits `data-state="delayed-open" | "instant-open" | "closed"`
 * on `Content`, plus `data-side="…"`. We match on state presence (`open` /
 * `closed`) using attribute wildcards.
 */

export const tooltipVariants = cva(
  "z-50 border bg-surface-02 shadow-card outline-none " +
    "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 " +
    "data-[state=instant-open]:animate-in data-[state=instant-open]:fade-in-0 data-[state=instant-open]:zoom-in-95 " +
    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 " +
    "data-[side=bottom]:slide-in-from-top-2 " +
    "data-[side=left]:slide-in-from-right-2 " +
    "data-[side=right]:slide-in-from-left-2 " +
    "data-[side=top]:slide-in-from-bottom-2",
  {
    variants: {
      density: {
        brand:
          "rounded-xs border-hairline-strong px-s-2 py-s-1 font-mono text-mono-sm text-ink",
        compact:
          "rounded-l border-l-border px-[8px] py-[4px] font-sans text-[12px] font-medium text-l-ink",
      },
    },
    defaultVariants: {
      density: "brand",
    },
  }
);

export const tooltipArrowVariants = cva("fill-surface-02 stroke-hairline-strong");
