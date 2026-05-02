"use client";

/*
 * Breadcrumbs — linear navigational trail.
 *
 *   <Breadcrumbs>
 *     <Breadcrumb href="/">Home</Breadcrumb>
 *     <Breadcrumb href="/runs">Runs</Breadcrumb>
 *     <Breadcrumb>Run 4829</Breadcrumb>
 *   </Breadcrumbs>
 */

import * as React from "react";
import { cva } from "class-variance-authority";

export const breadcrumbsVariants = cva(
  "flex items-center gap-[6px] font-sans text-[12px] font-medium text-l-ink-lo"
);

export const breadcrumbItemVariants = cva(
  "flex items-center last:after:hidden gap-[6px] after:content-['/'] after:text-l-ink-dim after:mx-[2px] data-[current=true]:text-l-ink"
);

export const breadcrumbLinkVariants = cva(
  "outline-none transition-colors duration-fast ease-out focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember text-l-ink-dim hover:text-l-ink"
);

export interface BreadcrumbsProps
  extends Omit<React.OlHTMLAttributes<HTMLOListElement>, "className" | "children"> {
  className?: string;
  children: React.ReactNode;
}

export function Breadcrumbs({
  className,
  children,
  ...rest
}: BreadcrumbsProps) {
  return (
    <ol {...rest} className={breadcrumbsVariants({ className })}>
      {children as React.ReactNode}
    </ol>
  );
}

export interface BreadcrumbProps
  extends Omit<React.LiHTMLAttributes<HTMLLIElement>, "className" | "children"> {
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
  return (
    <li {...rest} className={breadcrumbItemVariants({ className })}>
      {href ? (
        <a href={href} className={breadcrumbLinkVariants()}>
          {children}
        </a>
      ) : (
        <span aria-current="page">{children}</span>
      )}
    </li>
  );
}
