"use client";

/*
 * Drawer — touch-first slide-over backed by `vaul`. Vaul owns motion
 * (spring physics, drag-to-dismiss, snap points, the optional drag
 * handle); Chronicle owns the chrome (surface stack, hairline border,
 * 14 px header / 14 px body / 14 px actions rhythm) via the same
 * `drawer*Variants` CVAs that the shadcn-shape `<Sheet>` compound also
 * consumes.
 *
 * Use `<Drawer>` for mobile-feeling side or bottom sheets where drag
 * affordance and snap points matter. For desktop side panels with the
 * straight shadcn compound API (`SheetTrigger` / `SheetContent` / …),
 * reach for `<Sheet>` from `./sheet` instead — it stays on Radix
 * Dialog and inherits this file's chrome variants without the Vaul
 * runtime cost.
 *
 *   <Drawer
 *     isOpen={open}
 *     onClose={() => setOpen(false)}
 *     title="Filters"
 *     placement="bottom"
 *     showHandle
 *     snapPoints={["140px", 0.5, 1]}
 *     actions={<Button>Apply</Button>}
 *   >
 *     …
 *   </Drawer>
 */

import * as React from "react";
import { Drawer as VaulPrimitive } from "vaul";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../utils/cn";

/*
 * Variant classnames for the historical Radix-backed `<Drawer>` chrome.
 * The shadcn-shape `<Sheet>` compound at `./sheet` still imports these
 * (its slide-in animations come from `tailwindcss-animate`'s
 * `data-[state=open]:slide-in-*` utilities, which Radix Dialog drives
 * through `data-state="open" | "closed"` on Overlay and Content).
 *
 * The Vaul-backed `<Drawer>` below intentionally does NOT apply the
 * `drawerVariants` slide-in classes to its content — Vaul renders its
 * own `transform: translate3d()` via spring physics, and combining the
 * two animation systems produces visible jank. We expose
 * `drawerVaulContentVariants` for that path.
 */

export const drawerOverlayVariants = cva(
  "fixed inset-0 z-overlay flex bg-black/60 " +
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
  "relative flex flex-col bg-surface-01 shadow-panel outline-none h-full border-hairline-strong",
  {
    variants: {
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
      placement: "right",
      size: "md",
    },
  }
);

/*
 * Vaul-flavored content chrome. Same surfaces / borders / sizing as
 * `drawerVariants` minus the Radix slide animations. Vaul owns motion.
 *
 * For `placement="bottom" | "top"`, the leading edge is rounded so the
 * drawer reads as a sheet pulled up from the viewport edge — matches
 * the upstream shadcn `Drawer` recipe.
 */
export const drawerVaulContentVariants = cva(
  "fixed z-50 flex flex-col bg-surface-01 shadow-panel outline-none border-hairline-strong",
  {
    variants: {
      placement: {
        right: "right-0 top-0 h-full w-full max-w-[520px] border-l",
        left: "left-0 top-0 h-full w-full max-w-[520px] border-r",
        bottom:
          "bottom-0 inset-x-0 mt-24 max-h-[96vh] border-t rounded-t-md",
        top: "top-0 inset-x-0 mb-24 max-h-[96vh] border-b rounded-b-md",
      },
      size: {
        sm: "",
        md: "",
        lg: "max-w-[720px]",
        xl: "max-w-[960px]",
      },
    },
    defaultVariants: {
      placement: "right",
      size: "md",
    },
  }
);

export const drawerDialogVariants = cva("flex h-full flex-col outline-none");

export const drawerHeaderVariants = cva(
  "flex items-center justify-between border-b border-hairline bg-surface-02 px-[14px] py-[10px]"
);

export const drawerTitleVariants = cva(
  "text-ink-hi font-sans text-[14px] font-medium tracking-normal"
);

export const drawerCloseVariants = cva(
  "inline-flex items-center justify-center text-ink-dim transition-colors duration-fast ease-out touch-manipulation " +
    "hover:bg-surface-03 hover:text-ink-hi " +
    "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember h-7 w-7 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 rounded-md"
);

export const drawerBodyVariants = cva(
  "flex-1 overflow-auto text-ink-lo px-[14px] py-[14px] font-sans text-[13px] leading-snug"
);

export const drawerActionsVariants = cva(
  "flex items-center justify-end border-t border-hairline bg-surface-02 gap-[8px] px-[14px] py-[10px]"
);

export const drawerHandleVariants = cva(
  "mx-auto my-[8px] h-[4px] w-[44px] shrink-0 rounded-full bg-l-border-strong/70"
);

type DrawerVariantProps = VariantProps<typeof drawerVaulContentVariants>;

