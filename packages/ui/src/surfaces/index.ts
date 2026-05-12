/*
 * Chronicle glass surface primitives — ported from the sibling
 * `chronicle.design-system` repo (@chronicle/glass, MIT). The design
 * API is built around four primitives plus a small set of opinionated
 * recipes that compose them into the Figma frames.
 *
 *   GlassScene   — dark stage with logical pixel coordinates.
 *   LightSource  — the gradient emitter (pill / sheet / blob).
 *   GlassPane    — a single backdrop-filter slat.
 *   GlassStack   — N panes laid out in a flex row/column.
 *
 *   Blinds, Dawn, Diagonal, Dusk, Ember, Monolith — recipes.
 */

export { GlassScene } from "./glass-scene";
export type { GlassSceneProps } from "./glass-scene";

export { LightSource } from "./light-source";
export type {
  LightSourceProps,
  LightSourceShape,
  LightSourceShadow,
} from "./light-source";

export { GlassPane } from "./glass-pane";
export type { GlassPaneProps } from "./glass-pane";

export { GlassStack } from "./glass-stack";
export type { GlassStackProps } from "./glass-stack";

export { AmbientBackground } from "./ambient-background";
export type { AmbientBackgroundProps } from "./ambient-background";

// Recipes — opinionated compositions from the Figma source.
export * from "./recipes";

// Tokens (palettes + scales) for advanced callers composing their own
// scenes. Most consumers should reach for the recipes or the four
// primitives above instead.
export {
  palettes,
  getPalette,
  paletteToCss,
  EMBER_FULL,
  EMBER_SOFT,
  EMBER_MONOLITH,
  DIAGONAL_TIDE,
  BLUR_SCALE,
  HIGHLIGHT_SCALE,
  BACKGROUND_SCALE,
  resolveBlur,
  resolveBackground,
} from "./tokens";
export type {
  Palette,
  PaletteName,
  PaletteStop,
  Blur,
  Highlight,
  Background,
} from "./tokens";
