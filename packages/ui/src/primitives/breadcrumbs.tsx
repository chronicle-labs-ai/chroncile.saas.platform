"use client";

/*
 * Breadcrumbs — linear navigational trail. RAC handles separator
 * rendering via CSS, `isCurrent` for the last item, and link handling
 * integrated with the app's RouterProvider.
 *
 *   <Breadcrumbs>
 *     <Breadcrumb href="/">Home</Breadcrumb>
 *     <Breadcrumb href="/runs">Runs</Breadcrumb>
 *     <Breadcrumb>Run 4829</Breadcrumb>
 *   </Breadcrumbs>
 */

import * as React from "react";
import {
  Breadcrumbs as RACBreadcrumbs,
  Breadcrumb as RACBreadcrumb,
  Link as RACLink,
  type BreadcrumbsProps as RACBreadcrumbsProps,
  type BreadcrumbProps as RACBreadcrumbProps,
} from "react-aria-components";

import { tv } from "../utils/tv";
import { composeTwRenderProps } from "../utils/compose";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

export type BreadcrumbsDensity = "compact" | "brand";

const BreadcrumbsDensityContext =
  React.createContext<BreadcrumbsDensity | undefined>(undefined);

const breadcrumbStyles = tv({
  slots: {
    root: "flex items-center",
    item: "flex items-center last:after:hidden",
    link:
      "outline-none transition-colors duration-fast ease-out " +
      "data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1 " +
      "data-[focus-visible=true]:outline-ember",
  },
  variants: {
    density: {
      brand: {
        root: "gap-s-2 font-mono text-mono uppercase tracking-tactical text-ink-lo",
        item:
          "gap-s-2 after:content-['/'] after:text-ink-dim after:mx-s-1 " +
          "data-[current=true]:text-ink-hi",
        link: "text-ink-dim data-[hovered=true]:text-ink-hi",
      },
      compact: {
        root: "gap-[6px] font-sans text-[12px] font-medium text-l-ink-lo",
        item:
          "gap-[6px] after:content-['/'] after:text-l-ink-dim after:mx-[2px] " +
          "data-[current=true]:text-l-ink",
        link: "text-l-ink-dim data-[hovered=true]:text-l-ink",
      },
    },
  },
  defaultVariants: { density: "brand" },
});

export interface BreadcrumbsProps<T extends object = object>
  extends Omit<RACBreadcrumbsProps<T>, "className" | "children"> {
  className?: string;
  children: React.ReactNode;
  density?: BreadcrumbsDensity;
}

export function Breadcrumbs<T extends object = object>({
  className,
  children,
  density: densityProp,
  ...rest
}: BreadcrumbsProps<T>) {
  const density = useResolvedChromeDensity(densityProp);
  const slots = breadcrumbStyles({ density });
  return (
    <BreadcrumbsDensityContext.Provider value={density}>
      <RACBreadcrumbs
        {...(rest as RACBreadcrumbsProps<T>)}
        className={`${slots.root()}${className ? ` ${className}` : ""}`}
      >
        {children as React.ReactNode}
      </RACBreadcrumbs>
    </BreadcrumbsDensityContext.Provider>
  );
}

export interface BreadcrumbProps
  extends Omit<RACBreadcrumbProps, "className" | "children"> {
  className?: string;
  children: React.ReactNode;
  href?: string;
}

export function Breadcrumb({
  className,
  children,
  href,
  ...rest
}: BreadcrumbProps) {
  const ctxDensity = React.useContext(BreadcrumbsDensityContext);
  const density = useResolvedChromeDensity(ctxDensity);
  const slots = breadcrumbStyles({ density });
  return (
    <RACBreadcrumb
      {...rest}
      className={composeTwRenderProps(className, slots.item())}
    >
      {href ? (
        <RACLink href={href} className={slots.link()}>
          {children}
        </RACLink>
      ) : (
        <span>{children}</span>
      )}
    </RACBreadcrumb>
  );
}
