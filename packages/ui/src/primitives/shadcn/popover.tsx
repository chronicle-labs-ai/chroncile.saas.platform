import { cva } from "class-variance-authority";

/*
 * Radix Popover emits `data-state="open" | "closed"` on `Content` and
 * `data-side="top" | "right" | "bottom" | "left"` on `Content` / `Arrow`.
 */

export const popoverVariants = cva(
  "z-50 border bg-surface-02 shadow-panel outline-none " +
    "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 " +
    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 " +
    "data-[side=bottom]:slide-in-from-top-2 " +
    "data-[side=left]:slide-in-from-right-2 " +
    "data-[side=right]:slide-in-from-left-2 " +
    "data-[side=top]:slide-in-from-bottom-2",
  {
    variants: {
      density: {
        brand: "rounded-md border-hairline-strong",
        compact: "rounded-l border-l-border",
      },
    },
    defaultVariants: {
      density: "brand",
    },
  }
);

export const popoverDialogVariants = cva("outline-none");

export const popoverArrowVariants = cva("fill-surface-02 stroke-hairline-strong");
