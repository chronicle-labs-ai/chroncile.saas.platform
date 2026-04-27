"use client";

/*
 * Combobox — a text input paired with a filterable listbox.
 *
 *   <Combobox
 *     placeholder="Pick a source"
 *     defaultSelectedKey="intercom"
 *     onSelectionChange={setValue}
 *   >
 *     <ComboboxItem id="intercom">Intercom</ComboboxItem>
 *     <ComboboxItem id="shopify">Shopify</ComboboxItem>
 *   </Combobox>
 *
 * Provides case-insensitive substring filtering out of the box (RAC
 * default). Pass `defaultFilter` to override. For multi-select or custom
 * values, see RAC's options.
 */

import * as React from "react";
import {
  ComboBox as RACComboBox,
  Input as RACInput,
  Button as RACButton,
  Popover as RACPopover,
  ListBox as RACListBox,
  ListBoxItem as RACListBoxItem,
  ListBoxSection as RACListBoxSection,
  Header as RACHeader,
  type ComboBoxProps as RACComboBoxProps,
  type ListBoxItemProps as RACListBoxItemProps,
  type ListBoxSectionProps as RACListBoxSectionProps,
  type PopoverProps as RACPopoverProps,
} from "react-aria-components";

import { tv, type VariantProps } from "../utils/tv";
import { composeTwRenderProps } from "../utils/compose";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

export type ComboboxDensity = "compact" | "brand";

const comboboxStyles = tv({
  slots: {
    root: "flex flex-col gap-s-1 w-full",
    inputWrapper: "relative",
    input:
      "w-full border outline-none transition-colors duration-fast ease-out " +
      "data-[invalid=true]:border-event-red " +
      "data-[disabled=true]:opacity-50 data-[disabled=true]:cursor-not-allowed",
    button:
      "absolute top-1/2 -translate-y-1/2 inline-flex items-center justify-center " +
      "outline-none data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1",
    popover:
      "z-50 min-w-[var(--trigger-width)] outline-none " +
      "data-[entering=true]:animate-in data-[entering=true]:fade-in " +
      "data-[exiting=true]:animate-out data-[exiting=true]:fade-out",
    listbox: "max-h-[320px] overflow-auto outline-none",
    item:
      "relative cursor-pointer select-none outline-none " +
      "data-[disabled=true]:opacity-50 data-[disabled=true]:cursor-not-allowed",
    section: "py-s-1",
    sectionHeader: "",
    empty: "",
  },
  variants: {
    density: {
      brand: {
        input:
          "rounded-sm bg-surface-00 px-s-3 py-s-2 pr-[32px] font-mono text-mono-lg text-ink placeholder:text-ink-faint " +
          "data-[hovered=true]:border-ink-dim " +
          "data-[focused=true]:border-ember",
        button:
          "right-s-3 h-5 w-5 text-ink-dim " +
          "data-[hovered=true]:text-ink-hi data-[focus-visible=true]:outline-ember",
        popover: "rounded-sm border border-hairline-strong bg-surface-02 p-s-1 shadow-panel",
        item:
          "rounded-xs px-s-2 py-s-2 font-mono text-mono-lg text-ink " +
          "data-[focused=true]:bg-surface-03 " +
          "data-[selected=true]:text-ink-hi data-[selected=true]:bg-surface-03",
        sectionHeader:
          "px-s-2 pt-s-2 pb-s-1 font-mono text-mono-sm uppercase tracking-tactical text-ink-dim",
        empty: "px-s-3 py-s-4 font-mono text-mono-sm text-ink-dim",
      },
      compact: {
        input:
          "h-[28px] rounded-l bg-l-surface-input px-[10px] pr-[28px] font-sans text-[13px] leading-none text-l-ink placeholder:text-l-ink-dim " +
          "data-[hovered=true]:border-l-border-strong " +
          "data-[focused=true]:border-[rgba(216,67,10,0.5)] " +
          "data-[focused=true]:shadow-[0_0_0_3px_rgba(216,67,10,0.12)]",
        button:
          "right-[8px] h-4 w-4 text-l-ink-dim " +
          "data-[hovered=true]:text-l-ink data-[focus-visible=true]:outline-[rgba(216,67,10,0.5)]",
        popover: "rounded-l border border-l-border bg-l-surface-raised p-[2px] shadow-panel",
        item:
          "rounded-l-sm px-[8px] py-[5px] font-sans text-[13px] leading-none text-l-ink " +
          "data-[focused=true]:bg-l-surface-hover " +
          "data-[selected=true]:text-l-ink data-[selected=true]:bg-l-surface-selected",
        sectionHeader:
          "px-[8px] pt-[6px] pb-[3px] font-sans text-[11px] font-medium tracking-normal text-l-ink-dim",
        empty: "px-[10px] py-[12px] font-sans text-[12px] text-l-ink-dim",
      },
    },
    variant: {
      default: { input: "border-hairline-strong" },
      auth: {
        input:
          "bg-transparent border-hairline-strong text-ink-hi data-[focused=true]:border-ink-hi",
      },
    },
    invalid: {
      true: { input: "border-event-red data-[focused=true]:border-event-red" },
    },
  },
  compoundVariants: [
    {
      density: "compact",
      variant: "default",
      class: { input: "border-l-border" },
    },
  ],
  defaultVariants: { density: "brand", variant: "default" },
});

