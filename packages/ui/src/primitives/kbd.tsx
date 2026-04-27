import * as React from "react";
import { tv, type VariantProps } from "../utils/tv";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

/**
 * Kbd — a tiny mono key cap, used inline inside buttons and menu rows.
 *   <span>Search</span> <Kbd>⌘</Kbd><Kbd>K</Kbd>
 *
 * Adapts to the surrounding chrome: under `data-chrome="brand"` it uses
 * the editorial surface stack; under `"product"` it uses the Linear
 * `--l-*` wash. Pair with `<Button>` and the command palette.
 */
const kbd = tv({
  base: "inline-flex items-center justify-center font-mono font-medium",
  variants: {
    density: {
      brand: "bg-surface-02 text-ink-lo rounded-l-sm border border-hairline",
      compact: "bg-l-wash-5 text-l-ink rounded-l-sm",
    },
    size: {
      sm: "min-w-[18px] h-[18px] px-[4px] text-[11px] tracking-mono",
      md: "min-w-[22px] h-[22px] px-[6px] text-[12px] tracking-mono",
    },
  },
  defaultVariants: { density: "compact", size: "sm" },
});

type KbdVariantProps = VariantProps<typeof kbd>;

export interface KbdProps
  extends React.HTMLAttributes<HTMLSpanElement>, KbdVariantProps {
  /** Display size. `sm` (default, fits inside buttons) or `md`. */
  size?: "sm" | "md";
  /** Force a density flavor. Defaults to whichever the surrounding
   * `ChromeStyleProvider` resolves to. */
  density?: "compact" | "brand";
}

export function Kbd({ size, density: densityProp, className, children, ...props }: KbdProps) {
  const density = useResolvedChromeDensity(densityProp);
  return (
    <span className={kbd({ density, size, className })} data-density={density} {...props}>
      {children}
    </span>
  );
}
