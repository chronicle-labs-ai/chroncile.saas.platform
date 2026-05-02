import { cva } from "class-variance-authority";

/*
 * Variant classnames for `<DropdownMenu>` — consumed by
 * `packages/ui/src/primitives/dropdown-menu.tsx`, which wires them onto
 * `radix-ui`'s `DropdownMenu.*` primitives.
 *
 * Radix emits these data attributes (matching shadcn/ui upstream):
 *   - `data-state="open" | "closed"`       on `Content`
 *   - `data-side="top" | "right" | …`      on `Content`
 *   - `data-highlighted`                   on hovered / keyboard-focused `Item`
 *   - `data-disabled`                      on disabled `Item`
 *
 * Earlier revisions of this file targeted `data-[focused=true]`,
 * `data-[entering=true]`, `data-[disabled=true]` (the react-aria-components
 * attribute surface) and therefore never fired. Keep these selectors in
 * sync with Radix UI if the primitive library ever changes.
 */

export const dropdownMenuPopoverVariants = cva(
  "z-50 min-w-[180px] overflow-hidden border bg-surface-02 shadow-panel outline-none " +
    "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 " +
    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 " +
    "data-[side=bottom]:slide-in-from-top-2 " +
    "data-[side=left]:slide-in-from-right-2 " +
    "data-[side=right]:slide-in-from-left-2 " +
    "data-[side=top]:slide-in-from-bottom-2",
  {
    variants: {
      density: {
        brand: "rounded-sm border-hairline-strong p-s-1",
        compact: "rounded-l border-l-border p-[2px]",
      },
    },
    defaultVariants: {
      density: "brand",
    },
  }
);

export const dropdownMenuVariants = cva("outline-none max-h-[360px] overflow-auto");

export const dropdownMenuItemVariants = cva(
  "relative flex cursor-pointer select-none items-center gap-2 outline-none transition-colors " +
    "data-[highlighted]:outline-none " +
    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
  {
    variants: {
      density: {
        brand:
          "rounded-xs px-s-2 py-s-2 font-mono text-mono-lg text-ink " +
          "data-[highlighted]:bg-surface-03 data-[highlighted]:text-ink-hi",
        compact:
          "rounded-l-sm px-[8px] py-[5px] font-sans text-[13px] leading-none text-l-ink " +
          "data-[highlighted]:bg-l-surface-hover data-[highlighted]:text-l-ink",
      },
      danger: {
        true: "text-event-red data-[highlighted]:bg-[rgba(239,68,68,0.08)] data-[highlighted]:text-event-red",
      },
    },
    defaultVariants: {
      density: "brand",
    },
  }
);

export const dropdownMenuSectionVariants = cva("py-s-1");

export const dropdownMenuSectionHeaderVariants = cva("", {
  variants: {
    density: {
      brand:
        "px-s-2 pt-s-2 pb-s-1 font-mono text-mono-sm uppercase tracking-tactical text-ink-dim",
      compact:
        "px-[8px] pt-[6px] pb-[3px] font-sans text-[11px] font-medium tracking-normal text-l-ink-dim",
    },
  },
  defaultVariants: {
    density: "brand",
  },
});

export const dropdownMenuSeparatorVariants = cva("h-px bg-hairline", {
  variants: {
    density: {
      brand: "my-s-1",
      compact: "my-[3px] bg-l-border-faint",
    },
  },
  defaultVariants: {
    density: "brand",
  },
});
