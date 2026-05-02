import { cva } from "class-variance-authority";

/*
 * Variant classnames for `<Drawer>` — consumed by
 * `packages/ui/src/primitives/drawer.tsx`, which wires them onto
 * `radix-ui`'s `Dialog.*` primitives.
 *
 * Radix Dialog emits:
 *   - `data-state="open" | "closed"` on `Overlay` and `Content`
 *
 * Slide utilities (`slide-in-from-*`, `slide-out-to-*`) come from the
 * `tailwindcss-animate` plugin registered in the preset.
 */

export const drawerOverlayVariants = cva(
  "fixed inset-0 z-50 flex bg-black/60 " +
    "data-[state=open]:animate-in data-[state=open]:fade-in-0 " +
    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
  {
    variants: {
      placement: {
        right: "justify-end",
        left: "justify-start",
        bottom: "items-end",
        top: "items-start",
      },
    },
    defaultVariants: {
      placement: "right",
    },
  }
);

export const drawerVariants = cva(
  "relative flex flex-col bg-surface-01 shadow-panel outline-none h-full",
  {
    variants: {
      density: {
        brand: "border-hairline-strong",
        compact: "border-l-border",
      },
      placement: {
        right:
          "w-full max-w-[520px] border-l " +
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-right " +
          "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right",
        left:
          "w-full max-w-[520px] border-r " +
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-left " +
          "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left",
        bottom:
          "w-full max-h-[80vh] border-t " +
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom " +
          "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
        top:
          "w-full max-h-[80vh] border-b " +
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-top " +
          "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-top",
      },
      size: {
        sm: "",
        md: "",
        lg: "max-w-[720px]",
        xl: "max-w-[960px]",
      },
    },
    defaultVariants: {
      density: "brand",
      placement: "right",
      size: "md",
    },
  }
);

export const drawerDialogVariants = cva("flex h-full flex-col outline-none");

export const drawerHeaderVariants = cva(
  "flex items-center justify-between border-b border-hairline bg-surface-02",
  {
    variants: {
      density: {
        brand: "px-s-5 py-s-3",
        compact: "px-[14px] py-[10px]",
      },
    },
    defaultVariants: {
      density: "brand",
    },
  }
);

export const drawerTitleVariants = cva("text-ink-hi", {
  variants: {
    density: {
      brand: "font-display text-title-sm tracking-tight",
      compact: "font-sans text-[14px] font-medium tracking-normal",
    },
  },
  defaultVariants: {
    density: "brand",
  },
});

export const drawerCloseVariants = cva(
  "inline-flex items-center justify-center text-ink-dim transition-colors duration-fast ease-out " +
    "hover:bg-surface-03 hover:text-ink-hi " +
    "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
  {
    variants: {
      density: {
        brand: "h-8 w-8 rounded-sm",
        compact: "h-7 w-7 rounded-l",
      },
    },
    defaultVariants: {
      density: "brand",
    },
  }
);

export const drawerBodyVariants = cva("flex-1 overflow-auto text-ink-lo", {
  variants: {
    density: {
      brand: "px-s-5 py-s-4 text-body-sm",
      compact: "px-[14px] py-[14px] font-sans text-[13px] leading-snug",
    },
  },
  defaultVariants: {
    density: "brand",
  },
});

export const drawerActionsVariants = cva(
  "flex items-center justify-end border-t border-hairline bg-surface-02",
  {
    variants: {
      density: {
        brand: "gap-s-3 px-s-5 py-s-3",
        compact: "gap-[8px] px-[14px] py-[10px]",
      },
    },
    defaultVariants: {
      density: "brand",
    },
  }
);
