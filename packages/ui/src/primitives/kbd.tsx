import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

/**
 * Kbd — a tiny mono key cap, used inline inside buttons and menu rows.
 *   <span>Search</span> <Kbd>⌘</Kbd><Kbd>K</Kbd>
 *
 * Sits on the Linear `--l-*` wash. Pair with `<Button>` and the command
 * palette.
 */
export const kbdVariants = cva(
  "inline-flex items-center justify-center font-mono font-medium bg-l-wash-5 text-l-ink rounded-xs",
  {
    variants: {
      size: {
        sm: "min-w-[18px] h-[18px] px-[4px] text-[11px] tracking-mono",
        md: "min-w-[22px] h-[22px] px-[6px] text-[12px] tracking-mono",
      },
    },
    defaultVariants: {
      size: "sm",
    },
  }
);

type KbdVariantProps = VariantProps<typeof kbdVariants>;

export interface KbdProps
  extends React.HTMLAttributes<HTMLSpanElement>, KbdVariantProps {
  /** Display size. `sm` (default, fits inside buttons) or `md`. */
  size?: "sm" | "md";
}

export function Kbd({ size, className, children, ...props }: KbdProps) {
  return (
    <span className={kbdVariants({ size, className })} {...props}>
      {children}
    </span>
  );
}
