"use client";

import * as React from "react";
import { cx } from "../utils/cx";

/*
 * ScanLoader — typed wrapper around the `.cg-scan-loader` CSS class
 * defined in `styles/auth.css`. A horizontal hairline track with a
 * single ember sweep that crosses the bar on a 1.4s loop. Used in
 * the provisioning + workspace auto-route surfaces (A.5, G.1) as
 * the "we're working on it" indicator.
 *
 * The loader respects `prefers-reduced-motion` — the sweep stops in
 * that mode but the static track stays visible so layout doesn't
 * shift.
 */

export interface ScanLoaderProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Aria label for screen readers. Default "Loading". */
  "aria-label"?: string;
}

/**
 * Horizontal scanning bar. Uses the `.cg-scan-loader` class shipped
 * in `styles/auth.css`; pass `className` to override sizing
 * (`h-[2px]`, `max-w-[200px]`, etc).
 */
export function ScanLoader({
  className,
  "aria-label": ariaLabel = "Loading",
  ...rest
}: ScanLoaderProps) {
  return (
    <div
      role="status"
      aria-label={ariaLabel}
      aria-live="polite"
      aria-busy
      className={cx("cg-scan-loader w-full", className)}
      {...rest}
    />
  );
}
