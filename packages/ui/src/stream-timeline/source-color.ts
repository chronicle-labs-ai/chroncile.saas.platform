/*
 * Stream Timeline — source / topic color resolution.
 *
 * Maps an event source name (e.g. `intercom`, `stripe`) to one of the
 * Chronicle `--c-event-*` palette tokens, with a deterministic HSL
 * hash fallback for unknown sources coming from the API at runtime.
 *
 * Returns CSS var strings (e.g. `var(--c-event-teal)`) so the value
 * works as a `color`, `background`, or `border-color` and stays in
 * sync with the active `data-theme`.
 */

const KNOWN_SOURCE_TOKEN: Record<string, string> = {
  intercom: "var(--c-event-teal)",
  zendesk: "var(--c-sage-deep)",
  stripe: "var(--c-event-green)",
  "mock-stripe": "var(--c-event-green)",
  shopify: "var(--c-event-amber)",
  slack: "var(--c-event-pink)",
  hubspot: "var(--c-event-orange)",
  github: "var(--c-event-violet)",
  salesforce: "var(--c-sage)",
  segment: "var(--c-event-teal)",
  postgres: "var(--c-event-teal)",
  kafka: "var(--c-event-teal)",
  gmail: "var(--c-event-red)",
  linear: "var(--c-event-violet)",
  notion: "var(--c-ink-hi)",
  replay: "var(--c-event-violet)",
  sandbox: "var(--c-event-violet)",
  "live-api": "var(--c-event-teal)",
};

/**
 * Color for a top-level source. Returns a CSS variable when the source
 * is in the curated palette; otherwise computes a stable HSL color
 * from the source name so unknown sources still get a consistent hue.
 */
export function sourceColor(source: string): string {
  const key = source.toLowerCase();
  const known = KNOWN_SOURCE_TOKEN[key];
  if (known) return known;

  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash + key.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}deg 60% 55%)`;
}

/**
 * Color for a sub-path under a source. Slightly varies the base hue
 * so siblings under the same source remain visually grouped but
 * distinguishable.
 */
export function pathColor(pathDisplay: string, baseColor: string): string {
  if (baseColor.startsWith("var(")) return baseColor;
  if (baseColor.startsWith("hsl(")) {
    let hash = 0;
    for (let i = 0; i < pathDisplay.length; i++) {
      hash = (hash + pathDisplay.charCodeAt(i)) >>> 0;
    }
    const lightnessShift = ((hash % 20) - 10) / 100;
    const match = baseColor.match(
      /^hsl\((\d+(?:\.\d+)?)deg\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\)$/,
    );
    if (!match) return baseColor;
    const [, h, s, l] = match;
    const lightness = Math.min(0.85, Math.max(0.25, Number(l) / 100 + lightnessShift));
    return `hsl(${h}deg ${s}% ${(lightness * 100).toFixed(1)}%)`;
  }
  return baseColor;
}

/**
 * Tinted background suitable for a row badge or logo fallback. Mixes
 * the source color with the surface so the tint stays subtle on the
 * dark canvas. Uses CSS `color-mix` which is supported across modern
 * browsers; degrades to the source color at low opacity if not.
 */
export function sourceTintedBackground(color: string, percent = 16): string {
  return `color-mix(in srgb, ${color} ${percent}%, var(--c-surface-02))`;
}
