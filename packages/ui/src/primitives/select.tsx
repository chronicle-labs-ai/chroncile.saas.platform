"use client";

/*
 * RAC-based Select compound.
 *
 * Usage:
 *
 *   <Select selectedKey={value} onSelectionChange={setValue} placeholder="…">
 *     <SelectItem id="intercom">Intercom</SelectItem>
 *     <SelectItem id="shopify">Shopify</SelectItem>
 *     <SelectSection title="Commerce">
 *       <SelectItem id="stripe">Stripe</SelectItem>
 *     </SelectSection>
 *   </Select>
 *
 * Provides typeahead, arrow/home/end navigation, proper portaled popover,
 * and automatic Label / FieldError / Description wiring when placed inside
 * a `FormField` (via RAC's slot contexts). For the legacy native-select
 * API (`<option>` children, `value`, `onChange(e)`), use `NativeSelect`.
 */

import * as React from "react";
import {
  Select as RACSelect,
  SelectValue as RACSelectValue,
  type SelectProps as RACSelectProps,
  Button as RACButton,
  Popover as RACPopover,
  type PopoverProps as RACPopoverProps,
  ListBox as RACListBox,
  ListBoxItem as RACListBoxItem,
  ListBoxSection as RACListBoxSection,
  type ListBoxItemProps as RACListBoxItemProps,
  type ListBoxSectionProps as RACListBoxSectionProps,
  Header as RACHeader,
  Collection as RACCollection,
} from "react-aria-components";

import { tv, type VariantProps } from "../utils/tv";
import { composeTwRenderProps } from "../utils/compose";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

export type SelectDensity = "compact" | "brand";

const selectStyles = tv({
  slots: {
    root: "flex flex-col gap-s-1 w-full",
    trigger:
      "flex w-full items-center justify-between gap-s-2 border " +
      "transition-colors duration-fast ease-out outline-none text-left " +
      "data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1 " +
      "data-[disabled=true]:opacity-50 data-[disabled=true]:cursor-not-allowed",
    value: "truncate data-[placeholder=true]:text-ink-faint",
    chevron:
      "pointer-events-none absolute top-1/2 -translate-y-1/2 " +
      "transition-transform duration-fast ease-out",
    popover:
      "z-50 min-w-[var(--trigger-width)] outline-none " +
      "data-[entering=true]:animate-in data-[entering=true]:fade-in " +
      "data-[exiting=true]:animate-out data-[exiting=true]:fade-out",
    listbox: "max-h-[320px] overflow-auto outline-none",
    item:
      "relative cursor-pointer select-none " +
      "data-[disabled=true]:opacity-50 data-[disabled=true]:cursor-not-allowed outline-none",
    section: "py-s-1",
    sectionHeader: "",
  },
  variants: {
    density: {
      brand: {
        trigger:
          "rounded-sm bg-surface-00 px-s-3 py-s-2 pr-[32px] font-mono text-mono-lg text-ink " +
          "data-[hovered=true]:border-ink-dim " +
          "data-[focus-visible=true]:border-ember data-[focus-visible=true]:outline-ember " +
          "data-[open=true]:border-ember",
        value: "text-ink",
        chevron: "right-s-3 h-4 w-4 text-ink-dim",
        popover: "rounded-sm border border-hairline-strong bg-surface-02 p-s-1 shadow-panel",
        item:
          "rounded-xs px-s-2 py-s-2 font-mono text-mono-lg text-ink " +
          "data-[focused=true]:bg-surface-03 " +
          "data-[selected=true]:text-ink-hi data-[selected=true]:bg-surface-03",
        sectionHeader:
          "px-s-2 pt-s-2 pb-s-1 font-mono text-mono-sm uppercase tracking-tactical text-ink-dim",
      },
      compact: {
        trigger:
          "h-[28px] rounded-l bg-l-surface-input px-[10px] pr-[28px] font-sans text-[13px] leading-none text-l-ink " +
          "data-[hovered=true]:border-l-border-strong " +
          "data-[focus-visible=true]:border-[rgba(216,67,10,0.5)] data-[focus-visible=true]:outline-[rgba(216,67,10,0.5)] " +
          "data-[focus-visible=true]:shadow-[0_0_0_3px_rgba(216,67,10,0.12)] " +
          "data-[open=true]:border-[rgba(216,67,10,0.5)]",
        value: "text-l-ink",
        chevron: "right-[10px] h-3.5 w-3.5 text-l-ink-dim",
        popover: "rounded-l border border-l-border bg-l-surface-raised p-[2px] shadow-panel",
        item:
          "rounded-l-sm px-[8px] py-[5px] font-sans text-[13px] leading-none text-l-ink " +
          "data-[focused=true]:bg-l-surface-hover " +
          "data-[selected=true]:text-l-ink data-[selected=true]:bg-l-surface-selected",
        sectionHeader:
          "px-[8px] pt-[6px] pb-[3px] font-sans text-[11px] font-medium tracking-normal text-l-ink-dim",
      },
    },
    variant: {
      default: { trigger: "border-hairline-strong" },
      auth: {
        trigger:
          "bg-transparent border-hairline-strong text-ink-hi " +
          "data-[focus-visible=true]:border-ink-hi",
      },
    },
    invalid: {
      true: {
        trigger:
          "border-event-red data-[focus-visible=true]:border-event-red data-[open=true]:border-event-red",
      },
    },
  },
  defaultVariants: { density: "brand", variant: "default" },
});

