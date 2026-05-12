"use client";

/*
 * Accordion — Radix Accordion with Chronicle styling.
 *
 *   <Accordion>
 *     <AccordionItem id="intro" title="Introduction">…</AccordionItem>
 *     <AccordionItem id="rules" title="Rules">…</AccordionItem>
 *   </Accordion>
 */

import * as React from "react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import { cva } from "class-variance-authority";

import { cn } from "../utils/cn";

export const accordionGroupVariants = cva(
  "flex flex-col bg-surface-01 border border-hairline divide-y divide-hairline rounded-md"
);

export const accordionItemVariants = cva("outline-none");
export const accordionHeaderVariants = cva("");

export const accordionTriggerVariants = cva(
  "flex w-full items-center justify-between gap-s-3 text-ink-lo transition-colors duration-fast ease-out outline-none hover:text-ink-hi hover:bg-surface-02 focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed px-s-3 py-s-2 font-sans text-[13px] font-medium tracking-normal leading-none"
);

export const accordionChevronVariants = cva(
  "shrink-0 text-ink-dim transition-transform duration-fast ease-out h-3.5 w-3.5"
);

export const accordionPanelVariants = cva(
  "pt-0 text-body-sm text-ink-lo outline-none px-s-3 pb-s-3"
);

export interface AccordionProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    "className" | "children" | "defaultValue" | "onChange"
  > {
  className?: string;
  type?: "single" | "multiple";
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  collapsible?: boolean;
  defaultExpandedKeys?: string[];
  allowsMultipleExpanded?: boolean;
  children: React.ReactNode;
}

export function Accordion({
  className,
  children,
  type = "single",
  value,
  defaultValue,
  onValueChange,
  collapsible = true,
  defaultExpandedKeys,
  allowsMultipleExpanded,
  ...rest
}: AccordionProps) {
  const resolvedType = allowsMultipleExpanded ? "multiple" : type;
  const resolvedDefaultValue = defaultValue ?? defaultExpandedKeys;
  const commonProps = {
    ...rest,
    className: cn(accordionGroupVariants(), className),
  };

  if (resolvedType === "multiple") {
    return (
      <AccordionPrimitive.Root
        {...(commonProps as object)}
        type="multiple"
        value={Array.isArray(value) ? value : undefined}
        defaultValue={
          Array.isArray(resolvedDefaultValue) ? resolvedDefaultValue : undefined
        }
        onValueChange={onValueChange as ((value: string[]) => void) | undefined}
      >
        {children}
      </AccordionPrimitive.Root>
    );
  }

  return (
    <AccordionPrimitive.Root
      {...(commonProps as object)}
      type="single"
      collapsible={collapsible}
      value={typeof value === "string" ? value : undefined}
      defaultValue={
        typeof resolvedDefaultValue === "string"
          ? resolvedDefaultValue
          : resolvedDefaultValue?.[0]
      }
      onValueChange={onValueChange as ((value: string) => void) | undefined}
    >
      {children}
    </AccordionPrimitive.Root>
  );
}

export interface AccordionItemProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>,
    "className" | "children" | "title" | "value"
  > {
  className?: string;
  title: React.ReactNode;
  value?: string;
  id?: string;
  children: React.ReactNode;
}

export function AccordionItem({
  className,
  title,
  children,
  value,
  id,
  ...rest
}: AccordionItemProps) {
  const fallbackValue = React.useId();

  return (
    <AccordionPrimitive.Item
      {...rest}
      value={value ?? id ?? fallbackValue}
      className={cn(accordionItemVariants(), className)}
    >
      <AccordionPrimitive.Header className={accordionHeaderVariants()}>
        <AccordionPrimitive.Trigger
          className={accordionTriggerVariants({ className: "group" })}
        >
          {title}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className={accordionChevronVariants({
              className: "group-data-[state=open]:rotate-180",
            })}
          >
            <path
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Content className={accordionPanelVariants()}>
        {children}
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
}
