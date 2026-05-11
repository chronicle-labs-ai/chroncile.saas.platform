"use client";

import * as React from "react";

import { cn } from "../utils/cn";
import {
  ProductionCaptureAnimation,
  type ProductionCaptureAnimationProps,
} from "./production-capture-animation";
import { ShowcaseCard, type ShowcaseCardProps } from "./showcase-card";

export interface ProductionCaptureCardProps
  extends Omit<
    ShowcaseCardProps,
    "thumb" | "title" | "subtitle" | "num" | "thumbClassName"
  > {
  num?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  thumbClassName?: string;
  animationProps?: Omit<ProductionCaptureAnimationProps, "className">;
}

export function ProductionCaptureCard({
  num,
  title,
  subtitle,
  thumbClassName,
  animationProps,
  className,
  ...props
}: ProductionCaptureCardProps) {
  return (
    <ShowcaseCard
      {...props}
      num={num}
      title={title}
      subtitle={subtitle}
      className={cn("aspect-square min-h-0", className)}
      thumbClassName={cn(
        "h-full min-h-0 flex-1 border-b-0 bg-transparent",
        thumbClassName,
      )}
      thumb={
        <ProductionCaptureAnimation
          {...animationProps}
          className="h-full w-full rounded-none border-0 shadow-none"
        />
      }
    />
  );
}
