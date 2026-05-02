/*
 * Story frame — a small wrapper that forces every dataset story into
 * Linear/product chrome regardless of the global Storybook chrome
 * toolbar (which defaults to brand). The frame:
 *
 *   - sets `data-chrome="product"` on the wrapping div so the CSS
 *     remap in `chrome.css` activates and `--c-*` surface/border/ink
 *     tokens flip to their `--l-*` equivalents.
 *   - wraps children in `<ChromeStyleProvider value="product">` so
 *     primitives that read the chrome context (Button, Input, ...)
 *     pick the compact density.
 *   - paints the background with `bg-l-surface` so stories don't show
 *     the brand canvas behind them.
 *
 * Usage in a story file:
 *
 *   <ProductChromeFrame>
 *     <DatasetCard ... />
 *   </ProductChromeFrame>
 *
 * This is internal to the datasets module — not exported from
 * `index.ts`.
 */

"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import { ChromeStyleProvider } from "../theme";

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
