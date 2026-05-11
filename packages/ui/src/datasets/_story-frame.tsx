/*
 * Story frame — wraps every dataset story in a padded canvas so
 * the unified Linear chrome renders against the canonical
 * surfaces. Internal to the datasets module — not exported from
 * `index.ts`.
 */

"use client";

import * as React from "react";

import { cx } from "../utils/cx";

export interface ProductChromeFrameProps {
  children: React.ReactNode;
  /** Padding around the children. Defaults to `p-6`. Set to `none` to
   *  fill the canvas without inner padding (used by the manager and
   *  detail page stories that already manage their own gutters). */
  padding?: "none" | "sm" | "md";
  /** Constrain the inner width. Defaults to none (full bleed). */
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