type ComboboxVariantProps = VariantProps<typeof comboboxStyles>;

export interface ComboboxProps<T extends object = object>
  extends
    Omit<RACComboBoxProps<T>, "className" | "children">,
    ComboboxVariantProps {
  className?: string;
  density?: ComboboxDensity;
  classNames?: {
    root?: string;
    input?: string;
    popover?: string;
    listbox?: string;
  };
  placeholder?: string;
  placement?: RACPopoverProps["placement"];
  emptyMessage?: React.ReactNode;
  children: React.ReactNode;
}

const ComboboxDensityContext = React.createContext<ComboboxDensity | undefined>(
  undefined,
);

export function Combobox<T extends object = object>({
  className,
  classNames,
  placeholder,
  placement = "bottom start",
  variant = "default",
  invalid = false,
  density: densityProp,
  emptyMessage = "No matches",
  children,
  ...rest
}: ComboboxProps<T>) {
  const density = useResolvedChromeDensity(densityProp);
  const slots = comboboxStyles({ density, variant, invalid });

  return (
    <RACComboBox
      {...rest}
      data-density={density}
      className={composeTwRenderProps(
        className ?? classNames?.root,
        slots.root()
      )}
    >
      <div className={slots.inputWrapper()}>
        <RACInput
          placeholder={placeholder}
          className={composeTwRenderProps(classNames?.input, slots.input())}
        />
        <RACButton className={slots.button()} aria-label="Toggle options">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
            <path
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </RACButton>
      </div>
      <RACPopover
        placement={placement}
        className={composeTwRenderProps(classNames?.popover, slots.popover())}
      >
        <ComboboxDensityContext.Provider value={density}>
          <RACListBox
            className={composeTwRenderProps(classNames?.listbox, slots.listbox())}
            renderEmptyState={() => (
              <div className={slots.empty()}>{emptyMessage}</div>
            )}
          >
            {children as React.ReactNode}
          </RACListBox>
        </ComboboxDensityContext.Provider>
      </RACPopover>
    </RACComboBox>
  );
}

export interface ComboboxItemProps<T extends object = object> extends Omit<
  RACListBoxItemProps<T>,
  "className"
> {
  className?: string;
}

export function ComboboxItem<T extends object = object>({
  className,
  ...props
}: ComboboxItemProps<T>) {
  const ctxDensity = React.useContext(ComboboxDensityContext);
  const density = useResolvedChromeDensity(ctxDensity);
  const slots = comboboxStyles({ density });
  return (
    <RACListBoxItem
      {...(props as RACListBoxItemProps<T>)}
      className={composeTwRenderProps(className, slots.item())}
    />
  );
}

export interface ComboboxSectionProps<T extends object> extends Omit<
  RACListBoxSectionProps<T>,
  "className" | "children"
> {
  className?: string;
  title?: React.ReactNode;
  children?: React.ReactNode;
}

export function ComboboxSection<T extends object>({
  className,
  title,
  children,
  ...rest
}: ComboboxSectionProps<T>) {
  const ctxDensity = React.useContext(ComboboxDensityContext);
  const density = useResolvedChromeDensity(ctxDensity);
  const slots = comboboxStyles({ density });
  return (
    <RACListBoxSection
      {...(rest as RACListBoxSectionProps<T>)}
      className={slots.section({ className })}
    >
      {title ? (
        <RACHeader className={slots.sectionHeader()}>{title}</RACHeader>
      ) : null}
      {children as React.ReactNode}
    </RACListBoxSection>
  );
}
