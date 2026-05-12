/*
 * Empty datasets seed — exercises the manager's `DatasetEmpty` view
 * and the create-from-empty flow.
 */

import type { DatasetsSeed, DatasetsSeedData } from "./types";

export const emptyDatasetsSeed: DatasetsSeed = {
  id: "empty",
  label: "Brand new tenant",
  description: "Zero datasets · for first-run / empty-state QA",
  build(): DatasetsSeedData {
    return {
      datasets: [],
      snapshotsById: {},
    };
  },
};
