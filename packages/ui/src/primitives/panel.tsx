import * as React from "react";
import { tv, type VariantProps } from "../utils/tv";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

const panel = tv({
  base: "relative overflow-hidden border",
  variants: {
    density: {
      brand: "rounded-md",
      compact: "rounded-l",
    },
    elevated: {
      true: "border-hairline-strong bg-surface-02",
      false: "border-hairline bg-surface-01",
    },
    active: {
      true: "before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-ember",
    },
  },
  defaultVariants: { density: "brand", elevated: false },
});

type PanelVariantProps = VariantProps<typeof panel>;

export interface PanelProps
  extends React.HTMLAttributes<HTMLDivElement>, PanelVariantProps {
  elevated?: boolean;
  /**
   * When true, the panel paints the ember-tinted selected row treatment
   * along its left edge. Use sparingly — this is the "one hot surface".
   */
  active?: boolean;
  /** Force a density flavor. */
  density?: "compact" | "brand";
}

export function Panel({
  elevated = false,
  active = false,
  density: densityProp,
  className,
  children,
  ...props
}: PanelProps) {
  const density = useResolvedChromeDensity(densityProp);
  return (
    <div className={panel({ density, elevated, active, className })} data-density={density} {...props}>
      {children}
    </div>
  );
}

const panelHeader = tv({
  base: "flex items-center justify-between border-b border-hairline bg-surface-02",
  variants: {
    density: {
      brand: "gap-s-3 px-s-4 py-s-3",
      compact: "gap-[8px] px-[12px] py-[8px]",
    },
  },
  defaultVariants: { density: "brand" },
});

const panelHeaderTitle = tv({
  base: "",
  variants: {
    density: {
      brand: "font-mono text-mono uppercase tracking-tactical text-ink-lo",
      compact: "font-sans text-[12px] font-medium tracking-normal text-l-ink-lo",
    },
  },
  defaultVariants: { density: "brand" },
});

export interface PanelHeaderProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  density?: "compact" | "brand";
}

export function PanelHeader({
  title,
  actions,
  density: densityProp,
  className,
  children,
  ...props
}: PanelHeaderProps) {
  const density = useResolvedChromeDensity(densityProp);
  return (
    <div className={panelHeader({ density, className })} data-density={density} {...props}>
      {title ? <span className={panelHeaderTitle({ density })}>{title}</span> : null}
      {children}
      {actions ? (
        <div className={density === "compact" ? "ml-auto flex items-center gap-[6px]" : "ml-auto flex items-center gap-s-2"}>{actions}</div>
      ) : null}
    </div>
  );
}

const panelContent = tv({
  base: "",
  variants: {
    density: {
      brand: "p-s-4",
      compact: "p-[12px]",
    },
  },
  defaultVariants: { density: "brand" },
});

export interface PanelContentProps extends React.HTMLAttributes<HTMLDivElement> {
  density?: "compact" | "brand";
}

export function PanelContent({
  density: densityProp,
  className,
  children,
  ...props
}: PanelContentProps) {
  const density = useResolvedChromeDensity(densityProp);
  return (
    <div className={panelContent({ density, className })} data-density={density} {...props}>
      {children}
    </div>
  );
}
