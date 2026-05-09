/*
 * Shared types for the client-side data middleware.
 *
 * Per-domain provider interfaces (`AgentsProvider`, `DatasetsProvider`)
 * live alongside their impls under `agents/` and `datasets/`. This
 * file holds the cross-domain primitives.
 */

/**
 * Where each domain's data comes from at runtime.
 *
 * - `mock`      — in-browser `MockStore` seeded from `packages/seeds`.
 * - `app`       — the host app's own Next.js routes under `/api/*`
 *                 (WorkOS-tied work, sandbox orchestration, etc.).
 * - `chronicle` — direct browser → `chronicle-backend` (Rust) calls.
 */
export type DataMode = "mock" | "app" | "chronicle";

export const DATA_MODES: readonly DataMode[] = ["mock", "app", "chronicle"];

export function isDataMode(value: unknown): value is DataMode {
  return (
    typeof value === "string" &&
    (DATA_MODES as readonly string[]).includes(value)
  );
}

/**
 * Subscription handle returned by every `provider.subscribe(...)`.
 * `unsubscribe` is idempotent — calling it more than once is a
 * no-op. The bridge always invokes it on unmount.
 */
export interface Subscription {
  unsubscribe(): void;
}

/**
 * Provider error surface. Impls throw these instead of native
 * `Error` so consumers can branch on `status` (e.g. 401 → token
 * refresh, 404 → render empty state).
 */
export class ProviderError extends Error {
  readonly status: number;
  readonly cause?: unknown;
  constructor(status: number, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.cause = options?.cause;
  }
}
