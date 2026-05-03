/**
 * Typed mirrors of the color CSS variables declared in
 * `src/styles/tokens.css`. Values are `var(--…)` references — pass
 * them anywhere a color string is expected and theme-switching still
 * works. Concrete hex values live in tokens.css.
 *
 * The token namespace is unified: there is no longer a brand vs
 * product split. The `linearTokens` mirror exposes Linear's named
 * "Midnight Command Center" palette as first-class references for
 * surfaces and accents that you can reach for by name.
 */

export const surfaceTokens = {
  void: "var(--c-void)",
  black: "var(--c-black)",
  page: "var(--c-page)",
  surface00: "var(--c-surface-00)",
  surface01: "var(--c-surface-01)",
  surface02: "var(--c-surface-02)",
  surface03: "var(--c-surface-03)",
  surfaceInput: "var(--c-surface-input)",
} as const;

export const hairlineTokens = {
  hairline: "var(--c-hairline)",
  hairlineStrong: "var(--c-hairline-strong)",
  divider: "var(--c-divider)",
} as const;

export const inkTokens = {
  hi: "var(--c-ink-hi)",
  base: "var(--c-ink)",
  lo: "var(--c-ink-lo)",
  dim: "var(--c-ink-dim)",
  faint: "var(--c-ink-faint)",
  invHi: "var(--c-ink-inv-hi)",
  inv: "var(--c-ink-inv)",
  invLo: "var(--c-ink-inv-lo)",
  invDim: "var(--c-ink-inv-dim)",
} as const;

export const washTokens = {
  wash1: "var(--c-wash-1)",
  wash2: "var(--c-wash-2)",
  wash3: "var(--c-wash-3)",
  wash5: "var(--c-wash-5)",
} as const;

export const brandTokens = {
  ember: "var(--c-ember)",
  emberDeep: "var(--c-ember-deep)",
  bronze: "var(--c-bronze)",
  gold: "var(--c-gold)",
  goldDeep: "var(--c-gold-deep)",
  sage: "var(--c-sage)",
  sageDeep: "var(--c-sage-deep)",
  bone: "var(--c-bone)",
} as const;

/**
 * Linear "Midnight Command Center" reference palette. Use these
 * when you need a specific Linear hex by name — the semantic
 * `surfaceTokens` / `inkTokens` aliases above already point at
 * the same values and flip cleanly under `data-theme=light`.
 */
export const linearTokens = {
  pitchBlack: "var(--color-pitch-black)",
  graphite: "var(--color-graphite)",
  deepSlate: "var(--color-deep-slate)",
  charcoalGrey: "var(--color-charcoal-grey)",
  mutedAsh: "var(--color-muted-ash)",
  gunmetal: "var(--color-gunmetal)",
  porcelain: "var(--color-porcelain)",
  lightSteel: "var(--color-light-steel)",
  stormCloud: "var(--color-storm-cloud)",
  fogGrey: "var(--color-fog-grey)",
  alabaster: "var(--color-alabaster)",
  neonLime: "var(--color-neon-lime)",
  aetherBlue: "var(--color-aether-blue)",
  forestGreen: "var(--color-forest-green)",
  cyanSpark: "var(--color-cyan-spark)",
  emerald: "var(--color-emerald)",
  warningRed: "var(--color-warning-red)",
  deepViolet: "var(--color-deep-violet)",
  amethyst: "var(--color-amethyst)",
} as const;

/**
 * Stream / event palette. Each key encodes a *meaning* not a hue:
 * teal = support, amber = commerce, green = billing / ok,
 * orange = ops / alerts, pink = notify, violet = replay / sandbox,
 * red = failure / divergence, white = raw / system.
 */
export const eventTokens = {
  teal: "var(--c-event-teal)",
  amber: "var(--c-event-amber)",
  green: "var(--c-event-green)",
  orange: "var(--c-event-orange)",
  pink: "var(--c-event-pink)",
  violet: "var(--c-event-violet)",
  red: "var(--c-event-red)",
  white: "var(--c-event-white)",
} as const;

export const priorityTokens = {
  urgent: "var(--c-priority-urgent)",
  high: "var(--c-priority-high)",
  med: "var(--c-priority-med)",
  low: "var(--c-priority-low)",
  none: "var(--c-priority-none)",
} as const;

export const statusTokens = {
  backlog: "var(--c-status-backlog)",
  todo: "var(--c-status-todo)",
  inprogress: "var(--c-status-inprogress)",
  done: "var(--c-status-done)",
  canceled: "var(--c-status-canceled)",
} as const;

export const popoverTokens = {
  bg: "var(--c-pop-bg)",
  border: "var(--c-pop-border)",
  shadow: "var(--c-pop-shadow)",
  dotEdge: "var(--c-dot-edge)",
} as const;

export const gradientTokens = {
  lightsource: "var(--grad-lightsource)",
  lightsource90: "var(--grad-lightsource-90)",
  lightsource45: "var(--grad-lightsource-45)",
} as const;

export type SurfaceToken = keyof typeof surfaceTokens;
export type InkToken = keyof typeof inkTokens;
export type WashToken = keyof typeof washTokens;
export type BrandToken = keyof typeof brandTokens;
export type LinearToken = keyof typeof linearTokens;
export type EventToken = keyof typeof eventTokens;
export type PriorityToken = keyof typeof priorityTokens;
export type StatusToken = keyof typeof statusTokens;
export type PopoverToken = keyof typeof popoverTokens;
export type GradientToken = keyof typeof gradientTokens;
