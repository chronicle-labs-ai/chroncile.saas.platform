/*
 * Agents domain entrypoint. Picks the concrete impl from
 * `dataConfig.agents` and exposes the subscribe bridge wiring used
 * by `<DataProviderProvider>`.
 *
 * Each impl module lives next to this file (`mock.ts`, `app.ts`,
 * `chronicle.ts`); hook helpers in `hooks.ts`.
 */

import type { QueryClient } from "@tanstack/react-query";

import { getDataConfig } from "../config";
import { qk } from "../query-keys";
import { bridgeSubscription } from "../shared/subscribe-bridge";

import { mockAgentsProvider } from "./mock";
import { appAgentsProvider } from "./app";
import { chronicleAgentsProvider } from "./chronicle";
import type {
  AgentsEvent,
  AgentsProvider,
  ResettableAgentsProvider,
} from "./types";

export type { AgentsEvent, AgentsProvider, ResettableAgentsProvider };

export function createAgentsProvider(): AgentsProvider {
  switch (getDataConfig().agents) {
    case "chronicle":
      return chronicleAgentsProvider;
    case "app":
      return appAgentsProvider;
    case "mock":
    default:
      return mockAgentsProvider;
  }
}

export function bridgeAgents(
  client: QueryClient,
  provider: AgentsProvider,
): () => void {
  return bridgeSubscription<AgentsEvent>(client, {
    subscribe: (handler) => provider.subscribe(handler),
    reduce: (event, qc) => {
      if (event.kind === "list-changed") {
        qc.setQueryData(qk.agents.list(), event.agents);
      } else if (event.kind === "snapshot-changed") {
        qc.setQueryData(qk.agents.snapshot(event.name), event.snapshot);
        qc.invalidateQueries({ queryKey: qk.agents.list() });
      }
    },
  });
}

export {
  useAgents,
  useAgentSnapshot,
  useHashIndex,
  usePinLatestAgent,
  usePinLatestAgentAction,
} from "./hooks";
