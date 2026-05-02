"use client";

import * as React from "react";

import { cn } from "../utils/cn";

/*
 * Card — shadcn-style composable container. Surfaces a familiar
 * `Card / CardHeader / CardTitle / CardDescription / CardContent /
 * CardFooter` compound that drops in cleanly from upstream `shadcn add`
 * recipes and consumes the unified Chronicle token system.
 *
 * For the older Chronicle declarative composer with `<PanelHeader title
 * actions />`, reach for `<Panel>` instead. New product code should
 * prefer `<Card>` for consistency with the wider shadcn vocabulary.
 *
 *   <Card>
 *     <CardHeader>
 *       <CardTitle>Backtest replay</CardTitle>
 *       <CardDescription>Last 24 hours of intercom traffic.</CardDescription>
 *     </CardHeader>
 *     <CardContent>…</CardContent>
 *     <CardFooter>…</CardFooter>
 *   </Card>
 */

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>;
}

export function Card({ className, ref, ...props }: CardProps) {
  return (
    <div
      ref={ref}
      data-slot="card"
      className={cn(
        "flex flex-col gap-s-3 rounded-md border border-hairline bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    />
  );
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>;
}

export function CardHeader({ className, ref, ...props }: CardHeaderProps) {
  return (
    <div
      ref={ref}
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-[14px] pt-[12px] [.border-b]:pb-[12px]",
        className
      )}
      {...props}
    />
  );
}

export interface CardTitleProps
  extends React.HTMLAttributes<HTMLHeadingElement> {
  ref?: React.Ref<HTMLHeadingElement>;
}

export function CardTitle({ className, ref, ...props }: CardTitleProps) {
  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      data-slot="card-title"
      className={cn(
        "font-sans text-[14px] font-medium leading-none tracking-normal text-ink-hi",
        className
      )}
      {...props}
    />
  );
}

export interface CardDescriptionProps
  extends React.HTMLAttributes<HTMLParagraphElement> {
  ref?: React.Ref<HTMLParagraphElement>;
}

export function CardDescription({
  className,
  ref,
  ...props
}: CardDescriptionProps) {
  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      data-slot="card-description"
      className={cn("font-sans text-[12px] text-muted-foreground", className)}
      {...props}
    />
  );
}

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>;
}

export function CardContent({ className, ref, ...props }: CardContentProps) {
  return (
    <div
      ref={ref}
      data-slot="card-content"
      className={cn("px-[14px] [&:last-child]:pb-[14px]", className)}
      {...props}
    />
  );
}

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>;
}

export function CardFooter({ className, ref, ...props }: CardFooterProps) {
  return (
    <div
      ref={ref}
      data-slot="card-footer"
      className={cn(
        "flex items-center px-[14px] pb-[12px] [.border-t]:pt-[12px]",
        className
      )}
      {...props}
    />
  );
}

export interface CardActionProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>;
}

export function CardAction({ className, ref, ...props }: CardActionProps) {
  return (
    <div
      ref={ref}
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  );
}
