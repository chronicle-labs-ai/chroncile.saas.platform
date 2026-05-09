/*
 * Connections domain entrypoint. Mirror of agents/datasets.
 */

import type { QueryClient } from "@tanstack/react-query";
import type { Connection } from "chronicle/types/connections";

import { getDataConfig } from "../config";
import { qk } from "../query-keys";
import { bridgeSubscription } from "../shared/subscribe-bridge";

import { mockConnectionsProvider } from "./mock";
import { appConnectionsProvider } from "./app";
import { chronicleConnectionsProvider } from "./chronicle";
import type {
  ConnectionsEvent,
  ConnectionsProvider,
  ResettableConnectionsProvider,
} from "./types";

export type {
  ConnectionsEvent,
  ConnectionsProvider,
  ResettableConnectionsProvider,
};

export function createConnectionsProvider(): ConnectionsProvider {
  switch (getDataConfig().connections) {
    case "chronicle":
      return chronicleConnectionsProvider;
    case "app":
      return appConnectionsProvider;
    case "mock":
    default:
      return mockConnectionsProvider;
  }
}

export function bridgeConnections(
  client: QueryClient,
  provider: ConnectionsProvider,
): () => void {
  return bridgeSubscription<ConnectionsEvent>(client, {
    subscribe: (handler) => provider.subscribe(handler),
    reduce: (event, qc) => {
      if (event.kind === "list-changed") {
        qc.setQueryData(qk.connections.list(), event.connections);
      } else if (event.kind === "row-patched") {
        qc.setQueryData(
          qk.connections.list(),
          (old?: readonly Connection[]) => {
            if (!old) return old;
            return old.map((c) =>
              c.id === event.patch.id ? { ...c, ...event.patch } : c,
            ) as readonly Connection[];
          },
        );
      }
    },
  });
}

export {
  useConnections,
  useConnectionBackfills,
  useConnectionDeliveries,
  useConnectionEventSubs,
  usePauseConnection,
  useResumeConnection,
  useTestConnection,
  useReauthConnection,
  useRotateConnectionSecret,
  useRunConnectionBackfill,
  useDisconnectConnection,
  usePauseConnectionAction,
  useResumeConnectionAction,
  useTestConnectionAction,
  useReauthConnectionAction,
  useRotateConnectionSecretAction,
  useRunConnectionBackfillAction,
  useDisconnectConnectionAction,
} from "./hooks";
