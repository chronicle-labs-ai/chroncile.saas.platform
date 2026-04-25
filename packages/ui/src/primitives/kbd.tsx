import * as React from "react";
import { tv, type VariantProps } from "../utils/tv";

/**
 * Kbd — a tiny mono key cap, used inline inside buttons and menu rows.
 *   <span>Search</span> <Kbd>⌘</Kbd><Kbd>K</Kbd>
 *
 * Lives in the Linear-density layer (`--l-*`). Pair with `<Button>` and
 * the upcoming command palette / dropdown rows.
 */
const kbd = tv({
  base:
    "inline-flex items-center justify-center font-mono font-medium " +
    "bg-l-wash-5 text-l-ink rounded-l-sm",
  variants: {
    size: {
      sm: "min-w-[18px] h-[18px] px-[4px] text-[11px] tracking-mono",
      md: "min-w-[22px] h-[22px] px-[6px] text-[12px] tracking-mono",
    },
  },
  defaultVariants: { size: "sm" },
});

type KbdVariantProps = VariantProps<typeof kbd>;

export interface KbdProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    KbdVariantProps {
  /** Display size. `sm` (default, fits inside buttons) or `md`. */
  size?: "sm" | "md";
}

export function Kbd({ size, className, children, ...props }: KbdProps) {
  return (
    <span className={kbd({ size, className })} {...props}>
      {children}
    </span>
  );
}
