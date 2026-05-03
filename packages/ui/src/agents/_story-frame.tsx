/*
 * Story frame — wraps every agent story in a padded canvas so the
 * unified Linear chrome renders against the canonical surfaces.
 * Mirrors `datasets/_story-frame.tsx`.
 */

"use client";

import * as React from "react";

import { cx } from "../utils/cx";

export interface ProductChromeFrameProps {
  children: React.ReactNode;
  padding?: "none" | "sm" | "md";
  maxWidth?: string;
  className?: string;
}

const PADDING: Record<NonNullable<ProductChromeFrameProps["padding"]>, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
};

export function ProductChromeFrame({
  children,
  padding = "md",
  maxWidth,
  className,
}: ProductChromeFrameProps) {
  return (
    <div
      className={cx(
        "min-h-screen bg-page text-ink",
        PADDING[padding],
        className,
      )}
    >
      {maxWidth ? (
        <div style={{ maxWidth }} className="mx-auto">
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
