/*
 * Story frame — wraps every Backtests story in Linear/product chrome
 * regardless of the global Storybook chrome toolbar (which defaults
 * to brand). Pattern matches `datasets/_story-frame.tsx`:
 *
 *   - sets `data-chrome="product"` on the wrapping div so the CSS
 *     remap in `chrome.css` activates.
 *   - wraps children in `<ChromeStyleProvider value="product">` so
 *     primitives (Button, Tabs, Tag, …) pick the compact density.
 *   - paints the background with `bg-l-surface` so stories don't
 *     show the brand canvas behind them.
 *
 * Internal to `backtests/` — not exported from `index.ts`.
 */

"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import { ChromeStyleProvider } from "../theme";

export interface ProductChromeFrameProps {
  children: React.ReactNode;
  /** Padding around the children. Defaults to `p-6`. Set to `none` to
   *  let the children own their own gutters (used by the manager
   *  story which renders its own top nav). */
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
