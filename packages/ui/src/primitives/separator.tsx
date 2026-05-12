"use client";

import * as React from "react";
import { Separator as SeparatorPrimitive } from "radix-ui";

import { cn } from "../utils/cn";

/*
 * Separator — Radix-backed accessible divider. Defaults to a horizontal
 * 1px hairline using `--border`. For a labelled "or" hairline (auth
 * stack, sign-in / sign-up break), reach for `<OrDivider>`.
 *
 *   <Separator />                       // horizontal hairline
 *   <Separator orientation="vertical"/> // vertical hairline
 */

export interface SeparatorProps
  extends React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> {
  ref?: React.Ref<React.ElementRef<typeof SeparatorPrimitive.Root>>;
}

export function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ref,
  ...props
}: SeparatorProps) {
  return (
    <SeparatorPrimitive.Root
      ref={ref}
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className
      )}
      {...props}
    />
  );
}
