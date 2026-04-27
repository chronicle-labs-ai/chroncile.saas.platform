"use client";

import * as React from "react";
import { tv } from "../utils/tv";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

export type SkeletonDensity = "compact" | "brand";

const skeleton = tv({
  base: "animate-chron-pulse",
  variants: {
    density: {
      brand: "rounded-sm bg-surface-02",
      compact: "rounded-l bg-l-wash-3",
    },
  },
  defaultVariants: { density: "brand" },
});

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  density?: SkeletonDensity;
}

export function Skeleton({
  density: densityProp,
  className,
  ...props
}: SkeletonProps) {
  const density = useResolvedChromeDensity(densityProp);
  return (
    <div
      className={skeleton({ density, className })}
      data-density={density}
      {...props}
    />
  );
}
