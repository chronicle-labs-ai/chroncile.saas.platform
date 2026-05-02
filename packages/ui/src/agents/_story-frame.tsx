/*
 * Story frame — wraps every agent story in product chrome so the
 * `--l-*` token block activates and primitives that read the chrome
 * context render in compact/Linear density. Mirrors
 * `datasets/_story-frame.tsx`.
 */

"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import { ChromeStyleProvider } from "../theme";

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
    <ChromeStyleProvider value="product">
      <div
        data-chrome="product"
        className={cx(
          "min-h-screen bg-l-surface text-l-ink",
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
    </ChromeStyleProvider>
  );
}
