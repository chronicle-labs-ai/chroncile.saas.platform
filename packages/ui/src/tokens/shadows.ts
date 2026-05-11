/**
 * Shadows — Chronicle brand shadows kept for marketing surfaces,
 * plus the Linear named shadow set (`--shadow-sm`, `--shadow-subtle*`,
 * `--shadow-xl`, …) for product chrome.
 */

export const shadows = {
  card: "var(--shadow-card)",
  panel: "var(--shadow-panel)",
  glowEmber: "var(--shadow-glow-ember)",
  // Linear shadow set
  sm: "var(--shadow-sm)",
  md: "var(--shadow-md)",
  subtle: "var(--shadow-subtle)",
  subtle2: "var(--shadow-subtle-2)",
  subtle3: "var(--shadow-subtle-3)",
  xl: "var(--shadow-xl)",
  subtle4: "var(--shadow-subtle-4)",
  subtle5: "var(--shadow-subtle-5)",
  subtle6: "var(--shadow-subtle-6)",
  popover: "var(--c-pop-shadow)",
} as const;

export type Shadow = keyof typeof shadows;
