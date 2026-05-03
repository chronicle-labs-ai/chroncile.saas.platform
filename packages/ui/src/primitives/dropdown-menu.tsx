"use client";

/*
 * DropdownMenu — Radix menu compound with Chronicle styling.
 *
 *   <DropdownMenu>
 *     <DropdownMenuTrigger>
 *       <Button>Actions</Button>
 *     </DropdownMenuTrigger>
 *     <DropdownMenuContent>
 *       <DropdownMenuItem onAction={() => ...}>Open</DropdownMenuItem>
 *       <DropdownMenuSection title="Danger">
 *         <DropdownMenuItem onAction={() => ...}>Delete</DropdownMenuItem>
 *       </DropdownMenuSection>
 *     </DropdownMenuContent>
 *   </DropdownMenu>
 */

import * as React from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { cva } from "class-variance-authority";

import { cn } from "../utils/cn";

/*
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
    "data-[side=top]:slide-in-from-bottom-2 rounded-md border-hairline-strong p-[2px]"
);

export const dropdownMenuVariants = cva(
  "outline-none max-h-[360px] overflow-auto"
);

export const dropdownMenuItemVariants = cva(
  "relative flex cursor-pointer select-none items-center gap-2 outline-none transition-colors " +
    "data-[highlighted]:outline-none " +
    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 rounded-xs px-[8px] py-[5px] font-sans text-[13px] leading-none text-l-ink data-[highlighted]:bg-l-surface-hover data-[highlighted]:text-l-ink",
  {
    variants: {
      danger: {
        true: "text-event-red data-[highlighted]:bg-[rgba(239,68,68,0.08)] data-[highlighted]:text-event-red",
      },
    },
  }
);

export const dropdownMenuSectionVariants = cva("py-s-1");

export const dropdownMenuSectionHeaderVariants = cva(
  "px-[8px] pt-[6px] pb-[3px] font-sans text-[11px] font-medium tracking-normal text-l-ink-dim"
);

export const dropdownMenuSeparatorVariants = cva(
  "h-px bg-hairline my-[3px] bg-l-border-faint"
);

export interface DropdownMenuProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Root> {}

export function DropdownMenu(props: DropdownMenuProps) {
  return <DropdownMenuPrimitive.Root {...props} />;
}

export function DropdownMenuTrigger({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DropdownMenuPrimitive.Trigger asChild>
      {children}
    </DropdownMenuPrimitive.Trigger>
  );
}

export interface DropdownMenuContentProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>,
    "className" | "children"
  > {
  className?: string;
  classNames?: { popover?: string; menu?: string };
  children: React.ReactNode;
}

export function DropdownMenuContent({
  className,
  classNames,
  children,
  ...rest
}: DropdownMenuContentProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        {...rest}
        className={cn(
          dropdownMenuPopoverVariants(),
          dropdownMenuVariants(),
          classNames?.popover,
          classNames?.menu,
          className
        )}
      >
        {children as React.ReactNode}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
}

export interface DropdownMenuItemProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>,
    "className"
  > {
  className?: string;
  /** Apply destructive styling (red). */
  danger?: boolean;
  onAction?: () => void;
}

export function DropdownMenuItem({
  className,
  danger = false,
  onAction,
  onSelect,
  ...props
}: DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      {...props}
      onSelect={(event) => {
        onSelect?.(event);
        if (!event.defaultPrevented) onAction?.();
      }}
      className={cn(dropdownMenuItemVariants({ danger }), className)}
    />
  );
}

export interface DropdownMenuSectionProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Group>,
    "className" | "children" | "title"
  > {
  className?: string;
  title?: React.ReactNode;
  children?: React.ReactNode;
}

export function DropdownMenuSection({
  className,
  title,
  children,
  ...rest
}: DropdownMenuSectionProps) {
  return (
    <DropdownMenuPrimitive.Group
      {...rest}
      className={dropdownMenuSectionVariants({ className })}
    >
      {title ? (
        <DropdownMenuPrimitive.Label
          className={dropdownMenuSectionHeaderVariants()}
        >
          {title}
        </DropdownMenuPrimitive.Label>
      ) : null}
      {children as React.ReactNode}
    </DropdownMenuPrimitive.Group>
  );
}

export function DropdownMenuSeparator() {
  return (
    <DropdownMenuPrimitive.Separator
      className={dropdownMenuSeparatorVariants()}
    />
  );
}
