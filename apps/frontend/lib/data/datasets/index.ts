/*
 * Datasets domain entrypoint. Mirror of `agents/index.ts`.
 */

import type { QueryClient } from "@tanstack/react-query";
import type { DatasetSnapshot } from "ui";

import { getDataConfig } from "../config";
import { qk } from "../query-keys";
import { bridgeSubscription } from "../shared/subscribe-bridge";

import { mockDatasetsProvider } from "./mock";
import { appDatasetsProvider } from "./app";
import { chronicleDatasetsProvider } from "./chronicle";
import type {
  DatasetsEvent,
  DatasetsProvider,
  ResettableDatasetsProvider,
} from "./types";

export type { DatasetsEvent, DatasetsProvider, ResettableDatasetsProvider };

export function createDatasetsProvider(): DatasetsProvider {
  switch (getDataConfig().datasets) {
    case "chronicle":
      return chronicleDatasetsProvider;
    case "app":
      return appDatasetsProvider;
    case "mock":
    default:
      return mockDatasetsProvider;
  }
}

export function bridgeDatasets(
  client: QueryClient,
  provider: DatasetsProvider,
): () => void {
  return bridgeSubscription<DatasetsEvent>(client, {
    subscribe: (handler) => provider.subscribe(handler),
    reduce: (event, qc) => {
      if (event.kind === "list-changed") {
        qc.setQueryData(qk.datasets.list(), event.datasets);
      } else if (event.kind === "snapshot-changed") {
        qc.setQueryData(
          qk.datasets.snapshot(event.datasetId),
          event.snapshot,
        );
        /* Snapshot index uses a single key — patch in place so other
           consumers reading the bulk index see the change without a
           refetch. */
        qc.setQueryData(
          qk.datasets.snapshotIndex(),
          (old?: Readonly<Record<string, DatasetSnapshot>>) => ({
            ...(old ?? {}),
            [event.datasetId]: event.snapshot,
          }),
        );
      }
    },
  });
}

export {
  useDatasets,
  useDatasetSnapshot,
  useDatasetSnapshotIndex,
  useCreateDataset,
  useUpdateDataset,
  useDeleteDataset,
  useUpdateTraces,
  useCreateDatasetAction,
  useUpdateDatasetAction,
  useDeleteDatasetAction,
  useUpdateTracesAction,
} from "./hooks";
