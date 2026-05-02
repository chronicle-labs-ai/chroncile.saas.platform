"use client";

/*
 * Listbox — standalone selection list (no trigger, no popover). Use for
 * in-flow pickers where the options should always be visible (detail
 * panels, settings sheets). For a closed-by-default picker use `Select`.
 */

import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "../utils/cn";

export const listboxRootVariants = cva(
  "flex flex-col border bg-surface-01 outline-none max-h-[320px] overflow-auto focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember rounded-md border-hairline-strong p-[2px]"
);

/*
 * Listbox items are plain `<button>`s. The `data-selected` attribute is
 * set in the component (`data-selected={selected || undefined}`) so the
 * `data-[selected=true]:` selector does fire.
 */
export const listboxItemVariants = cva(
  "relative cursor-pointer select-none outline-none disabled:opacity-50 disabled:cursor-not-allowed rounded-xs px-[8px] py-[5px] font-sans text-[13px] leading-none text-l-ink hover:bg-l-surface-hover focus-visible:bg-l-surface-hover data-[selected=true]:text-l-ink data-[selected=true]:bg-l-surface-selected"
);

export const listboxSectionVariants = cva("py-s-1");

export const listboxSectionHeaderVariants = cva(
  "px-[8px] pt-[6px] pb-[3px] font-sans text-[11px] font-medium tracking-normal text-l-ink-dim"
);

export interface ListboxProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "className" | "children"> {
  className?: string;
  children: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
  selectionMode?: string;
  defaultSelectedKeys?: Iterable<string>;
  selectedKeys?: Iterable<string>;
  onSelectionChange?: (keys: Set<string>) => void;
}

const ListboxValueContext = React.createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
}>({});

export function Listbox({
  className,
  children,
  value,
  onValueChange,
  selectedKeys,
  defaultSelectedKeys,
  onSelectionChange,
  selectionMode: _selectionMode,
  ...rest
}: ListboxProps) {
  const firstSelected = selectedKeys
    ? Array.from(selectedKeys)[0]
    : defaultSelectedKeys
      ? Array.from(defaultSelectedKeys)[0]
      : undefined;
  const resolvedValue = value ?? firstSelected;
  const handleValueChange = React.useCallback(
    (next: string) => {
      onValueChange?.(next);
      onSelectionChange?.(new Set([next]));
    },
    [onSelectionChange, onValueChange]
  );

  return (
    <ListboxValueContext.Provider
      value={{ value: resolvedValue, onValueChange: handleValueChange }}
    >
      <div
        {...rest}
        role="listbox"
        className={cn(listboxRootVariants(), className)}
      >
        {children as React.ReactNode}
      </div>
    </ListboxValueContext.Provider>
  );
}

export interface ListboxItemProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "value"> {
  className?: string;
  value?: string;
  id?: string;
}

export function ListboxItem({
  className,
  value,
  id,
  onClick,
  ...props
}: ListboxItemProps) {
  const selection = React.useContext(ListboxValueContext);
  const itemValue = value ?? id ?? "";
  const selected = selection.value === itemValue;

  return (
    <button
      {...props}
      type="button"
      role="option"
      aria-selected={selected}
      data-selected={selected || undefined}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) selection.onValueChange?.(itemValue);
      }}
      className={cn(listboxItemVariants(), className)}
    />
  );
}

export interface ListboxSectionProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "className" | "children" | "title"> {
  className?: string;
  title?: React.ReactNode;
  children?: React.ReactNode;
}

export function ListboxSection({
  className,
  title,
  children,
  ...rest
}: ListboxSectionProps) {
  return (
    <div
      {...rest}
      role="group"
      className={listboxSectionVariants({ className })}
    >
      {title ? (
        <div className={listboxSectionHeaderVariants()}>{title}</div>
      ) : null}
      {children as React.ReactNode}
    </div>
  );
}