type SelectVariantProps = VariantProps<typeof selectStyles>;

export interface SelectProps<T extends object = object>
  extends Omit<RACSelectProps<T>, "className">, SelectVariantProps {
  className?: string;
  density?: SelectDensity;
  placeholder?: string;
  /** Optional controlled open state. */
  classNames?: {
    root?: string;
    trigger?: string;
    value?: string;
    popover?: string;
    listbox?: string;
  };
  /** Popover placement — forwarded to the underlying RAC Popover. */
  placement?: RACPopoverProps["placement"];
  children: React.ReactNode;
}

const SelectDensityContext = React.createContext<SelectDensity | undefined>(
  undefined,
);

export function Select<T extends object = object>({
  children,
  placeholder,
  variant = "default",
  invalid = false,
  density: densityProp,
  className,
  classNames,
  placement = "bottom start",
  ...rest
}: SelectProps<T>) {
  const density = useResolvedChromeDensity(densityProp);
  const slots = selectStyles({ density, variant, invalid });

  return (
    <RACSelect
      {...rest}
      data-density={density}
      className={composeTwRenderProps(className, slots.root())}
    >
      <div className="relative">
        <RACButton
          className={composeTwRenderProps(classNames?.trigger, slots.trigger())}
        >
          <RACSelectValue
            className={slots.value({ className: classNames?.value })}
          >
            {({ isPlaceholder, selectedText }) =>
              isPlaceholder ? (placeholder ?? "Select…") : selectedText
            }
          </RACSelectValue>
        </RACButton>
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className={slots.chevron()}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m19.5 8.25-7.5 7.5-7.5-7.5"
          />
        </svg>
      </div>
      <RACPopover
        placement={placement}
        className={composeTwRenderProps(classNames?.popover, slots.popover())}
      >
        <SelectDensityContext.Provider value={density}>
          <RACListBox
            className={composeTwRenderProps(classNames?.listbox, slots.listbox())}
          >
            {children}
          </RACListBox>
        </SelectDensityContext.Provider>
      </RACPopover>
    </RACSelect>
  );
}

export interface SelectItemProps<T extends object = object> extends Omit<
  RACListBoxItemProps<T>,
  "className"
> {
  className?: string;
}

export function SelectItem<T extends object = object>({
  className,
  ...props
}: SelectItemProps<T>) {
  const ctxDensity = React.useContext(SelectDensityContext);
  const density = useResolvedChromeDensity(ctxDensity);
  const slots = selectStyles({ density });
  return (
    <RACListBoxItem
      {...(props as RACListBoxItemProps<T>)}
      className={composeTwRenderProps(className, slots.item())}
    />
  );
}

export interface SelectSectionProps<T extends object> extends Omit<
  RACListBoxSectionProps<T>,
  "className" | "children"
> {
  className?: string;
  /** Section title rendered as a non-interactive group header. */
  title?: React.ReactNode;
  items?: Iterable<T>;
  children?: React.ReactNode | ((item: T) => React.ReactElement);
}

export function SelectSection<T extends object>({
  className,
  title,
  items,
  children,
  ...rest
}: SelectSectionProps<T>) {
  const ctxDensity = React.useContext(SelectDensityContext);
  const density = useResolvedChromeDensity(ctxDensity);
  const slots = selectStyles({ density });
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
