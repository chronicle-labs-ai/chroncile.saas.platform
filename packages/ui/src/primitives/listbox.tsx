"use client";

/*
 * Listbox — standalone selection list (no trigger, no popover). Use for
 * in-flow pickers where the options should always be visible (detail
 * panels, settings sheets). For a closed-by-default picker use `Select`.
 */

import * as React from "react";
import {
  ListBox as RACListBox,
  ListBoxItem as RACListBoxItem,
  ListBoxSection as RACListBoxSection,
  Header as RACHeader,
  Collection as RACCollection,
  type ListBoxProps as RACListBoxProps,
  type ListBoxItemProps as RACListBoxItemProps,
  type ListBoxSectionProps as RACListBoxSectionProps,
} from "react-aria-components";

import { tv } from "../utils/tv";
import { composeTwRenderProps } from "../utils/compose";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

const listboxStyles = tv({
  slots: {
    root:
      "flex flex-col border bg-surface-01 outline-none max-h-[320px] overflow-auto " +
      "data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1 " +
      "data-[focus-visible=true]:outline-ember",
    item:
      "relative cursor-pointer select-none outline-none " +
      "data-[disabled=true]:opacity-50 data-[disabled=true]:cursor-not-allowed",
    section: "py-s-1",
    sectionHeader: "",
  },
  variants: {
    density: {
      brand: {
        root: "rounded-sm border-hairline p-s-1",
        item:
          "rounded-xs px-s-2 py-s-2 font-mono text-mono-lg text-ink " +
          "data-[focused=true]:bg-surface-03 " +
          "data-[selected=true]:text-ink-hi data-[selected=true]:bg-surface-03",
        sectionHeader:
          "px-s-2 pt-s-2 pb-s-1 font-mono text-mono-sm uppercase tracking-tactical text-ink-dim",
      },
      compact: {
        root: "rounded-l border-l-border p-[2px]",
        item:
          "rounded-l-sm px-[8px] py-[5px] font-sans text-[13px] leading-none text-l-ink " +
          "data-[focused=true]:bg-l-surface-hover " +
          "data-[selected=true]:text-l-ink data-[selected=true]:bg-l-surface-selected",
        sectionHeader:
          "px-[8px] pt-[6px] pb-[3px] font-sans text-[11px] font-medium tracking-normal text-l-ink-dim",
      },
    },
  },
  defaultVariants: { density: "brand" },
});

const ListboxDensityContext = React.createContext<"compact" | "brand" | undefined>(
  undefined,
);

export interface ListboxProps<T extends object> extends Omit<
  RACListBoxProps<T>,
  "className" | "children"
> {
  className?: string;
  density?: "compact" | "brand";
  children: React.ReactNode;
}

export function Listbox<T extends object>({
  className,
  density: densityProp,
  children,
  ...rest
}: ListboxProps<T>) {
  const density = useResolvedChromeDensity(densityProp);
  const slots = listboxStyles({ density });
  return (
    <ListboxDensityContext.Provider value={density}>
      <RACListBox
        {...(rest as RACListBoxProps<T>)}
        data-density={density}
        className={composeTwRenderProps(className, slots.root())}
      >
        {children as React.ReactNode}
      </RACListBox>
    </ListboxDensityContext.Provider>
  );
}

export interface ListboxItemProps<T extends object = object> extends Omit<
  RACListBoxItemProps<T>,
  "className"
> {
  className?: string;
}

export function ListboxItem<T extends object = object>({
  className,
  ...props
}: ListboxItemProps<T>) {
  const ctxDensity = React.useContext(ListboxDensityContext);
  const density = useResolvedChromeDensity(ctxDensity);
  const slots = listboxStyles({ density });
  return (
    <RACListBoxItem
      {...(props as RACListBoxItemProps<T>)}
      className={composeTwRenderProps(className, slots.item())}
    />
  );
}

export interface ListboxSectionProps<T extends object> extends Omit<
  RACListBoxSectionProps<T>,
  "className" | "children"
> {
  className?: string;
  title?: React.ReactNode;
  items?: Iterable<T>;
  children?: React.ReactNode | ((item: T) => React.ReactElement);
}

export function ListboxSection<T extends object>({
  className,
  title,
  items,
  children,
  ...rest
}: ListboxSectionProps<T>) {
  const ctxDensity = React.useContext(ListboxDensityContext);
  const density = useResolvedChromeDensity(ctxDensity);
  const slots = listboxStyles({ density });
  return (
    <RACListBoxSection
      {...(rest as RACListBoxSectionProps<T>)}
      className={slots.section({ className })}
    >
      {title ? (
        <RACHeader className={slots.sectionHeader()}>{title}</RACHeader>
      ) : null}
      {items ? (
        <RACCollection items={items}>
          {children as (item: T) => React.ReactElement}
        </RACCollection>
      ) : (
        (children as React.ReactNode)
      )}
    </RACListBoxSection>
  );
}
