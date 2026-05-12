/*
 * Single TanStack QueryClient factory.
 *
 * Defaults reflect the realities of this app:
 *
 *   - `staleTime: 30s` — most dashboard reads are not real-time,
 *     and we'd rather avoid a refetch storm when the user
 *     navigates between sibling pages.
 *   - `gcTime: 5min` — keep cached pages warm so back/forward
 *     feels instant.
 *   - `refetchOnWindowFocus: true` — when a tab returns from
 *     background, give it the freshest data.
 *   - `retry: 1` — one retry for transient flakes (e.g. browser
 *     waking from sleep), but don't hammer a real outage.
 *   - `refetchOnReconnect: true` — picking up after network
 *     blips matters for SSE-driven surfaces.
 *
 * The factory is exported so tests can spin up an isolated client
 * per test; production code reads `getQueryClient()` for the
 * shared singleton.
 */

import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let singleton: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (singleton) return singleton;
  singleton = makeQueryClient();
  return singleton;
}
