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
    case "replay":
      return (
        <svg {...props}>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
          <path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none" />
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
