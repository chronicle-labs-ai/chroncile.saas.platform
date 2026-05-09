/*
 * Anchor-time rebase.
 *
 * Most fixtures in `packages/ui/src/**\/data.ts` were generated
 * relative to a fixed wall-clock anchor (e.g. `STREAM_TIMELINE_MOCK_ANCHOR_MS`)
 * so VRT snapshots stay stable. That's great for stories and
 * regression tests — but in the `mock` impl of the data provider
 * a developer hitting the dashboard expects "Updated 12 minutes
 * ago", not "Updated 14 months ago".
 *
 * `rebaseTimestamps` walks an arbitrary object graph and shifts
 * every ISO-8601 timestamp it finds by the same delta so chronological
 * ordering is preserved. The default anchor is "now"; pass an
 * explicit `targetAnchor` to make the seed feel like it was
 * captured at a specific past moment (useful for the
 * `regression-incident` scenario referenced in the plan).
 */

const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;

export interface RebaseOptions {
  /** Anchor that timestamps in `data` are currently aligned to. */
  sourceAnchorMs: number;
  /** Anchor we want them to align to. Defaults to `Date.now()`. */
  targetAnchorMs?: number;
}

export function rebaseTimestamps<T>(data: T, opts: RebaseOptions): T {
  const target = opts.targetAnchorMs ?? Date.now();
  const delta = target - opts.sourceAnchorMs;
  if (delta === 0) return data;
  return walk(data, delta) as T;
}

function walk(value: unknown, delta: number): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (ISO_DATE_RE.test(value)) {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) return new Date(parsed + delta).toISOString();
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => walk(v, delta));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = walk(v, delta);
    }
    return out;
  }
  return value;
}
