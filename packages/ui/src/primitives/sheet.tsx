"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";

import { cn } from "../utils/cn";
import {
  drawerActionsVariants,
  drawerBodyVariants,
  drawerCloseVariants,
  drawerHeaderVariants,
  drawerOverlayVariants,
  drawerTitleVariants,
  drawerVariants,
} from "./drawer";

/*
 * Sheet — shadcn-style side-panel compound. Uses the same Radix Dialog
 * primitive and the same `drawer*Variants` chrome as `<Drawer>`, so
 * paste-in shadcn snippets that import `<Sheet>`, `<SheetTrigger>`,
 * `<SheetContent>`, `<SheetHeader>`, etc. resolve cleanly without
 * forcing consumers to learn Chronicle's declarative `<Drawer>` API.
 *
 * For the simpler declarative shape (`<Drawer isOpen onClose title
 * actions placement size>`), keep reaching for `<Drawer>` directly.
 *
 *   <Sheet>
 *     <SheetTrigger asChild>
 *       <Button>Open</Button>
 *     </SheetTrigger>
 *     <SheetContent side="right">
 *       <SheetHeader>
 *         <SheetTitle>Filters</SheetTitle>
 *         <SheetDescription>Narrow the trace stream.</SheetDescription>
 *       </SheetHeader>
 *       <div className="px-[14px] py-[14px]">…</div>
 *       <SheetFooter>
 *         <SheetClose asChild><Button variant="secondary">Done</Button></SheetClose>
 *       </SheetFooter>
 *     </SheetContent>
 *   </Sheet>
 */

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

function SheetOverlay({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(drawerOverlayVariants({ placement: "right" }), className)}
      {...props}
    />
  );
}

export type SheetSide = "top" | "right" | "bottom" | "left";

export interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> {
  side?: SheetSide;
  size?: "sm" | "md" | "lg" | "xl";
  /** Hide the built-in close button. Default: false (close button shown). */
  hideClose?: boolean;
}

function SheetContent({
  className,
  side = "right",
  size = "md",
  hideClose = false,
  children,
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetPrimitive.Overlay
        data-slot="sheet-overlay"
        className={drawerOverlayVariants({ placement: side })}
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(drawerVariants({ placement: side, size }), className)}
        {...props}
      >
        {children}
        {hideClose ? null : (
          <SheetPrimitive.Close
            aria-label="Close"
            className={cn(
              drawerCloseVariants(),
              "absolute right-[10px] top-[10px]"
            )}
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path
                d="M6 18L18 6M6 6l12 12"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            </svg>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(drawerHeaderVariants(), className)}
      {...props}
    />
  );
}

function SheetFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(drawerActionsVariants(), className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(drawerTitleVariants(), className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn(
        drawerBodyVariants(),
        "py-[6px] text-l-ink-dim",
        className
      )}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
