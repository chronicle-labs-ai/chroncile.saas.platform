import * as React from "react";

/*
 * SourceGlyph — abstract monochrome marks for the data sources the
 * onboarding catalog supports. Use `BrandIcon` for real company logos;
 * these remain local, theme-aware fallbacks that evoke each source without
 * depending on remote brand assets. All draw at 20×20 by default and inherit
 * `currentColor` so callers tint via the surrounding text color (or pass the
 * `color` prop).
 *
 * Add a new glyph: extend `SourceGlyphId`, add an entry to `GLYPHS`.
 */

export type SourceGlyphId =
  | "intercom"
  | "zendesk"
  | "shopify"
  | "stripe"
  | "salesforce"
  | "hubspot"
  | "slack"
  | "segment"
  | "snowflake"
  | "postgres"
  | "kafka"
  | "webhook"
  | "http"
  | "gmail"
  | "linear"
  | "notion";

const Svg = ({
  size = 20,
  children,
  ...rest
}: React.SVGProps<SVGSVGElement> & { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden
    {...rest}
  >
    {children}
  </svg>
);

const GLYPHS: Record<
  SourceGlyphId,
  (color: string, size: number) => React.ReactElement
> = {
  intercom: (c, size) => (
    <Svg size={size}>
      <rect
        x="2"
        y="3"
        width="16"
        height="13"
        rx="3"
        stroke={c}
        strokeWidth="1.3"
      />
      <path
        d="M6 18l2-2 2 2"
        stroke={c}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M6 8v3M10 7v5M14 8v3"
        stroke={c}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </Svg>
  ),
  zendesk: (c, size) => (
    <Svg size={size}>
      <path d="M2 5l8 8V5H2z" fill={c} />
      <path d="M18 15l-8-8v8h8z" fill={c} />
    </Svg>
  ),
  shopify: (c, size) => (
    <Svg size={size}>
      <path
        d="M10 2c-2 0-3 1.5-3 3H4l-1 13h14L16 5h-3c0-1.5-1-3-3-3z"
        stroke={c}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M8 9.5c0-1 .7-1.5 1.6-1.5S11 8.7 11 9.5"
        stroke={c}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </Svg>
  ),
  stripe: (c, size) => (
    <Svg size={size}>
      <path
        d="M4 6a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"
        stroke={c}
        strokeWidth="1.3"
      />
      <path
        d="M7 13c.8.6 1.8 1 3 1 2 0 2.8-1 2.8-1.8 0-.9-.6-1.4-2.3-2-1.5-.5-2-.9-2-1.6 0-.6.5-1.1 1.6-1.1.9 0 1.8.3 2.4.7"
        stroke={c}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </Svg>
  ),
  salesforce: (c, size) => (
    <Svg size={size}>
      <path
        d="M3 12a3 3 0 013-3 4 4 0 017.7-1A3 3 0 0117 14a3 3 0 01-3 3H6a3 3 0 01-3-3v-2z"
        stroke={c}
        strokeWidth="1.3"
      />
    </Svg>
  ),
  hubspot: (c, size) => (
    <Svg size={size}>
      <circle cx="14" cy="10" r="3.3" stroke={c} strokeWidth="1.3" />
      <path
        d="M14 6.7V3M6 3v14M6 10h4.7"
        stroke={c}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="6" cy="17" r="1.3" fill={c} />
    </Svg>
  ),
  slack: (c, size) => (
    <Svg size={size}>
      <rect
        x="8"
        y="2"
        width="2.3"
        height="8"
        rx="1.15"
        stroke={c}
        strokeWidth="1.2"
      />
      <rect
        x="2"
        y="8"
        width="8"
        height="2.3"
        rx="1.15"
        stroke={c}
        strokeWidth="1.2"
      />
      <rect
        x="9.7"
        y="10"
        width="2.3"
        height="8"
        rx="1.15"
        stroke={c}
        strokeWidth="1.2"
      />
      <rect
        x="10"
        y="9.7"
        width="8"
        height="2.3"
        rx="1.15"
        stroke={c}
        strokeWidth="1.2"
      />
    </Svg>
  ),
  segment: (c, size) => (
    <Svg size={size}>
      <path d="M3 7h11" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M17 7a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" fill={c} />
      <path d="M17 13H6" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M3 11.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" fill={c} />
    </Svg>
  ),
  snowflake: (c, size) => (
    <Svg size={size}>
      <path
        d="M10 2v16M3 6l14 8M3 14l14-8"
        stroke={c}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="10" cy="10" r="1.5" fill={c} />
    </Svg>
  ),
  postgres: (c, size) => (
    <Svg size={size}>
      <ellipse cx="10" cy="5" rx="7" ry="2.3" stroke={c} strokeWidth="1.3" />
      <path
        d="M3 5v10c0 1.3 3.1 2.3 7 2.3s7-1 7-2.3V5"
        stroke={c}
        strokeWidth="1.3"
      />
      <path
        d="M3 10c0 1.3 3.1 2.3 7 2.3s7-1 7-2.3"
        stroke={c}
        strokeWidth="1.3"
      />
    </Svg>
  ),
  kafka: (c, size) => (
    <Svg size={size}>
      <circle cx="4" cy="10" r="1.5" fill={c} />
      <circle cx="14" cy="5" r="1.5" fill={c} />
      <circle cx="14" cy="15" r="1.5" fill={c} />
      <circle cx="16" cy="10" r="1.5" stroke={c} strokeWidth="1.3" />
      <path
        d="M5.3 9L12.7 5.7M5.3 11L12.7 14.3M14 6.5v7"
        stroke={c}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </Svg>
  ),
  webhook: (c, size) => (
    <Svg size={size}>
      <circle cx="6" cy="7" r="2" stroke={c} strokeWidth="1.3" />
      <circle cx="14" cy="14" r="2" stroke={c} strokeWidth="1.3" />
      <circle cx="14" cy="7" r="2" stroke={c} strokeWidth="1.3" />
      <path
        d="M7.5 8.5l5 4.5M12 7h-4"
        stroke={c}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </Svg>
  ),
  http: (c, size) => (
    <Svg size={size}>
      <rect
        x="2"
        y="5"
        width="16"
        height="10"
        rx="2"
        stroke={c}
        strokeWidth="1.3"
      />
      <path
        d="M5 9h2M9 9h2M13 9h2M5 12h10"
        stroke={c}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </Svg>
  ),
  gmail: (c, size) => (
    <Svg size={size}>
      <rect
        x="2"
        y="5"
        width="16"
        height="11"
        rx="1.5"
        stroke={c}
        strokeWidth="1.3"
      />
      <path
        d="M2.5 5.8L10 11l7.5-5.2"
        stroke={c}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </Svg>
  ),
  linear: (c, size) => (
    <Svg size={size}>
      <path d="M2.5 11.5L8.5 17.5" stroke={c} strokeWidth="1.3" />
      <path d="M2.5 7.5L12.5 17.5" stroke={c} strokeWidth="1.3" />
      <path d="M3.5 4.5L15.5 16.5" stroke={c} strokeWidth="1.3" />
      <path d="M6.5 3L17 13.5" stroke={c} strokeWidth="1.3" />
      <path d="M11 2.5L17.5 9" stroke={c} strokeWidth="1.3" />
    </Svg>
  ),
  notion: (c, size) => (
    <Svg size={size}>
      <rect
        x="3"
        y="3"
        width="14"
        height="14"
        rx="1.5"
        stroke={c}
        strokeWidth="1.3"
      />
      <path
        d="M7 6v8M7 6l6 8M13 6v8"
        stroke={c}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </Svg>
  ),
};

export const SOURCE_GLYPH_IDS: readonly SourceGlyphId[] = Object.keys(
  GLYPHS
) as SourceGlyphId[];

export interface SourceGlyphProps {
  id: SourceGlyphId;
  /** Stroke / fill color. Defaults to `currentColor` so the parent text color paints the glyph. */
  color?: string;
  /** Pixel size; the glyph keeps its 1:1 aspect ratio. Defaults to 20. */
  size?: number;
  className?: string;
}

export function SourceGlyph({
  id,
  color = "currentColor",
  size = 20,
  className,
}: SourceGlyphProps) {
  const render = GLYPHS[id];
  if (!render) return null;
  const node = render(color, size) as React.ReactElement<
    React.SVGProps<SVGSVGElement>
  >;
  return React.cloneElement(node, {
    className,
    width: size,
    height: size,
  });
}
