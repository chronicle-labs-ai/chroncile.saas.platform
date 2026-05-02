"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import {
  CompanyLogo,
  getBrandIconDomain,
  getLogoDevPublishableKey,
  getLogoDevUrl,
  type CompanyLogoProps,
} from "../icons";

import {
  getCompanyLogoTone,
  useDetectedLogoTone,
  type CompanyLogoTone,
} from "./company-tone";

/*
 * AgentCompanyMark — `<CompanyLogo>` wrapped in a tone-aware tile.
 *
 * The problem: logo.dev returns a brand's primary mark, which is
 * often a black / very-dark monochrome glyph (OpenAI, Vercel,
 * Anthropic, GitHub, X, Cursor, …). Rendered straight onto the dark
 * `data-chrome="product"` canvas it disappears.
 *
 * The fix: wrap the logo in a contrasting tile. The tile color is
 * chosen by:
 *
 *   1. A static `KNOWN_DARK_TONE_BRANDS` lookup — instant, SSR-safe.
 *   2. An optional runtime canvas probe that measures the loaded
 *      image's mean luminance and upgrades the tone after first
 *      paint. Cached per URL so each brand pays the cost once.
 *
 * The static lookup paints the right tile immediately and survives
 * hydration. The runtime probe is opt-in via `runtimeDetect` and
 * upgrades the answer when the brand isn't in the curated set.
 *
 * Three sizes mirror the rest of the agents module:
 *
 *   "xs" — 12px logo, 18px tile  (table rows, inline mentions)
 *   "sm" — 14px logo, 24px tile  (cards, version rows)
 *   "md" — 22px logo, 36px tile  (detail page header, hero tile)
 */

export interface AgentCompanyMarkProps
  extends Omit<
    CompanyLogoProps,
    "size" | "className" | "fallbackBackground" | "fallbackColor"
  > {
  /** Brand name (passed through to `<CompanyLogo>`). */
  name: string;
  /** Optional explicit logo.dev domain (passed through). */
  domain?: string | null;
  size?: "xs" | "sm" | "md";
  /** Force the tile to a specific tone, bypassing detection. */
  tone?: CompanyLogoTone;
  /**
   * Enable the canvas-based luminance probe for unknown brands.
   * Defaults to `true`; set to `false` for SSR-only / paint-budget
   * sensitive contexts (e.g. dense table rows).
   */
  runtimeDetect?: boolean;
  /** Override the tile's tailwind class for special placements. */
  tileClassName?: string;
  /** Optional class on the tile wrapper (sizing / placement). */
  className?: string;
}

const SIZE_PX: Record<NonNullable<AgentCompanyMarkProps["size"]>, number> = {
  xs: 12,
  sm: 14,
  md: 22,
};

const TILE_PX: Record<NonNullable<AgentCompanyMarkProps["size"]>, number> = {
  xs: 18,
  sm: 24,
  md: 36,
};

const TILE_RADIUS: Record<NonNullable<AgentCompanyMarkProps["size"]>, number> = {
  xs: 2,
  sm: 3,
  md: 4,
};

/**
 * Tile colors per resolved tone. We use a near-white tile for dark
 * marks and an ink tile for light marks. Both use a thin hairline so
 * the tile reads as design-system surface, not a sticker.
 */
const TILE_TONE_CLASS: Record<CompanyLogoTone, string> = {
  dark: "bg-white border border-l-border-faint",
  light: "bg-l-ink border border-l-border-faint",
  neutral: "bg-l-surface-input border border-l-border-faint",
};

export function AgentCompanyMark({
  name,
  domain,
  size = "sm",
  tone: toneProp,
  runtimeDetect = true,
  tileClassName,
  className,
  ...rest
}: AgentCompanyMarkProps) {
  const staticTone = React.useMemo(() => getCompanyLogoTone(name), [name]);

  // Resolve the same URL `<CompanyLogo>` will use so the runtime
  // probe measures the exact bytes the user is about to see.
  const probeUrl = React.useMemo(() => {
    if (toneProp || !runtimeDetect) return null;
    if (typeof domain === "string" && domain.length > 0) {
      return getLogoDevUrl(domain, {
        token: getLogoDevPublishableKey(),
        size: SIZE_PX[size],
        format: "webp",
      });
    }
    if (domain === null) return null;
    const guess = getBrandIconDomain(name);
    if (!guess) return null;
    return getLogoDevUrl(guess, {
      token: getLogoDevPublishableKey(),
      size: SIZE_PX[size],
      format: "webp",
    });
  }, [name, domain, size, runtimeDetect, toneProp]);

  // Static tone wins immediately — runtime probe only upgrades a
  // "neutral" answer.
  const detectedTone = useDetectedLogoTone(probeUrl, {
    fallback: staticTone,
    disabled: Boolean(toneProp) || !runtimeDetect || staticTone !== "neutral",
  });

  const tone: CompanyLogoTone = toneProp ?? (
    staticTone !== "neutral" ? staticTone : detectedTone
  );

  const tilePx = TILE_PX[size];
  const radius = TILE_RADIUS[size];

  return (
    <span
      data-tone={tone}
      aria-hidden
      className={cx(
        "inline-flex shrink-0 items-center justify-center",
        TILE_TONE_CLASS[tone],
        tileClassName,
        className,
      )}
      style={{
        width: tilePx,
        height: tilePx,
        borderRadius: radius,
      }}
    >
      <CompanyLogo
        {...rest}
        name={name}
        domain={domain}
        size={SIZE_PX[size]}
        radius={Math.max(radius - 1, 0)}
        fallbackBackground="transparent"
      />
    </span>
  );
}
