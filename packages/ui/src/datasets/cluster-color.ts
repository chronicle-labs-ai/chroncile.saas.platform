/*
 * Cluster color mapping — deterministic `clusterId` → `--c-event-*`
 * token. We deliberately reuse the brand event palette here even
 * though the dataset viewer renders under product chrome:
 * `chrome.css` leaves the `--c-event-*` block alone on purpose so
 * brand accents stay consistent across modes.
 *
 * `cluster-color.ts` is also imported by the graph view, the cluster
 * card legend, and (eventually) the cluster column in the Traces
 * table — which is why the helpers return both the solid stroke
 * color and a translucent fill.
 */

/** Pool of cluster colors, ordered to keep neighbours visually
 *  distinct (no two adjacent clusters land on the same hue family). */
export const CLUSTER_COLOR_TOKENS: readonly string[] = [
  "var(--c-event-teal)",
  "var(--c-event-amber)",
  "var(--c-event-violet)",
  "var(--c-event-pink)",
  "var(--c-event-green)",
  "var(--c-event-orange)",
  "var(--c-event-red)",
  "var(--c-event-white)",
];

/** Hex fallback for the same tokens, kept in lock-step with
 *  `tokens.css` lines 47–54. Used by the SVG graph layer where
 *  `var()` colors render fine but rgba() compositing needs the raw
 *  value to compute translucency. */
const CLUSTER_HEX_FALLBACKS: readonly string[] = [
  "#2dd4bf", // teal
  "#fbbf24", // amber
  "#8b5cf6", // violet
  "#f472b6", // pink
  "#4ade80", // green
  "#d86b3d", // orange
  "#ef4444", // red
  "#ffffff", // white
];

/** Stable 32-bit hash (FNV-1a). Same input → same color across reloads. */
function hashStr(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Returns the CSS variable color for a cluster id, e.g.
 *  `"var(--c-event-violet)"`. */
export function clusterColor(clusterId: string): string {
  const idx = hashStr(clusterId) % CLUSTER_COLOR_TOKENS.length;
  return CLUSTER_COLOR_TOKENS[idx]!;
}

/** Returns the raw hex fallback for a cluster id. Use this in SVG
 *  paths that need to compose alpha (e.g. translucent fills). */
export function clusterColorHex(clusterId: string): string {
  const idx = hashStr(clusterId) % CLUSTER_HEX_FALLBACKS.length;
  return CLUSTER_HEX_FALLBACKS[idx]!;
}

/** Cluster color × given alpha in [0..1], returned as an `rgba()`
 *  string suitable for SVG `fill` / `stroke`. */
export function clusterColorAlpha(clusterId: string, alpha: number): string {
  const hex = clusterColorHex(clusterId);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

/** Resolves a fill suitable for cluster-bubble backgrounds. */
export function clusterFill(clusterId: string): string {
  return clusterColorAlpha(clusterId, 0.12);
}

/** Resolves a stroke suitable for cluster-bubble outlines. */
export function clusterStroke(clusterId: string): string {
  return clusterColorAlpha(clusterId, 0.4);
}
