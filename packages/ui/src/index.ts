// Chronicle Labs Design System — public API
//
// Imports stay compatible with the previous `ui` package exports so
// existing call sites across apps/frontend and apps/env-manager keep
// compiling. Old variant names are shimmed at the component level.

export * from "./primitives";
export * from "./typography";
export * from "./surfaces";
export * from "./product";
export * from "./layout";
export * from "./providers";
export * from "./icons";
export * from "./auth";
export * from "./admin";
export * from "./env-manager";
export * from "./onboarding";
export * from "./connectors";
export * from "./connections";
export * from "./stream-timeline";
export * from "./datasets";
export * from "./agents";
export * from "./backtests";

// Theme
export {
  ThemeProvider,
  useTheme,
  ThemeToggle,
  themeScript,
  THEME_STORAGE_KEY,
} from "./theme";
export type {
  Theme,
  ThemeProviderProps,
  ThemeToggleProps,
} from "./theme";

// Tokens (TS mirrors)
export * as tokens from "./tokens";

// Small utilities some consumers reach for
export { cx } from "./utils/cx";
export type { ClassValue } from "./utils/cx";
export { cn } from "./utils/cn";
export type { ClassValue as CnClassValue } from "./utils/cn";

// Variant + render-prop compose helpers (for building on RAC primitives)
export { tv } from "./utils/tv";
export type { VariantProps } from "./utils/tv";
export { composeTwRenderProps, composeSlotClassName } from "./utils/compose";
export { dom } from "./utils/dom";
export type { DOMRenderProps, DOMRenderFunction } from "./utils/dom";
