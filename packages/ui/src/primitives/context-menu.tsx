"use client";

import * as React from "react";
import { ContextMenu as ContextMenuPrimitive } from "radix-ui";

import { cn } from "../utils/cn";

/*
 * ContextMenu — right-click menu. Same chrome as `<DropdownMenu>` but
 * triggered by a mouse `contextmenu` event (or two-finger tap on
 * touch). Reach for it on heavy-list rows, table cells, or any
 * surface where the right-click action set is contextual.
 *
 *   <ContextMenu>
 *     <ContextMenuTrigger>Right-click me</ContextMenuTrigger>
 *     <ContextMenuContent>
 *       <ContextMenuItem onSelect={() => …}>Copy</ContextMenuItem>
 *       <ContextMenuSeparator />
 *       <ContextMenuItem variant="destructive">Delete</ContextMenuItem>
 *     </ContextMenuContent>
 *   </ContextMenu>
 */

const ContextMenu = ContextMenuPrimitive.Root;
const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
const ContextMenuGroup = ContextMenuPrimitive.Group;
const ContextMenuPortal = ContextMenuPrimitive.Portal;
const ContextMenuSub = ContextMenuPrimitive.Sub;
const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;

function ContextMenuContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        data-slot="context-menu-content"
        className={cn(
          "z-50 min-w-[180px] overflow-hidden rounded-md border border-hairline-strong bg-surface-02 p-[2px] shadow-panel outline-none",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}

function ContextMenuItem({
  className,
  variant,
  ...props
}: React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
  variant?: "default" | "destructive";
}) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      data-variant={variant}
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-[8px] rounded-xs px-[8px] py-[5px] font-sans text-[13px] leading-none outline-none",
        "data-[highlighted]:bg-l-surface-hover",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "text-l-ink data-[highlighted]:text-l-ink",
        variant === "destructive" &&
          "text-event-red data-[highlighted]:bg-[rgba(239,68,68,0.08)] data-[highlighted]:text-event-red",
        className
      )}
      {...props}
    />
  );
}

function ContextMenuLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label>) {
  return (
    <ContextMenuPrimitive.Label
      data-slot="context-menu-label"
      className={cn(
        "px-[8px] pt-[6px] pb-[3px] font-sans text-[11px] font-medium tracking-normal text-l-ink-dim",
        className
      )}
      {...props}
    />
  );
}

function ContextMenuSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn("-mx-[2px] my-[3px] h-px bg-l-border-faint", className)}
      {...props}
    />
  );
}

function ContextMenuShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="context-menu-shortcut"
      className={cn(
        "ml-auto font-mono text-[10px] tracking-mono text-l-ink-dim",
        className
      )}
      {...props}
    />
  );
}

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger> & {
  inset?: boolean;
}) {
  return (
    <ContextMenuPrimitive.SubTrigger
      data-slot="context-menu-sub-trigger"
      className={cn(
        "flex cursor-pointer select-none items-center rounded-xs px-[8px] py-[5px] font-sans text-[13px] outline-none data-[highlighted]:bg-l-surface-hover data-[state=open]:bg-l-surface-hover",
        inset && "pl-[24px]",
        className
      )}
      {...props}
    >
      {children}
      <svg viewBox="0 0 24 24" fill="none" className="ml-auto h-3.5 w-3.5">
        <path
          d="m9 5 7 7-7 7"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </ContextMenuPrimitive.SubTrigger>
  );
}

function ContextMenuSubContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>) {
  return (
    <ContextMenuPrimitive.SubContent
      data-slot="context-menu-sub-content"
      className={cn(
        "z-50 min-w-[180px] overflow-hidden rounded-md border border-hairline-strong bg-surface-02 p-[2px] shadow-panel outline-none",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        className
      )}
      {...props}
    />
  );
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuRadioGroup,
};
