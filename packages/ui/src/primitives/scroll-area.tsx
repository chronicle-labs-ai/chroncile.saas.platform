"use client";

import * as React from "react";
import { ScrollArea as ScrollAreaPrimitive } from "radix-ui";

import { cn } from "../utils/cn";

/*
 * ScrollArea — Radix-backed custom scrollbars. Distinct from
 * `<ScrollShadow>` (which paints gradient masks at the edges of an
 * overflowing region). Reach for ScrollArea when you want explicit,
 * styled scrollbars; ScrollShadow when you want the native scrollbar
 * to stay invisible and the affordance to come from the gradient.
 *
 *   <ScrollArea className="h-[320px] w-full">
 *     <div className="p-[12px] space-y-2">…</div>
 *   </ScrollArea>
 */

function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="h-full w-full rounded-[inherit] outline-none"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Scrollbar>) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex touch-none select-none transition-colors p-px",
        orientation === "vertical" && "h-full w-[8px] border-l border-transparent",
        orientation === "horizontal" && "h-[8px] flex-col border-t border-transparent",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-hairline-strong hover:bg-l-ink-dim"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export { ScrollArea, ScrollBar };
