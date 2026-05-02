/*
 * Backtests · Job meta — glyph + visual treatment for the 4 starting
 * jobs the Configure picker offers. Glyphs render as inline SVGs to
 * avoid pulling more lucide imports.
 */

import * as React from "react";

import type { BacktestJobIcon } from "./types";

export function JobIcon({
  kind,
  className,
}: {
  kind: BacktestJobIcon;
  className?: string;
}): React.ReactElement | null {
  const props = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    className,
    "aria-hidden": true as const,
  };
  switch (kind) {
    case "compare":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="7" height="14" rx="1" />
          <rect x="14" y="5" width="7" height="14" rx="1" />
          <path d="M10 12h4" strokeDasharray="2 2" />
        </svg>
      );
    case "shield":
      return (
        <svg {...props}>
          <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "bug":
      return (
        <svg {...props}>
          <rect x="7" y="8" width="10" height="11" rx="4" />
          <path d="M9 8V6a3 3 0 016 0v2" />
          <path d="M3 12h4M17 12h4M4 6l3 3M20 6l-3 3M4 18l3-3M20 18l-3-3" />
        </svg>
      );
    case "suite":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="4" rx="1" />
          <rect x="3" y="10" width="18" height="4" rx="1" />
          <rect x="3" y="16" width="18" height="4" rx="1" />
          <circle cx="7" cy="6" r="0.8" fill="currentColor" />
          <circle cx="7" cy="12" r="0.8" fill="currentColor" />
          <circle cx="7" cy="18" r="0.8" fill="currentColor" />
        </svg>
      );
  }
}
