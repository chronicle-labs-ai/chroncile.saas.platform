"use client";

/*
 * DropdownMenu — RAC's Menu wrapped in a MenuTrigger + Popover so the
 * whole compound feels like a single primitive. Supports arrow/home/end
 * navigation, typeahead, sections, and action-based item handling.
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
import {
  MenuTrigger as RACMenuTrigger,
  Menu as RACMenu,
  MenuItem as RACMenuItem,
  MenuSection as RACMenuSection,
  Popover as RACPopover,
  Header as RACHeader,
  Separator as RACSeparator,
  type MenuTriggerProps,
  type MenuProps as RACMenuProps,
  type MenuItemProps as RACMenuItemProps,
  type MenuSectionProps as RACMenuSectionProps,
  type PopoverProps as RACPopoverProps,
} from "react-aria-components";

import { tv } from "../utils/tv";
import { composeTwRenderProps } from "../utils/compose";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

const menuStyles = tv({
  slots: {
    popover:
      "z-50 min-w-[180px] border bg-surface-02 shadow-panel outline-none " +
      "data-[entering=true]:animate-in data-[entering=true]:fade-in " +
      "data-[exiting=true]:animate-out data-[exiting=true]:fade-out",
    menu: "outline-none max-h-[360px] overflow-auto",
    item:
      "relative cursor-pointer select-none outline-none " +
      "data-[focused=true]:bg-surface-03 " +
      "data-[disabled=true]:opacity-50 data-[disabled=true]:cursor-not-allowed",
    itemDanger: "text-event-red data-[focused=true]:bg-[rgba(239,68,68,0.08)]",
    section: "py-s-1",
    sectionHeader: "",
    separator: "h-px bg-hairline",
  },
  variants: {
    density: {
      brand: {
        popover: "rounded-sm border-hairline-strong p-s-1",
        item: "rounded-xs px-s-2 py-s-2 font-mono text-mono-lg text-ink",
        sectionHeader:
          "px-s-2 pt-s-2 pb-s-1 font-mono text-mono-sm uppercase tracking-tactical text-ink-dim",
        separator: "my-s-1",
      },
      compact: {
        popover: "rounded-l border-l-border p-[2px]",
        item:
          "rounded-l-sm px-[8px] py-[5px] font-sans text-[13px] leading-none text-l-ink " +
          "data-[focused=true]:bg-l-surface-hover",
        sectionHeader:
          "px-[8px] pt-[6px] pb-[3px] font-sans text-[11px] font-medium tracking-normal text-l-ink-dim",
        separator: "my-[3px] bg-l-border-faint",
      },
    },
  },
  defaultVariants: { density: "brand" },
});

const DropdownMenuDensityContext = React.createContext<
  "compact" | "brand" | undefined
>(undefined);

export interface DropdownMenuProps extends MenuTriggerProps {}

export function DropdownMenu(props: DropdownMenuProps) {
  return <RACMenuTrigger {...props} />;
}

export function DropdownMenuTrigger({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

export interface DropdownMenuContentProps<
  T extends object = object,
> extends Omit<RACMenuProps<T>, "className" | "children"> {
  className?: string;
  classNames?: { popover?: string; menu?: string };
  placement?: RACPopoverProps["placement"];
  popoverProps?: Omit<RACPopoverProps, "children" | "className">;
  density?: "compact" | "brand";
  children: React.ReactNode;
}

export function DropdownMenuContent<T extends object = object>({
  className,
  classNames,
  placement = "bottom start",
  popoverProps,
  density: densityProp,
  children,
  ...rest
}: DropdownMenuContentProps<T>) {
  const density = useResolvedChromeDensity(densityProp);
  const slots = menuStyles({ density });
  return (
    <RACPopover
      {...popoverProps}
      placement={placement}
      className={composeTwRenderProps(classNames?.popover, slots.popover())}
    >
      <DropdownMenuDensityContext.Provider value={density}>
        <RACMenu
          {...(rest as RACMenuProps<T>)}
          className={composeTwRenderProps(
            className ?? classNames?.menu,
            slots.menu()
          )}
        >
          {children as React.ReactNode}
        </RACMenu>
      </DropdownMenuDensityContext.Provider>
    </RACPopover>
  );
}

export interface DropdownMenuItemProps<T extends object = object> extends Omit<
  RACMenuItemProps<T>,
  "className"
> {
  className?: string;
  /** Apply destructive styling (red). */
  danger?: boolean;
}

export function DropdownMenuItem<T extends object = object>({
  className,
  danger = false,
  ...props
}: DropdownMenuItemProps<T>) {
  const ctxDensity = React.useContext(DropdownMenuDensityContext);
  const density = useResolvedChromeDensity(ctxDensity);
  const slots = menuStyles({ density });
  return (
    <RACMenuItem
      {...(props as RACMenuItemProps<T>)}
      className={composeTwRenderProps(
        className,
        `${slots.item()} ${danger ? slots.itemDanger() : ""}`
      )}
    />
  );
}

export interface DropdownMenuSectionProps<T extends object> extends Omit<
  RACMenuSectionProps<T>,
  "className" | "children"
> {
  className?: string;
  title?: React.ReactNode;
  children?: React.ReactNode;
}

export function DropdownMenuSection<T extends object>({
  className,
  title,
  children,
  ...rest
}: DropdownMenuSectionProps<T>) {
  const ctxDensity = React.useContext(DropdownMenuDensityContext);
  const density = useResolvedChromeDensity(ctxDensity);
  const slots = menuStyles({ density });
  return (
    <RACMenuSection
      {...(rest as RACMenuSectionProps<T>)}
      className={slots.section({ className })}
    >
      {title ? (
        <RACHeader className={slots.sectionHeader()}>{title}</RACHeader>
      ) : null}
      {children as React.ReactNode}
    </RACMenuSection>
  );
}

export function DropdownMenuSeparator() {
  const ctxDensity = React.useContext(DropdownMenuDensityContext);
  const density = useResolvedChromeDensity(ctxDensity);
  const slots = menuStyles({ density });
  return <RACSeparator className={slots.separator()} />;
}
