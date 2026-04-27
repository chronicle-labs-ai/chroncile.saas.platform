import * as React from "react";
import { tv } from "../utils/tv";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

/*
 * EmptyState — zero-results / no-data placeholder with optional icon,
 * description, and primary action. Not interactive in itself; renders
 * whatever action children are passed.
 */

const emptyState = tv({
  slots: {
    root: "empty-state flex flex-col items-center justify-center text-center",
    header: "empty-state__header flex flex-col items-center gap-s-2",
    media: "empty-state__media flex items-center justify-center",
    title: "empty-state__title",
    description: "empty-state__description max-w-[360px]",
    content: "empty-state__content mt-s-2 flex items-center gap-s-2",
  },
  variants: {
    density: {
      brand: {
        root: "rounded-md",
        media: "text-ink-dim",
        title: "font-display text-title-sm text-ink-hi",
        description: "font-sans text-sm text-ink-lo",
      },
      compact: {
        root: "rounded-l",
        media: "text-l-ink-dim",
        title: "font-sans text-[15px] font-medium text-l-ink",
        description: "font-sans text-[13px] text-l-ink-lo",
      },
    },
    size: {
      sm: { root: "gap-s-2 px-s-4 py-s-8", media: "h-7 w-7" },
      md: { root: "gap-s-3 px-s-6 py-s-12", media: "h-8 w-8" },
      lg: { root: "gap-s-4 px-s-8 py-s-16", media: "h-10 w-10" },
    },
    chrome: {
      default: { root: "" },
      minimal: { root: "border border-transparent bg-transparent" },
      outline: { root: "" },
    },
    mediaVariant: {
      default: "",
      icon: { media: "rounded-pill p-s-2" },
    },
  },
  compoundVariants: [
    {
      density: "brand",
      chrome: "default",
      class: { root: "border border-hairline border-dashed bg-surface-01" },
    },
    {
      density: "brand",
      chrome: "outline",
      class: { root: "border border-hairline bg-transparent" },
    },
    {
      density: "compact",
      chrome: "default",
      class: { root: "border border-l-border border-dashed bg-l-surface-raised" },
    },
    {
      density: "compact",
      chrome: "outline",
      class: { root: "border border-l-border bg-transparent" },
    },
    {
      density: "brand",
      mediaVariant: "icon",
      class: { media: "bg-surface-03" },
    },
    {
      density: "compact",
      mediaVariant: "icon",
      class: { media: "bg-l-wash-5" },
    },
  ],
  defaultVariants: {
    size: "md",
    chrome: "default",
    mediaVariant: "default",
    density: "brand",
  },
});

export type EmptyStateSize = "sm" | "md" | "lg";
export type EmptyStateChrome = "default" | "minimal" | "outline";
export type EmptyStateMediaVariant = "default" | "icon";
export type EmptyStateDensity = "compact" | "brand";

export interface EmptyStateProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  size?: EmptyStateSize;
  chrome?: EmptyStateChrome;
  mediaVariant?: EmptyStateMediaVariant;
  density?: EmptyStateDensity;
}

function EmptyStateRoot({
  icon,
  title,
  description,
  actions,
  size = "md",
  chrome = "default",
  mediaVariant = "default",
  density: densityProp,
  className,
  children,
  ...props
}: EmptyStateProps) {
  const density = useResolvedChromeDensity(densityProp);
  const slots = emptyState({ size, chrome, mediaVariant, density });

  if (children) {
    return (
      <div {...props} className={slots.root({ className })}>
        {children}
      </div>
    );
  }

  return (
    <div {...props} className={slots.root({ className })}>
      <div className={slots.header()}>
        {icon ? <span className={slots.media()}>{icon}</span> : null}
        {title ? <span className={slots.title()}>{title}</span> : null}
        {description ? (
          <p className={slots.description()}>{description}</p>
        ) : null}
      </div>
      {actions ? <div className={slots.content()}>{actions}</div> : null}
    </div>
  );
}

export const EmptyState = Object.assign(EmptyStateRoot, {
  Header: ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
    const slots = emptyState({});
    return <div {...props} className={slots.header({ className })} />;
  },
  Media: ({
    variant = "default",
    className,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & {
    variant?: EmptyStateMediaVariant;
  }) => {
    const slots = emptyState({ mediaVariant: variant });
    return (
      <div
        {...props}
        data-variant={variant}
        className={slots.media({ className })}
      />
    );
  },
  Title: ({
    className,
    ...props
  }: React.HTMLAttributes<HTMLHeadingElement>) => {
    const slots = emptyState({});
    return <h3 {...props} className={slots.title({ className })} />;
  },
  Description: ({
    className,
    ...props
  }: React.HTMLAttributes<HTMLParagraphElement>) => {
    const slots = emptyState({});
    return <p {...props} className={slots.description({ className })} />;
  },
  Content: ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
    const slots = emptyState({});
    return <div {...props} className={slots.content({ className })} />;
  },
});
