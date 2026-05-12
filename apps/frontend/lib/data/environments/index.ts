/*
 * Environments domain entrypoint. Picks the concrete impl from
 * `dataConfig.environments` and exposes the subscribe bridge wiring
 * used by `<DataProviderProvider>`.
 */

import type { QueryClient } from "@tanstack/react-query";

import { getDataConfig } from "../config";
import { qk } from "../query-keys";
import { bridgeSubscription } from "../shared/subscribe-bridge";

import { appEnvironmentsProvider } from "./app";
import { chronicleEnvironmentsProvider } from "./chronicle";
import { mockEnvironmentsProvider } from "./mock";
import type {
  EnvironmentsEvent,
  EnvironmentsProvider,
  ResettableEnvironmentsProvider,
} from "./types";

export type {
  EnvironmentsEvent,
  EnvironmentsProvider,
  ResettableEnvironmentsProvider,
};

export function createEnvironmentsProvider(): EnvironmentsProvider {
  switch (getDataConfig().environments) {
    case "chronicle":
      return chronicleEnvironmentsProvider;
    case "app":
      return appEnvironmentsProvider;
    case "mock":
    default:
      return mockEnvironmentsProvider;
  }
}

export function bridgeEnvironments(
  client: QueryClient,
  provider: EnvironmentsProvider,
): () => void {
  return bridgeSubscription<EnvironmentsEvent>(client, {
    subscribe: (handler) => provider.subscribe(handler),
    reduce: (event, qc) => {
      if (event.kind === "list-changed") {
        qc.setQueryData(qk.environments.list(), event.environments);
      }
    },
  });
}

export { useEnvironments } from "./hooks";
