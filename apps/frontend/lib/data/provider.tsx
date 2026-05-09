/*
 * `<DataProviderProvider>` — the React context that ties everything
 * together. Consumers pull domain providers via
 * `useDataProvider().<domain>` (or via the per-domain hooks); the
 * underlying impls are resolved once per session from the env-driven
 * `DataConfig`.
 *
 * The same component also mounts:
 *
 *   - `<QueryClientProvider>` so every page below can use TanStack
 *     Query.
 *   - The subscription bridge for each domain so live events from
 *     mock mutations / SSE land in the query cache automatically.
 *   - `<ReactQueryDevtools />` outside production builds.
 */

"use client";

import * as React from "react";
import {
  QueryClientProvider,
  type QueryClient,
} from "@tanstack/react-query";

import { getDataConfig } from "./config";
import { getQueryClient } from "./query-client";
import { bridgeAgents, type AgentsProvider } from "./agents";
import { bridgeConnections, type ConnectionsProvider } from "./connections";
import { bridgeDatasets, type DatasetsProvider } from "./datasets";
import { bridgeTimeline, type TimelineProvider } from "./timeline";
import { createAgentsProvider } from "./agents/index";
import { createConnectionsProvider } from "./connections/index";
import { createDatasetsProvider } from "./datasets/index";
import { createTimelineProvider } from "./timeline/index";

const DevtoolsLazy = React.lazy(() =>
  import("@tanstack/react-query-devtools").then((mod) => ({
    default: mod.ReactQueryDevtools,
  })),
);

export interface DataProviderContextValue {
  agents: AgentsProvider;
  datasets: DatasetsProvider;
  connections: ConnectionsProvider;
  timeline: TimelineProvider;
}

const DataProviderContext = React.createContext<DataProviderContextValue | null>(
  null,
);

export interface DataProviderProviderProps {
  /** Optional QueryClient override. Tests pass a fresh per-test client;
   *  app code uses the session singleton. */
  queryClient?: QueryClient;
  /** Render React Query DevTools below the tree. Defaults to true in
   *  non-production builds. */
  devtools?: boolean;
  children: React.ReactNode;
}

export function DataProviderProvider({
  queryClient,
  devtools,
  children,
}: DataProviderProviderProps) {
  const [client] = React.useState(() => queryClient ?? getQueryClient());

  const value = React.useMemo<DataProviderContextValue>(() => {
    /* Re-read config on every mount so test harnesses that call
       `__resetDataConfigCache()` get a fresh impl. In real app code
       the config is module-level cached so this is a single read. */
    void getDataConfig();
    return {
      agents: createAgentsProvider(),
      datasets: createDatasetsProvider(),
      connections: createConnectionsProvider(),
      timeline: createTimelineProvider(),
    };
  }, []);

  React.useEffect(() => {
    const tearAgents = bridgeAgents(client, value.agents);
    const tearDatasets = bridgeDatasets(client, value.datasets);
    const tearConnections = bridgeConnections(client, value.connections);
    const tearTimeline = bridgeTimeline(client, value.timeline);
    return () => {
      tearAgents();
      tearDatasets();
      tearConnections();
      tearTimeline();
    };
  }, [client, value]);

  const showDevtools =
    devtools ?? process.env.NODE_ENV !== "production";

  return (
    <QueryClientProvider client={client}>
      <DataProviderContext.Provider value={value}>
        {children}
        {showDevtools ? (
          <React.Suspense fallback={null}>
            <DevtoolsLazy
              initialIsOpen={false}
              buttonPosition="bottom-right"
            />
          </React.Suspense>
        ) : null}
      </DataProviderContext.Provider>
    </QueryClientProvider>
  );
}

export function useDataProvider(): DataProviderContextValue {
  const ctx = React.useContext(DataProviderContext);
  if (!ctx) {
    throw new Error(
      "[lib/data] useDataProvider must be called inside <DataProviderProvider>",
    );
  }
  return ctx;
}