export interface DrawerProps extends DrawerVariantProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  placement?: "left" | "right" | "top" | "bottom";
  size?: "sm" | "md" | "lg" | "xl";
  /**
   * Defaults to true — drag-past-threshold, outside click, and Escape
   * dismiss. Set false to lock the drawer open from outside.
   */
  isDismissable?: boolean;
  /**
   * Show the drag handle at the leading edge. Defaults to `true` for
   * `bottom` / `top` placements (mobile sheet convention), `false` for
   * `left` / `right` (desktop side panel convention).
   */
  showHandle?: boolean;
  /**
   * Only allow dragging from the `<Drawer.Handle>` strip. Useful when
   * the drawer body has its own scroll/draggable surface.
   */
  handleOnly?: boolean;
  /**
   * Snap points for partial-height drawers. Pass percentages (numbers
   * between 0 and 1) or px values as strings (e.g. `["140px", 0.5, 1]`).
   * Vaul's snap-point physics keeps the drawer between these stops.
   */
  snapPoints?: (number | string)[];
  /** Controlled active snap point. */
  activeSnapPoint?: number | string | null;
  /** Fires when Vaul transitions between snap points. */
  setActiveSnapPoint?: (snapPoint: number | string | null) => void;
  /** Index of the snap point at which the overlay should fade. */
  fadeFromIndex?: number;
  /**
   * `false` lets clicks reach elements outside the drawer without
   * closing it. Defaults to `true`.
   */
  modal?: boolean;
  /**
   * Vaul's keyboard-aware input repositioning. Defaults to `true` when
   * `snapPoints` is provided.
   */
  repositionInputs?: boolean;
  /**
   * Threshold (0–1) of drawer height the user has to drag past before
   * the drawer dismisses. Defaults to Vaul's 0.25.
   */
  closeThreshold?: number;
  /**
   * Vaul's "scale the page back" effect (iOS-style). Off by default —
   * Chronicle's chrome relies on a flat black canvas, and the scaled
   * background reads as visual noise on dark surfaces.
   */
  shouldScaleBackground?: boolean;
  className?: string;
  classNames?: {
    overlay?: string;
    drawer?: string;
    dialog?: string;
    header?: string;
    title?: string;
    close?: string;
    body?: string;
    actions?: string;
    handle?: string;
  };
}

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  actions,
  placement = "right",
  size = "md",
  isDismissable = true,
  showHandle,
  handleOnly,
  snapPoints,
  activeSnapPoint,
  setActiveSnapPoint,
  fadeFromIndex,
  modal = true,
  repositionInputs,
  closeThreshold,
  shouldScaleBackground = false,
  className,
  classNames,
}: DrawerProps) {
  const resolvedShowHandle =
    showHandle ?? (placement === "bottom" || placement === "top");

  /*
   * Vaul's `DialogProps` is a discriminated union — `fadeFromIndex` is
   * `never` when `snapPoints` is absent. We carry `fadeFromIndex` as
   * an optional field on `DrawerProps` and only forward it on the
   * snap-point branch, so the runtime is sound. TS can't narrow our
   * conditional spread well enough on its own, so the prop bag is
   * built imperatively and asserted at the boundary.
   */
  const rootProps: React.ComponentProps<typeof VaulPrimitive.Root> = {
    open: isOpen,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
    direction: placement,
    dismissible: isDismissable,
    modal,
    handleOnly,
    shouldScaleBackground,
    closeThreshold,
    repositionInputs,
    ...(snapPoints
      ? {
          snapPoints,
          fadeFromIndex,
          activeSnapPoint,
          setActiveSnapPoint,
        }
      : {}),
  } as React.ComponentProps<typeof VaulPrimitive.Root>;

  return (
    <VaulPrimitive.Root {...rootProps}>
      <VaulPrimitive.Portal>
        <VaulPrimitive.Overlay
          className={cn(drawerOverlayVariants({ placement }), classNames?.overlay)}
        />
        <VaulPrimitive.Content
          data-placement={placement}
          className={cn(
            drawerVaulContentVariants({ placement, size }),
            classNames?.drawer,
            className
          )}
        >
          <div
            className={drawerDialogVariants({ className: classNames?.dialog })}
          >
            {resolvedShowHandle ? (
              <VaulPrimitive.Handle
                aria-label="Drag handle"
                className={cn(drawerHandleVariants(), classNames?.handle)}
              />
            ) : null}

            <div
              className={drawerHeaderVariants({ className: classNames?.header })}
            >
              <VaulPrimitive.Title
                className={drawerTitleVariants({ className: classNames?.title })}
              >
                {title}
              </VaulPrimitive.Title>
              <VaulPrimitive.Close asChild>
                <button
                  type="button"
                  aria-label="Close drawer"
                  className={drawerCloseVariants({ className: classNames?.close })}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                    <path
                      d="M6 18L18 6M6 6l12 12"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </VaulPrimitive.Close>
            </div>

            <div className={drawerBodyVariants({ className: classNames?.body })}>
              {children}
            </div>

            {actions ? (
              <div
                className={drawerActionsVariants({
                  className: classNames?.actions,
                })}
              >
                {actions}
              </div>
            ) : null}
          </div>
        </VaulPrimitive.Content>
      </VaulPrimitive.Portal>
    </VaulPrimitive.Root>
  );
}
