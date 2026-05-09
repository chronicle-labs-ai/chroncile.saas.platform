/*
 * Bridge from `provider.subscribe(handler)` events into the
 * TanStack Query cache.
 *
 * Per-domain providers expose their own typed event shapes and
 * call this helper from a single place — the `<DataProviderProvider>`
 * mount effect — so consumers never set up subscriptions
 * themselves. Keeping the bridge generic means each domain just
 * supplies a `(event, queryClient) => void` reducer.
 */

import type { QueryClient } from "@tanstack/react-query";

import type { Subscription } from "../types";

/**
 * `target` returns a `Subscription` (from `MockStore.subscribe()`,
 * `EventSource`, etc.) and `reduce` decides which `setQueryData` /
 * `invalidateQueries` calls each event triggers.
 */
export interface BridgeOptions<TEvent> {
  subscribe: (handler: (event: TEvent) => void) => Subscription;
  reduce: (event: TEvent, queryClient: QueryClient) => void;
}

/**
 * Wire a provider's events into the cache. Returns a teardown
 * suitable for a `useEffect` cleanup.
 */
export function bridgeSubscription<TEvent>(
  queryClient: QueryClient,
  opts: BridgeOptions<TEvent>,
): () => void {
  const sub = opts.subscribe((event) => {
    try {
      opts.reduce(event, queryClient);
    } catch (err) {
      if (typeof console !== "undefined") {
        console.error("[subscribe-bridge] reducer threw", err);
      }
    }
  });
  return () => sub.unsubscribe();
}
