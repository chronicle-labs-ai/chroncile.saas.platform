import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../utils/cn";

export const panelVariants = cva("relative overflow-hidden border rounded-md", {
  variants: {
    elevated: {
      true: "border-hairline-strong bg-surface-02",
      false: "border-hairline bg-surface-01",
    },
    active: {
      true: "before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-ember",
    },
  },
  defaultVariants: {
    elevated: false,
  },
});

export const panelHeaderVariants = cva(
  "flex items-center justify-between border-b border-hairline bg-surface-02 gap-[8px] px-[12px] py-[8px]"
);

export const panelHeaderTitleVariants = cva(
  "font-sans text-[12px] font-medium tracking-normal text-l-ink-lo"
);

export const panelContentVariants = cva("p-[12px]");

export interface PanelProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof panelVariants> {
  elevated?: boolean;
  /**
   * When true, the panel paints the ember-tinted selected row treatment
   * along its left edge. Use sparingly — this is the "one hot surface".
   */
  active?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

export function Panel({
  active,
  className,
  elevated = false,
  ref,
  ...props
}: PanelProps) {
  return (
    <div
      ref={ref}
      className={cn(panelVariants({ active, elevated }), className)}
      {...props}
    />
  );
}

export interface PanelHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}

export function PanelHeader({
  title,
  actions,
  className,
  children,
  ref,
  ...props
}: PanelHeaderProps) {
  return (
    <div
      ref={ref}
      className={cn(panelHeaderVariants(), className)}
      {...props}
    >
      {title ? (
        <span className={panelHeaderTitleVariants()}>{title}</span>
      ) : null}
      {children}
      {actions ? (
        <div className="ml-auto flex items-center gap-[6px]">{actions}</div>
      ) : null}
    </div>
  );
}

export interface PanelContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>;
}

export function PanelContent({ className, ref, ...props }: PanelContentProps) {
  return (
    <div
      ref={ref}
      className={cn(panelContentVariants(), className)}
      {...props}
    />
  );
}
