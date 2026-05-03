"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Dialog as DialogPrimitive } from "radix-ui";

import { cn } from "../utils/cn";
import { modalOverlayVariants } from "./modal";

/*
 * Command — Cmd+K palette built on `cmdk` with shadcn's compound API and
 * Chronicle chrome. Wrap-and-render via `<CommandDialog>` for a
 * full-bleed palette, or render `<Command>` inline for embedded use.
 *
 *   <CommandDialog open={open} onOpenChange={setOpen}>
 *     <CommandInput placeholder="Search runs, datasets, agents…" />
 *     <CommandList>
 *       <CommandEmpty>No matches.</CommandEmpty>
 *       <CommandGroup heading="Recent">
 *         <CommandItem onSelect={() => …}>Open run #42</CommandItem>
 *       </CommandGroup>
 *       <CommandSeparator />
 *       <CommandGroup heading="Workspaces">
 *         <CommandItem>Switch to staging</CommandItem>
 *       </CommandGroup>
 *     </CommandList>
 *   </CommandDialog>
 */

function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-md border border-hairline-strong bg-l-surface-raised text-l-ink shadow-panel",
        className
      )}
      {...props}
    />
  );
}

export interface CommandDialogProps
  extends React.ComponentProps<typeof DialogPrimitive.Root> {
  title?: string;
  description?: string;
  className?: string;
}

function CommandDialog({
  title = "Command palette",
  description = "Search for a command to run.",
  children,
  className,
  ...props
}: CommandDialogProps) {
  return (
    <DialogPrimitive.Root {...props}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={modalOverlayVariants()} />
        <DialogPrimitive.Content
          className={cn(
            "fixed top-[20%] left-[50%] z-50 w-[calc(100vw-2rem)] max-w-[640px] translate-x-[-50%] overflow-hidden rounded-md border border-hairline-strong bg-l-surface-raised shadow-panel outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            className
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {description}
          </DialogPrimitive.Description>
          <Command className="[&_[cmdk-group-heading]]:px-[10px] [&_[cmdk-group-heading]]:font-sans [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-normal [&_[cmdk-group-heading]]:text-l-ink-dim [&_[cmdk-group]]:px-[2px] [&_[cmdk-input-wrapper]_svg]:h-4 [&_[cmdk-input-wrapper]_svg]:w-4 [&_[cmdk-input]]:h-[40px] [&_[cmdk-item]]:px-[8px] [&_[cmdk-item]]:py-[5px] [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4 border-0 shadow-none">
            {children}
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div
      data-slot="command-input-wrapper"
      className="flex h-[40px] items-center gap-[8px] border-b border-hairline px-[12px]"
      cmdk-input-wrapper=""
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="h-4 w-4 shrink-0 text-l-ink-dim"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
      </svg>
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "flex h-full w-full bg-transparent font-sans text-[13px] text-l-ink outline-none placeholder:text-l-ink-dim disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    </div>
  );
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "max-h-[320px] overflow-y-auto overflow-x-hidden scroll-py-1",
        className
      )}
      {...props}
    />
  );
}

function CommandEmpty(
  props: React.ComponentProps<typeof CommandPrimitive.Empty>
) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className="py-[20px] text-center font-sans text-[12px] text-l-ink-dim"
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "overflow-hidden p-[2px] text-l-ink",
        className
      )}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("-mx-[4px] h-px bg-hairline", className)}
      {...props}
    />
  );
}

function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-[8px] rounded-xs px-[8px] py-[5px] font-sans text-[13px] leading-none text-l-ink outline-none",
        "data-[selected=true]:bg-l-surface-hover data-[selected=true]:text-l-ink",
        "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        className
      )}
      {...props}
    />
  );
}

function CommandShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "ml-auto font-mono text-[10px] tracking-mono text-l-ink-dim",
        className
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
