"use client";

import * as React from "react";
import { HoverCard as HoverCardPrimitive } from "radix-ui";

import { cn } from "../utils/cn";

/*
 * HoverCard — rich preview triggered by hover or focus, no click. Use
 * for entity peeks (user card, dataset preview, run summary) where
 * showing a small overlay on hover saves a navigation. For action
 * menus, use `<DropdownMenu>`. For form pickers, use `<Popover>`.
 *
 *   <HoverCard>
 *     <HoverCardTrigger asChild>
 *       <a href="/users/eve">@eve</a>
 *     </HoverCardTrigger>
 *     <HoverCardContent>
 *       <UserCard user={eve} />
 *     </HoverCardContent>
 *   </HoverCard>
 */

const HoverCard = HoverCardPrimitive.Root;
const HoverCardTrigger = HoverCardPrimitive.Trigger;
const HoverCardPortal = HoverCardPrimitive.Portal;

function HoverCardContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>) {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        data-slot="hover-card-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-[260px] rounded-md border border-hairline-strong bg-surface-02 p-[12px] shadow-panel outline-none",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          "data-[side=bottom]:slide-in-from-top-2",
          "data-[side=left]:slide-in-from-right-2",
          "data-[side=right]:slide-in-from-left-2",
          "data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  );
}

export { HoverCard, HoverCardTrigger, HoverCardContent, HoverCardPortal };
