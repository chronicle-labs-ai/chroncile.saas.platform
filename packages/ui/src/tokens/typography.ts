/**
 * Typed mirrors of the typography CSS variables declared in
 * `src/styles/tokens.css`. Type families resolve to the unified
 * font stack (Kalice display + Inter Variable body + Berkeley
 * Mono / IBM Plex Mono code).
 */

export const fontFamilies = {
  display: "var(--font-display)",
  sans: "var(--font-sans)",
  mono: "var(--font-mono)",
} as const;

/** Legacy Chronicle scale — sized for marketing / decks. */
export const fontSizes = {
  "display-xxl": "var(--fs-display-xxl)",
  "display-xl": "var(--fs-display-xl)",
  "display-lg": "var(--fs-display-lg)",
  "display-md": "var(--fs-display-md)",
  "display-sm": "var(--fs-display-sm)",
  "title-lg": "var(--fs-title-lg)",
  title: "var(--fs-title)",
  "title-sm": "var(--fs-title-sm)",
  "body-lg": "var(--fs-body-lg)",
  body: "var(--fs-body)",
  "body-sm": "var(--fs-body-sm)",
  micro: "var(--fs-micro)",
  "mono-lg": "var(--fs-mono-lg)",
  mono: "var(--fs-mono)",
  "mono-sm": "var(--fs-mono-sm)",
  "mono-xs": "var(--fs-mono-xs)",
} as const;

/**
 * Linear semantic type roles — preferred for new product UI.
 * Each token bundles size + line-height + tracking.
 */
export const textRoles = {
  caption: {
    fontSize: "var(--text-caption)",
    lineHeight: "var(--leading-caption)",
    letterSpacing: "var(--tracking-caption)",
  },
  body: {
    fontSize: "var(--text-body)",
    lineHeight: "var(--leading-body)",
    letterSpacing: "var(--tracking-body)",
  },
  heading: {
    fontSize: "var(--text-heading)",
    lineHeight: "var(--leading-heading)",
    letterSpacing: "var(--tracking-heading)",
  },
  headingLg: {
    fontSize: "var(--text-heading-lg)",
    lineHeight: "var(--leading-heading-lg)",
    letterSpacing: "var(--tracking-heading-lg)",
  },
  display: {
    fontSize: "var(--text-display)",
    lineHeight: "var(--leading-display)",
    letterSpacing: "var(--tracking-display)",
  },
} as const;

export const fontWeights = {
  light: "var(--font-weight-light)",
  regular: "var(--font-weight-regular)",
  w510: "var(--font-weight-w510)",
  w590: "var(--font-weight-w590)",
} as const;

export type FontFamily = keyof typeof fontFamilies;
export type FontSize = keyof typeof fontSizes;
export type TextRole = keyof typeof textRoles;
export type FontWeight = keyof typeof fontWeights;
