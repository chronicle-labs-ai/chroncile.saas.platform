export const easings = {
  out: "var(--ease-out)",
  inOut: "var(--ease-in-out)",
} as const;

export const durations = {
  fast: "var(--dur-fast)",
  base: "var(--dur)",
  slow: "var(--dur-slow)",
} as const;

export type Easing = keyof typeof easings;
export type Duration = keyof typeof durations;
