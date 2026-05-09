/*
 * Power-user datasets seed — stress-tests the manager's filters,
 * group-by, and virtualization. We tile the default fixtures 40x to
 * land at ~200 datasets without authoring fresh shapes; ids are
 * suffixed `_n` and names get a numeric tag so groupings still
 * read.
 *
 * Snapshots are NOT cloned per tile — the dataset detail page just
 * falls back to the shared snapshot for the originating id. Plenty
 * of fidelity for stress testing the list view; revisit when a
 * scenario actually wants per-tile traces.
 */

import {
  DATASETS_MOCK_ANCHOR_MS,
  datasetsManagerSeed,
  datasetSnapshotsById,
  type Dataset,
} from "ui";

import { rebaseTimestamps } from "../util";
import type { DatasetsSeed, DatasetsSeedData } from "./types";

const TILE_COUNT = 40;

export const powerUserDatasetsSeed: DatasetsSeed = {
  id: "power-user",
  label: "Power user",
  description: `${
    datasetsManagerSeed.length * TILE_COUNT
  } datasets · stress-tests filters, group-by, virtualization`,
  build(): DatasetsSeedData {
    const base = structuredClone(datasetsManagerSeed) as Dataset[];
    const expanded: Dataset[] = [];
    for (let tile = 0; tile < TILE_COUNT; tile += 1) {
      for (const d of base) {
        expanded.push({
          ...d,
          id: tile === 0 ? d.id : `${d.id}_${tile}`,
          name: tile === 0 ? d.name : `${d.name} ${tile}`,
        });
      }
    }
    const data: DatasetsSeedData = {
      datasets: expanded,
      snapshotsById: structuredClone(
        datasetSnapshotsById,
      ) as DatasetsSeedData["snapshotsById"],
    };
    return rebaseTimestamps(data, { sourceAnchorMs: DATASETS_MOCK_ANCHOR_MS });
  },
};
