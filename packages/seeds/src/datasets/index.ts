/*
 * Datasets seed registry. Calling `resolveDatasetsSeed(id)` returns
 * the matching `Seed` (or the `default` seed with a console warning
 * on miss); `seed.build()` produces a fresh, mutable `DatasetsSeedData`.
 */

import { resolveSeed, type Seed } from "../types";

import { chronicleDemoDatasetsSeed } from "./chronicle-demo";
import { defaultDatasetsSeed } from "./default";
import { emptyDatasetsSeed } from "./empty";
import { powerUserDatasetsSeed } from "./power-user";
import { supportFlowDatasetsSeed } from "./support-flow";
import type { DatasetsSeed, DatasetsSeedData } from "./types";

export type { DatasetsSeed, DatasetsSeedData };
export {
  chronicleDemoDatasetsSeed,
  defaultDatasetsSeed,
  emptyDatasetsSeed,
  powerUserDatasetsSeed,
  supportFlowDatasetsSeed,
};

export const DATASETS_SEEDS: readonly DatasetsSeed[] = [
  defaultDatasetsSeed,
  emptyDatasetsSeed,
  powerUserDatasetsSeed,
  supportFlowDatasetsSeed,
  chronicleDemoDatasetsSeed,
];

export function resolveDatasetsSeed(id: string | undefined): DatasetsSeed {
  return resolveSeed<DatasetsSeedData>(
    DATASETS_SEEDS as readonly Seed<DatasetsSeedData>[],
    id,
    "datasets",
  );
}
