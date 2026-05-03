import * as React from "react";
import { cva } from "class-variance-authority";

/*
 * EmptyState — zero-results / no-data placeholder with optional icon,
 * description, and primary action. Not interactive in itself; renders
 * whatever action children are passed.
 */

export const emptyStateRootVariants = cva(
  "empty-state flex flex-col items-center justify-center text-center rounded-md",
  {
    variants: {
      size: {
        sm: "gap-s-2 px-s-4 py-s-8",
        md: "gap-s-3 px-s-6 py-s-12",
        lg: "gap-s-4 px-s-8 py-s-16",
      },
      chrome: {
        default: "",
        minimal: "border border-transparent bg-transparent",
        outline: "",
      },
    },
    compoundVariants: [
      {
        chrome: "default",
        className: "border border-hairline-strong border-dashed bg-l-surface-raised",
      },
      {
        chrome: "outline",
        className: "border border-hairline-strong bg-transparent",
      },
    ],
    defaultVariants: {
      chrome: "default",
      size: "md",
    },
  }
);

export const emptyStateHeaderVariants = cva(
  "empty-state__header flex flex-col items-center gap-s-2"
);

export const emptyStateMediaVariants = cva(
  "empty-state__media flex items-center justify-center text-l-ink-dim",
  {
    variants: {
      size: {
        sm: "h-7 w-7",
        md: "h-8 w-8",
        lg: "h-10 w-10",
      },
      mediaVariant: {
        default: "",
        icon: "rounded-pill p-s-2",
      },
    },
    compoundVariants: [
      { mediaVariant: "icon", className: "bg-l-wash-5" },
    ],
    defaultVariants: {
      mediaVariant: "default",
      size: "md",
    },
  }
);

export const emptyStateTitleVariants = cva(
  "empty-state__title font-sans text-[15px] font-medium text-l-ink"
);

export const emptyStateDescriptionVariants = cva(
  "empty-state__description max-w-[360px] font-sans text-[13px] text-l-ink-lo"
);

export const emptyStateContentVariants = cva(
  "empty-state__content mt-s-2 flex items-center gap-s-2"
);

export type EmptyStateSize = "sm" | "md" | "lg";
export type EmptyStateChrome = "default" | "minimal" | "outline";
export type EmptyStateMediaVariant = "default" | "icon";

export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  size?: EmptyStateSize;
  chrome?: EmptyStateChrome;
  mediaVariant?: EmptyStateMediaVariant;
}

function EmptyStateRoot({
  icon,
  title,
  description,
  actions,
  size = "md",
  chrome = "default",
  mediaVariant = "default",
  className,
  children,
  ...props
}: EmptyStateProps) {
  if (children) {
    return (
      <div
        {...props}
        className={emptyStateRootVariants({ size, chrome, className })}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      {...props}
      className={emptyStateRootVariants({ size, chrome, className })}
    >
      <div className={emptyStateHeaderVariants()}>
        {icon ? (
          <span
            className={emptyStateMediaVariants({ size, mediaVariant })}
          >
            {icon}
          </span>
        ) : null}
        {title ? (
          <span className={emptyStateTitleVariants()}>{title}</span>
        ) : null}
        {description ? (
          <p className={emptyStateDescriptionVariants()}>{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className={emptyStateContentVariants()}>{actions}</div>
      ) : null}
    </div>
  );
}

export const EmptyState = Object.assign(EmptyStateRoot, {
  Header: ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
    return (
      <div {...props} className={emptyStateHeaderVariants({ className })} />
    );
  },
  Media: ({
    variant = "default",
    className,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & {
    variant?: EmptyStateMediaVariant;
  }) => {
    return (
      <div
        {...props}
        data-variant={variant}
        className={emptyStateMediaVariants({
          mediaVariant: variant,
          className,
        })}
      />
    );
  },
  Title: ({
    className,
    ...props
  }: React.HTMLAttributes<HTMLHeadingElement>) => {
    return (
      <h3 {...props} className={emptyStateTitleVariants({ className })} />
    );
  },
  Description: ({
    className,
    ...props
  }: React.HTMLAttributes<HTMLParagraphElement>) => {
    return (
      <p {...props} className={emptyStateDescriptionVariants({ className })} />
    );
  },
  Content: ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
    return (
      <div {...props} className={emptyStateContentVariants({ className })} />
    );
  },
});
