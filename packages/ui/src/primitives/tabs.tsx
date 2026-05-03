"use client";

/*
 * Tabs — horizontally arranged, keyboard-navigable (arrow/home/end)
 * content panels backed by Radix Tabs.
 *
 *   <Tabs defaultValue="events">
 *     <TabList aria-label="Dashboard">
 *       <Tab id="events">Events</Tab>
 *       <Tab id="runs">Runs</Tab>
 *       <Tab id="rules">Rules</Tab>
 *     </TabList>
 *     <TabPanel id="events">…</TabPanel>
 *     <TabPanel id="runs">…</TabPanel>
 *     <TabPanel id="rules">…</TabPanel>
 *   </Tabs>
 */

import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cva } from "class-variance-authority";

import { cn } from "../utils/cn";

export const tabsRootVariants = cva(
  "flex flex-col data-[orientation=vertical]:flex-row gap-[12px]"
);

export const tabsListVariants = cva(
  "flex border-b border-hairline data-[orientation=vertical]:flex-col data-[orientation=vertical]:border-b-0 data-[orientation=vertical]:border-r gap-[2px] data-[orientation=vertical]:gap-[2px]"
);

/*
 * Radix Tabs emits `data-state="active" | "inactive"` on Trigger/Content,
 * `data-disabled` on disabled Trigger, and `data-orientation`. It does NOT
 * emit `data-selected`/`data-hovered`/`data-focus-visible`. Earlier
 * revisions targeted those (RAC vintage) and never fired.
 */
export const tabVariants = cva(
  "relative cursor-pointer outline-none transition-colors duration-fast ease-out " +
    "data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:bg-ember data-[state=active]:after:h-[2px] " +
    "data-[state=active]:text-l-ink hover:text-l-ink " +
    "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember " +
    "data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed " +
    "px-[10px] py-[6px] font-sans text-[13px] font-medium tracking-normal leading-none text-l-ink-lo"
);

export const tabPanelVariants = cva("outline-none");

export interface TabsProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>,
    "className" | "children"
  > {
  className?: string;
  children: React.ReactNode;
  /** @deprecated Use `value` (Radix / shadcn canonical). */
  selectedKey?: string;
  /** @deprecated Use `defaultValue`. */
  defaultSelectedKey?: string;
  /** @deprecated Use `onValueChange`. */
  onSelectionChange?: (key: string) => void;
  ref?: React.Ref<HTMLDivElement>;
}

export function Tabs({
  className,
  children,
  value,
  defaultValue,
  onValueChange,
  selectedKey,
  defaultSelectedKey,
  onSelectionChange,
  ref,
  ...rest
}: TabsProps) {
  return (
    <TabsPrimitive.Root
      {...rest}
      ref={ref}
      value={value ?? selectedKey}
      defaultValue={defaultValue ?? defaultSelectedKey}
      onValueChange={(next) => {
        onValueChange?.(next);
        onSelectionChange?.(next);
      }}
      className={cn(tabsRootVariants(), className)}
    >
      {children}
    </TabsPrimitive.Root>
  );
}

export interface TabListProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    "className" | "children"
  > {
  className?: string;
  children: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}

export function TabList({
  className,
  children,
  ref,
  ...rest
}: TabListProps) {
  return (
    <TabsPrimitive.List
      {...rest}
      ref={ref}
      className={cn(tabsListVariants(), className)}
    >
      {children as React.ReactNode}
    </TabsPrimitive.List>
  );
}

export interface TabProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>,
    "className" | "value"
  > {
  className?: string;
  value?: string;
  /** @deprecated Use `value` (matches Radix Tabs / shadcn). */
  id?: string;
  ref?: React.Ref<HTMLButtonElement>;
}

export function Tab({ className, ref, value, id, ...rest }: TabProps) {
  return (
    <TabsPrimitive.Trigger
      {...rest}
      ref={ref}
      value={value ?? id ?? ""}
      className={cn(tabVariants(), className)}
    />
  );
}

export interface TabPanelProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>,
    "className" | "value"
  > {
  className?: string;
  value?: string;
  /** @deprecated Use `value` (matches Radix Tabs / shadcn). */
  id?: string;
  ref?: React.Ref<HTMLDivElement>;
}

export function TabPanel({
  className,
  ref,
  value,
  id,
  ...rest
}: TabPanelProps) {
  return (
    <TabsPrimitive.Content
      {...rest}
      ref={ref}
      value={value ?? id ?? ""}
      className={cn(tabPanelVariants(), className)}
    />
  );
}
