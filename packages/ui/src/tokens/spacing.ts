/**
 * Typed mirrors of the spacing CSS variables. Two parallel scales
 * are exposed:
 *
 *   - `spacing` — legacy Chronicle 1..20 names (`--s-*`). Still
 *     used by every existing primitive and Tailwind utility.
 *   - `linearSpacing` — Linear-style 4..128 px scale (`--spacing-*`).
 *     Reach for these when implementing new product surfaces from
 *     the Linear reference.
 */

export const spacing = {
  "1": "var(--s-1)",
  "2": "var(--s-2)",
  "3": "var(--s-3)",
  "4": "var(--s-4)",
  "5": "var(--s-5)",
  "6": "var(--s-6)",
  "8": "var(--s-8)",
  "10": "var(--s-10)",
  "12": "var(--s-12)",
  "16": "var(--s-16)",
  "20": "var(--s-20)",
} as const;

export const linearSpacing = {
  "4": "var(--spacing-4)",
  "8": "var(--spacing-8)",
  "12": "var(--spacing-12)",
  "16": "var(--spacing-16)",
  "20": "var(--spacing-20)",
  "24": "var(--spacing-24)",
  "28": "var(--spacing-28)",
  "32": "var(--spacing-32)",
  "36": "var(--spacing-36)",
  "40": "var(--spacing-40)",
  "48": "var(--spacing-48)",
  "56": "var(--spacing-56)",
  "64": "var(--spacing-64)",
  "80": "var(--spacing-80)",
  "96": "var(--spacing-96)",
  "128": "var(--spacing-128)",
} as const;

/** Layout primitives from the Linear reference. */
export const layoutTokens = {
  sectionGap: "var(--section-gap)",
  cardPadding: "var(--card-padding)",
  elementGap: "var(--element-gap)",
} as const;

/**
 * Density metrics for primitives that need fixed row / input
 * heights (Linear-style 28/32 px rhythm).
 */
export const densityMetrics = {
  rowH: "var(--density-row-h)",
  rowHSm: "var(--density-row-h-sm)",
  inputH: "var(--density-input-h)",
  inputHMd: "var(--density-input-h-md)",
} as const;

export type Spacing = keyof typeof spacing;
export type LinearSpacing = keyof typeof linearSpacing;
export type LayoutToken = keyof typeof layoutTokens;
export type DensityMetric = keyof typeof densityMetrics;
