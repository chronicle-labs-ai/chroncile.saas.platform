/*
 * Datasets seed shape.
 *
 * Mirrors `AgentsSeedData` — list view + per-id snapshot index.
 * Storybook stories already render against this exact structure
 * (see `DatasetsManagerProps.datasets` + `snapshotsById`), so the
 * `mock` provider's `MockStore` is a thin wrapper around two
 * `Map`s populated from the seed.
 */

import type { Dataset, DatasetSnapshot } from "ui";

import type { Seed } from "../types";

export interface DatasetsSeedData {
  datasets: readonly Dataset[];
  snapshotsById: Readonly<Record<string, DatasetSnapshot>>;
}

export type DatasetsSeed = Seed<DatasetsSeedData>;
