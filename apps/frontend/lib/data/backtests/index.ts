/*
 * Backtests domain entrypoint. Picks the concrete impl from
 * `dataConfig.backtests` and exposes the subscribe bridge wiring
 * used by `<DataProviderProvider>`.
 */

import type { QueryClient } from "@tanstack/react-query";

import { getDataConfig } from "../config";
import { qk } from "../query-keys";
import { bridgeSubscription } from "../shared/subscribe-bridge";

import { appBacktestsProvider } from "./app";
import { chronicleBacktestsProvider } from "./chronicle";
import { mockBacktestsProvider } from "./mock";
import type {
  BacktestsAvailability,
  BacktestsEvent,
  BacktestsProvider,
  BacktestsScene,
  ResettableBacktestsProvider,
} from "./types";

export type {
  BacktestsAvailability,
  BacktestsEvent,
  BacktestsProvider,
  BacktestsScene,
  ResettableBacktestsProvider,
};

export function createBacktestsProvider(): BacktestsProvider {
  switch (getDataConfig().backtests) {
    case "chronicle":
      return chronicleBacktestsProvider;
    case "app":
      return appBacktestsProvider;
    case "mock":
    default:
      return mockBacktestsProvider;
  }
}

export function bridgeBacktests(
  client: QueryClient,
  provider: BacktestsProvider,
): () => void {
  return bridgeSubscription<BacktestsEvent>(client, {
    subscribe: (handler) => provider.subscribe(handler),
    reduce: (event, qc) => {
      if (event.kind === "runs-changed") {
        qc.setQueryData(qk.backtests.list(), event.runs);
      }
    },
  });
}

export {
  useBacktestsAvailability,
  useBacktestsRuns,
  useBacktestsScene,
} from "./hooks";
