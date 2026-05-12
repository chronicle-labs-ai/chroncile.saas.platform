"use client";

import * as React from "react";

import { CompanyLogo } from "../icons";
import { sourceColor, sourceTintedBackground } from "../stream-timeline/source-color";
import { cx } from "../utils/cx";

/*
 * SourceLogoStack — overlapping CompanyLogo cluster for the
 * many-to-one case where a single trace, dataset row, or filter
 * pill represents a list of source integrations.
 *
 * Layout follows the existing `AvatarGroup` pattern in
 * `primitives/avatar.tsx`, but tailored for `CompanyLogo` so the
 * brand glyphs and Logo.dev fallbacks render at the same 12-16px
 * size everywhere a trace's sources appear.
 *
 * No layout shift: every slot (logo, +N chip) has fixed dimensions,
 * the wrapper sets `inline-flex` so it sits inline cleanly, and a
 * 1px ring matching the surface bg keeps the overlap legible against
 * any wash without paint flicker between rows.
 *
 * Single-source case collapses to a bare `CompanyLogo` (no ring,
 * no wrapper) so the very common 1-source case is byte-equivalent
 * to the prior, single-glyph rendering.
 */

export interface SourceLogoStackProps {
  /** All distinct sources for this entity, ordered by event count
   *  desc (the same shape as `TraceSummary.sources`). The first
   *  `max` entries render as overlapping logos; the rest collapse
   *  into a `+N` chip. */
  sources: readonly string[];
  /** Maximum number of logos rendered before overflowing into `+N`.
   *  Defaults to 3, which keeps the cluster <= ~36px wide at the
   *  default 14px size. */
  max?: number;
  /** Pixel size of each square logo. Defaults to 14. */
  size?: 12 | 14 | 16;
  /** Border radius of each logo. Defaults to 3. */
  radius?: number;
  /** Tailwind class for the 1px ring used to lift each logo off the
   *  one beneath it. Pick the surface the stack is rendered on so
   *  the ring "carves" cleanly. Defaults to `ring-l-surface-bar`. */
  ringClassName?: string;
  className?: string;
}

export function SourceLogoStack({
  sources,
  max = 3,
  size = 14,
  radius = 3,
  ringClassName = "ring-l-surface-bar",
  className,
}: SourceLogoStackProps) {
  if (sources.length === 0) return null;

  /* Single-source — render the bare logo so we don't add a ring or
     extra wrapper for the common case. */
  if (sources.length === 1) {
    const only = sources[0]!;
    const tint = sourceTintedBackground(sourceColor(only), 22);
    return (
      <CompanyLogo
        name={only}
        size={size}
        radius={radius}
        fallbackBackground={tint}
        fallbackColor="var(--c-ink-hi)"
        aria-hidden
        className={className}
      />
    );
  }

  const visible = sources.slice(0, max);
  const overflow = sources.length - visible.length;
  const ariaLabel = `Sources: ${sources.join(", ")}`;

  /* 30% overlap — adjacent glyphs nest just enough to read as a
     stack while keeping ~70% of each logo visible so the brand
     marks stay legible. Computed from `size` so 12/14/16px stacks
     all feel equally tight. */
  const overlap = Math.round(size * 0.3);

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={cx("inline-flex shrink-0 items-center", className)}
    >
      {visible.map((source, idx) => {
        const tint = sourceTintedBackground(sourceColor(source), 22);
        return (
          <span
            key={`${source}:${idx}`}
            aria-hidden
            className={cx(
              "relative inline-flex shrink-0 items-center justify-center",
              "overflow-hidden",
              "ring-1",
              ringClassName,
            )}
            style={{
              width: size,
              height: size,
              borderRadius: radius,
              /* Solid backstop so transparent regions in the brand
                 glyph (most logos ship with cutouts) don't show the
                 logo beneath. Tinted to the brand color so the logo
                 still reads as its brand even before the Logo.dev
                 image loads. */
              background: tint,
              marginLeft: idx > 0 ? -overlap : 0,
              /* Later logos sit above earlier ones — keeps the leading
                 edge of each glyph (its identifying mark) visible. */
              zIndex: idx + 1,
            }}
          >
            <CompanyLogo
              name={source}
              size={size}
              radius={radius}
              fallbackBackground={tint}
              fallbackColor="var(--c-ink-hi)"
              aria-hidden
            />
          </span>
        );
      })}
      {overflow > 0 ? (
        <span
          aria-hidden
          className={cx(
            "relative inline-flex shrink-0 items-center justify-center",
            "bg-l-wash-3 text-l-ink-dim",
            "font-mono text-[9.5px] leading-none tabular-nums",
            "ring-1",
            ringClassName,
          )}
          style={{
            height: size,
            minWidth: size + 4,
            paddingInline: 3,
            borderRadius: radius,
            marginLeft: -overlap,
            zIndex: visible.length + 1,
          }}
        >
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}
