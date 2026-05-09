/*
 * Default datasets seed — wraps the canonical fixtures already used
 * by the design-system Storybook (`datasetsManagerSeed` + the four
 * shipped snapshots). Phase A keeps the bodies in `packages/ui`; we
 * just structuredClone here so mutations in the mock provider never
 * leak back into shared state.
 *
 * `build()` validates every dataset and snapshot against the
 * generated Zod schemas in dev mode so a UI fixture that drifts from
 * the canonical Rust shape fails at first use, not silently in
 * production.
 */

import { DatasetSchema, DatasetSnapshotSchema } from "chronicle/schemas";
import type { Dataset, DatasetSnapshot } from "chronicle/types";
import {
  DATASETS_MOCK_ANCHOR_MS,
  datasetsManagerSeed,
  datasetSnapshotsById,
} from "ui";
import { z } from "zod";

import { validateInDev } from "../_validate";
import { rebaseTimestamps } from "../util";
import type { DatasetsSeed, DatasetsSeedData } from "./types";

const DatasetListSchema = z.array(DatasetSchema);
const DatasetSnapshotMapSchema = z.record(DatasetSnapshotSchema);

export const defaultDatasetsSeed: DatasetsSeed = {
  id: "default",
  label: "Realistic workspace",
  description: "5 datasets with traces + clusters · matches Storybook",
  build(): DatasetsSeedData {
    const datasets = structuredClone(datasetsManagerSeed) as Dataset[];
    const snapshotsById = structuredClone(
      datasetSnapshotsById,
    ) as Record<string, DatasetSnapshot>;

    validateInDev(DatasetListSchema, datasets, "datasets:default datasets[]");
    validateInDev(
      DatasetSnapshotMapSchema,
      snapshotsById,
      "datasets:default snapshotsById",
    );

    const data: DatasetsSeedData = { datasets, snapshotsById };
    return rebaseTimestamps(data, { sourceAnchorMs: DATASETS_MOCK_ANCHOR_MS });
  },
};
