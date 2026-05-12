/*
 * Glass system tokens.
 *
 * Ported from @chronicle/glass (sibling repo) — the design API whose
 * whole job is producing beautiful gradients + glass panes on top of a
 * dark stage. The CSS custom properties that back these tokens live in
 * `../styles/glass.css`; this file is just the typed façade that our
 * primitives consume.
 */

// ─────────────────────────────────────────────────────────────
// Palettes (LightSource gradient fills)
// ─────────────────────────────────────────────────────────────

export type PaletteStop = readonly [position: number, color: string];

export interface Palette {
  readonly angle: number;
  readonly stops: readonly PaletteStop[];
}

/**
 * Primary ember palette — from Figma node 0:35.
 * 6 stops: deep orange through sage, teal, gold, beige, into muted earth.
 */
export const EMBER_FULL: Palette = {
  angle: 182,
  stops: [
    [0.0, "#d8430a"],
    [0.1587, "#905838"],
    [0.351, "#709188"],
    [0.5, "#a39261"],
    [0.7452, "#b09b74"],
    [1.0, "#786e68"],
  ],
};

/** 5-stop variant (nodes 0:50, 0:95 — Dawn/Ember recipes). */
export const EMBER_SOFT: Palette = {
  angle: 182,
  stops: [
    [0.0, "#d8430a"],
    [0.1587, "#905838"],
    [0.4904, "#709188"],
    [0.797, "#b09b74"],
    [1.0, "#786e68"],
  ],
};

/** Monolith variant (node 0:80) — shifted mid-stop. */
export const EMBER_MONOLITH: Palette = {
  angle: 180,
  stops: [
    [0.0, "#d8430a"],
    [0.1587, "#905838"],
    [0.408, "#709188"],
    [0.797, "#b09b74"],
    [1.0, "#786e68"],
  ],
};

/** Teal-to-orange sweep for horizontal compositions (node 0:63). */
export const DIAGONAL_TIDE: Palette = {
  angle: 90,
  stops: [
    [0.0, "#709188"],
    [0.3, "#141616"],
    [0.5, "#1e120c"],
    [0.7, "#78371e"],
    [1.0, "#d85a1c"],
  ],
};

export const palettes = {
  ember: EMBER_FULL,
  emberSoft: EMBER_SOFT,
  emberMonolith: EMBER_MONOLITH,
  tide: DIAGONAL_TIDE,
} as const;

export type PaletteName = keyof typeof palettes;

export const getPalette = (name: PaletteName): Palette => palettes[name];

/** Serialize a palette to a CSS `linear-gradient(...)` string. */
export const paletteToCss = (palette: Palette | PaletteName): string => {
  const p = typeof palette === "string" ? getPalette(palette) : palette;
  const stops = p.stops
    .map(([pos, color]) => `${color} ${(pos * 100).toFixed(2)}%`)
    .join(", ");
  return `linear-gradient(${p.angle}deg, ${stops})`;
};

// ─────────────────────────────────────────────────────────────
// Scales (blur, highlight, background)
// ─────────────────────────────────────────────────────────────

export const BLUR_SCALE = {
  sm: "var(--cg-blur-sm)",
  md: "var(--cg-blur-md)",
  lg: "var(--cg-blur-lg)",
  xl: "var(--cg-blur-xl)",
  "2xl": "var(--cg-blur-2xl)",
} as const;

export type Blur = keyof typeof BLUR_SCALE | number | string;

export const HIGHLIGHT_SCALE = {
  default: "default",
  soft: "soft",
} as const;

export type Highlight = keyof typeof HIGHLIGHT_SCALE;

export const BACKGROUND_SCALE = {
  obsidian: "var(--cg-bg-obsidian)",
  void: "var(--cg-bg-void)",
  paper: "var(--cg-bg-paper)",
  bone: "var(--cg-bg-bone)",
} as const;

export type Background = keyof typeof BACKGROUND_SCALE | string;

export const resolveBlur = (blur: Blur | undefined): string => {
  if (blur === undefined) return BLUR_SCALE.xl;
  if (typeof blur === "number") return `${blur}px`;
  if (blur in BLUR_SCALE) return BLUR_SCALE[blur as keyof typeof BLUR_SCALE];
  return blur;
};

export const resolveBackground = (bg: Background | undefined): string => {
  if (bg === undefined) return BACKGROUND_SCALE.obsidian;
  if (bg in BACKGROUND_SCALE) {
    return BACKGROUND_SCALE[bg as keyof typeof BACKGROUND_SCALE];
  }
  return bg;
};
