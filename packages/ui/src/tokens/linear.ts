/**
 * Typed mirrors of the Linear-density CSS variables declared in
 * `src/styles/linear.css`. Values are `var(--…)` references — pass
 * them anywhere a color string is expected and theme-switching still
 * works. Concrete hex values live in linear.css.
 *
 * Reach for these when building product surfaces (denser, app-feel).
 * Brand / marketing surfaces should stay on the brand `--c-*`
 * tokens exposed from `./colors`.
 */

export const linearSurfaces = {
  surface: "var(--l-surface)",
  surfaceRaised: "var(--l-surface-raised)",
  surfaceRaised2: "var(--l-surface-raised-2)",
  surfaceInput: "var(--l-surface-input)",
  surfaceBar: "var(--l-surface-bar)",
  surfaceBar2: "var(--l-surface-bar-2)",
  surfaceHover: "var(--l-surface-hover)",
  surfaceSelected: "var(--l-surface-selected)",
} as const;

export const linearWashes = {
  wash1: "var(--l-wash-1)",
  wash2: "var(--l-wash-2)",
  wash3: "var(--l-wash-3)",
  wash5: "var(--l-wash-5)",
} as const;

export const linearBorders = {
  border: "var(--l-border)",
  borderStrong: "var(--l-border-strong)",
  borderHover: "var(--l-border-hover)",
  borderFaint: "var(--l-border-faint)",
  dotEdge: "var(--l-dot-edge)",
} as const;

export const linearInks = {
  ink: "var(--l-ink)",
  inkLo: "var(--l-ink-lo)",
  inkDim: "var(--l-ink-dim)",
} as const;

export const linearPopover = {
  bg: "var(--l-pop-bg)",
  border: "var(--l-pop-border)",
  shadow: "var(--l-pop-shadow)",
} as const;

export const linearPriorities = {
  urgent: "var(--l-p-urgent)",
  high: "var(--l-p-high)",
  med: "var(--l-p-med)",
  low: "var(--l-p-low)",
  none: "var(--l-p-none)",
} as const;

export const linearStatuses = {
  backlog: "var(--l-status-backlog)",
  todo: "var(--l-status-todo)",
  inprogress: "var(--l-status-inprogress)",
  done: "var(--l-status-done)",
  canceled: "var(--l-status-canceled)",
} as const;

export const linearMetrics = {
  radius: "var(--l-radius)",
  radiusSm: "var(--l-radius-sm)",
  rowH: "var(--l-row-h)",
  rowHSm: "var(--l-row-h-sm)",
  inputH: "var(--l-input-h)",
  inputHMd: "var(--l-input-h-md)",
  shadeOverlay: "var(--l-shade-overlay)",
} as const;

export type LinearSurface = keyof typeof linearSurfaces;
export type LinearWash = keyof typeof linearWashes;
export type LinearBorder = keyof typeof linearBorders;
export type LinearInk = keyof typeof linearInks;
export type LinearPriority = keyof typeof linearPriorities;
export type LinearStatus = keyof typeof linearStatuses;
