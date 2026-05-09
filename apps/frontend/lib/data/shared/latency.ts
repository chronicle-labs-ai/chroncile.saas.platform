/*
 * Optional latency injection for the `mock` provider.
 *
 * When `NEXT_PUBLIC_DATA_MOCK_LATENCY_MS` is set, every mock
 * read/write awaits a small randomised delay so loading skeletons,
 * pending buttons, and Suspense boundaries actually exercise. With
 * `0` (the default) it's a no-op.
 */

import { getDataConfig } from "../config";

/** Sleep for `[base*0.5 .. base*1.5]` ms. Returns immediately when
 *  base is 0 or negative. */
export function sleep(baseMs?: number): Promise<void> {
  const base = baseMs ?? getDataConfig().mockLatencyMs;
  if (!base || base <= 0) return Promise.resolve();
  const jitter = base * (0.5 + Math.random());
  return new Promise((resolve) => setTimeout(resolve, jitter));
}
