/*
 * Datasets provider interface + event shape.
 *
 * Mirrors `AgentsProvider` in shape: read methods, mutation methods,
 * and a single `subscribe()` for live updates. Payloads borrow the
 * existing CRUD shapes from `ui/datasets` so the manager components
 * accept handler results unchanged.
 */

import type {
  CreateDatasetPayload,
  Dataset,
  DatasetEvalRun,
  DatasetSavedView,
  DatasetSnapshot,
  UpdateDatasetPayload,
  UpdateTracesPayload,
} from "ui";

import type { Subscription } from "../types";

export type DatasetsEvent =
  | { kind: "list-changed"; datasets: readonly Dataset[] }
  | {
      kind: "snapshot-changed";
      datasetId: string;
      snapshot: DatasetSnapshot;
    };

export interface DatasetsProvider {
  list(): Promise<readonly Dataset[]>;
  getSnapshot(id: string): Promise<DatasetSnapshot | null>;
  /** Bulk read used by the manager so a list page doesn't N+1
   *  individual snapshot calls. Mock impl returns the entire seed
   *  index; live impls page when the dataset count grows. */
  listSnapshots(): Promise<Readonly<Record<string, DatasetSnapshot>>>;

  create(payload: CreateDatasetPayload): Promise<Dataset>;
  update(payload: UpdateDatasetPayload): Promise<Dataset>;
  remove(id: string, opts?: { cascade?: boolean }): Promise<void>;

  updateTraces(payload: UpdateTracesPayload): Promise<DatasetSnapshot>;

  listSavedViews(datasetId: string): Promise<readonly DatasetSavedView[]>;
  listEvalRuns(datasetId: string): Promise<readonly DatasetEvalRun[]>;

  subscribe(handler: (event: DatasetsEvent) => void): Subscription;
}

export interface ResettableDatasetsProvider extends DatasetsProvider {
  /** Mock-only: swap to a different scenario seed without re-mount. */
  reset?: (seedId?: string) => void;
}
