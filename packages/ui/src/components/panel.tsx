import * as React from "react";

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

export function Panel({
  elevated = false,
  className = "",
  children,
  ...props
}: PanelProps) {
  const classes = [
    "panel",
    elevated ? "panel--elevated" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

export interface PanelHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  actions?: React.ReactNode;
}

export function PanelHeader({
  title,
  actions,
  className = "",
  children,
  ...props
}: PanelHeaderProps) {
  const classes = ["panel__header", className].filter(Boolean).join(" ");

  return (
    <div className={classes} {...props}>
      {title && <span className="panel__title">{title}</span>}
      {children}
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export type PanelContentProps = React.HTMLAttributes<HTMLDivElement>;

export function PanelContent({
  className = "",
  children,
  ...props
}: PanelContentProps) {
  const classes = ["panel__content", className].filter(Boolean).join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
