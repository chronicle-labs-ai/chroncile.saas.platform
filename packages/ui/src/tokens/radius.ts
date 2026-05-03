/**
 * Radii — legacy Chronicle scale (`--r-*`) plus the Linear named
 * roles (`--radius-*`) for direct semantic use (cards / buttons /
 * inputs / badges / tags / pill).
 */

export const radius = {
  xs: "var(--r-xs)",
  sm: "var(--r-sm)",
  md: "var(--r-md)",
  lg: "var(--r-lg)",
  xl: "var(--r-xl)",
  pill: "var(--r-pill)",
} as const;

export const namedRadius = {
  pill: "var(--radius-pill)",
  tags: "var(--radius-tags)",
  cards: "var(--radius-cards)",
  badges: "var(--radius-badges)",
  inputs: "var(--radius-inputs)",
  buttons: "var(--radius-buttons)",
  default: "var(--radius-default)",
} as const;

export type Radius = keyof typeof radius;
export type NamedRadius = keyof typeof namedRadius;
