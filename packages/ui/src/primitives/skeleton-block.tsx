import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../utils/cn";

/**
 * Hand-sized placeholder block. Use this when you know exactly what
 * shape you want (a 24px-tall headline, a 14px-tall row of meta) and
 * want to compose loading states yourself.
 *
 * For pixel-perfect skeletons that mirror a real component's DOM, see
 * the `Skeleton` wrapper around `boneyard-js`.
 */
export const skeletonBlockVariants = cva(
  "animate-chron-pulse rounded-md bg-l-wash-3"
);

export interface SkeletonBlockProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonBlockVariants> {
  ref?: React.Ref<HTMLDivElement>;
}

export function SkeletonBlock({
  className,
  ref,
  ...props
}: SkeletonBlockProps) {
  return (
    <div
      ref={ref}
      className={cn(skeletonBlockVariants(), className)}
      {...props}
    />
  );
}
