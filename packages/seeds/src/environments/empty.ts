/*
 * Empty environments seed — for first-run / empty-state QA. The
 * manager should render its empty list view cleanly.
 */

import type { EnvironmentsSeed, EnvironmentsSeedData } from "./types";

export const emptyEnvironmentsSeed: EnvironmentsSeed = {
  id: "empty",
  label: "Brand new tenant",
  description: "Zero environments · for first-run / empty-state QA",
  build(): EnvironmentsSeedData {
    return {
      environments: [],
    };
  },
};
