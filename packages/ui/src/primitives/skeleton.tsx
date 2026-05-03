import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../utils/cn";

export const skeletonVariants = cva(
  "animate-chron-pulse rounded-md bg-l-wash-3"
);

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
  ref?: React.Ref<HTMLDivElement>;
}

export function Skeleton({ className, ref, ...props }: SkeletonProps) {
  return (
    <div
      ref={ref}
      className={cn(skeletonVariants(), className)}
      {...props}
    />
  );
}
