/*
 * Empty backtests seed — for first-run / empty-state QA. The manager
 * should render its empty list view, and Configure should fall back
 * to internal mock catalogs when every picker is empty.
 */

import type { BacktestsSeed, BacktestsSeedData } from "./types";

export const emptyBacktestsSeed: BacktestsSeed = {
  id: "empty",
  label: "Brand new tenant",
  description: "Zero runs, empty pickers · for first-run / empty-state QA",
  build(): BacktestsSeedData {
    return {
      runs: [],
      availableDatasets: [],
      availableDatasetSnapshots: {},
      availableEnvironments: [],
      availableAgents: [],
    };
  },
};
