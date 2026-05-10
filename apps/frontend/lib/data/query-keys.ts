/*
 * Typed query-key factory.
 *
 * Every cache read / write goes through `qk.<domain>.<entity>(args)`
 * so refactors stay typo-safe and invalidations target the right
 * tree (`queryClient.invalidateQueries({ queryKey: qk.agents.all })`).
 *
 * Keep keys flat — TanStack matches by prefix, so
 * `qk.agents.all = ["agents"]` cleanly invalidates every key that
 * starts with `["agents", ...]`.
 */

export const qk = {
  agents: {
    all: ["agents"] as const,
    list: () => ["agents", "list"] as const,
    snapshot: (name: string) => ["agents", "snapshot", name] as const,
    hashIndex: (query: string, domains: readonly string[] = []) =>
      ["agents", "hash-index", query, [...domains].sort().join(",")] as const,
  },
  datasets: {
    all: ["datasets"] as const,
    list: () => ["datasets", "list"] as const,
    snapshot: (id: string) => ["datasets", "snapshot", id] as const,
    snapshotIndex: () => ["datasets", "snapshot-index"] as const,
    savedViews: (datasetId: string) =>
      ["datasets", "saved-views", datasetId] as const,
    evalRuns: (datasetId: string) =>
      ["datasets", "eval-runs", datasetId] as const,
  },
  connections: {
    all: ["connections"] as const,
    list: () => ["connections", "list"] as const,
    backfills: () => ["connections", "backfills"] as const,
    deliveries: () => ["connections", "deliveries"] as const,
    eventSubs: () => ["connections", "event-subs"] as const,
  },
  timeline: {
    all: ["timeline"] as const,
    /* Prefix for every cached window. The bridge uses this as a
       narrow filter for `setQueriesData` so dataset / heartbeat
       caches under `qk.timeline.*` aren't treated as event arrays. */
    windowsAll: ["timeline", "window"] as const,
    /* The window key includes the bounds + limit so two pages can
       cache concurrently (e.g. dashboard "live" + a pinned detail
       view). The bridge fans appended events into every cached
       window so they all stay in sync. */
    window: (
      from?: string,
      to?: string,
      limit?: number,
    ) =>
      [
        "timeline",
        "window",
        from ?? null,
        to ?? null,
        limit ?? null,
      ] as const,
    datasets: () => ["timeline", "datasets"] as const,
  },
  backtests: {
    all: ["backtests"] as const,
    list: () => ["backtests", "list"] as const,
    availability: () => ["backtests", "availability"] as const,
    scene: () => ["backtests", "scene"] as const,
  },
  environments: {
    all: ["environments"] as const,
    list: () => ["environments", "list"] as const,
  },
} as const;
