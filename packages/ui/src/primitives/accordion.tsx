"use client";

/*
 * Accordion — RAC's Disclosure + DisclosureGroup. An Accordion is a
 * DisclosureGroup with `allowsMultipleExpanded` controlling single vs
 * multi expand. Each item is a Disclosure with a Heading + Button trigger
 * and a DisclosurePanel body.
 *
 *   <Accordion>
 *     <AccordionItem id="intro" title="Introduction">…</AccordionItem>
 *     <AccordionItem id="rules" title="Rules">…</AccordionItem>
 *   </Accordion>
 */

import * as React from "react";
import {
  DisclosureGroup as RACDisclosureGroup,
  Disclosure as RACDisclosure,
  DisclosurePanel as RACDisclosurePanel,
  Button as RACButton,
  Heading as RACHeading,
  type DisclosureGroupProps as RACDisclosureGroupProps,
  type DisclosureProps as RACDisclosureProps,
} from "react-aria-components";

import { tv } from "../utils/tv";
import { composeTwRenderProps } from "../utils/compose";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

const accordionStyles = tv({
  slots: {
    group: "flex flex-col bg-surface-01 border border-hairline divide-y divide-hairline",
    item: "outline-none",
    header: "",
    trigger:
      "flex w-full items-center justify-between gap-s-3 text-ink-lo " +
      "transition-colors duration-fast ease-out outline-none " +
      "data-[hovered=true]:text-ink-hi data-[hovered=true]:bg-surface-02 " +
      "data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1 " +
      "data-[focus-visible=true]:outline-ember",
    chevron:
      "shrink-0 text-ink-dim transition-transform duration-fast ease-out",
    panel: "pt-0 text-body-sm text-ink-lo outline-none",
  },
  variants: {
    density: {
      brand: {
        group: "rounded-md",
        trigger: "px-s-4 py-s-3 font-mono text-mono uppercase tracking-tactical",
        chevron: "h-4 w-4",
        panel: "px-s-4 pb-s-4",
      },
      compact: {
        group: "rounded-l",
        trigger: "px-s-3 py-s-2 font-sans text-[13px] font-medium tracking-normal leading-none",
        chevron: "h-3.5 w-3.5",
        panel: "px-s-3 pb-s-3",
      },
    },
  },
  defaultVariants: { density: "brand" },
});

export type AccordionDensity = "compact" | "brand";

/**
 * Local density context so the parent `<Accordion>` can pin a flavor
 * for its children without relying on the global `ChromeStyleProvider`
 * (e.g. an editorial accordion inside a product surface, or vice versa).
 */
const AccordionDensityContext = React.createContext<AccordionDensity | undefined>(
  undefined
);

export interface AccordionProps extends Omit<
  RACDisclosureGroupProps,
  "className" | "children"
> {
  className?: string;
  /**
   * Density flavor.
   *   `"compact"` — Linear-density (sans medium, rounded-l, tighter padding).
   *   `"brand"`   — editorial mono-uppercase trigger.
   * Inherits from the nearest `ChromeStyleProvider` when omitted.
   */
  density?: AccordionDensity;
  children: React.ReactNode;
}

export function Accordion({
  className,
  density: densityProp,
  children,
  ...rest
}: AccordionProps) {
  const density = useResolvedChromeDensity(densityProp);
  const slots = accordionStyles({ density });
  return (
    <AccordionDensityContext.Provider value={density}>
      <RACDisclosureGroup
        {...rest}
        data-density={density}
        className={composeTwRenderProps(className, slots.group())}
      >
        {children}
      </RACDisclosureGroup>
    </AccordionDensityContext.Provider>
  );
}

export interface AccordionItemProps extends Omit<
  RACDisclosureProps,
  "className" | "children"
> {
  className?: string;
  title: React.ReactNode;
  children: React.ReactNode;
}

export function AccordionItem({
  className,
  title,
  children,
  ...rest
}: AccordionItemProps) {
  const parentDensity = React.useContext(AccordionDensityContext);
  const density = useResolvedChromeDensity(parentDensity);
  const slots = accordionStyles({ density });
  return (
    <RACDisclosure
      {...rest}
      className={composeTwRenderProps(className, slots.item())}
    >
      {({ isExpanded }) => (
        <>
          <RACHeading className={slots.header()}>
            <RACButton slot="trigger" className={slots.trigger()}>
              {title}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                style={{
                  transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                }}
                className={slots.chevron()}
              >
                <path
                  d="m19.5 8.25-7.5 7.5-7.5-7.5"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </RACButton>
          </RACHeading>
          <RACDisclosurePanel className={slots.panel()}>
            {children}
          </RACDisclosurePanel>
        </>
      )}
    </RACDisclosure>
  );
}
