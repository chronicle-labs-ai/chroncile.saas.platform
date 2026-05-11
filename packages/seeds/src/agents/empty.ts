/*
 * Empty agents seed — for first-run / empty-state QA. The manager
 * should render its `AgentEmpty` component cleanly and the hash
 * index should show "No hashes registered yet".
 */

import type { AgentsSeed, AgentsSeedData } from "./types";

export const emptyAgentsSeed: AgentsSeed = {
  id: "empty",
  label: "Brand new tenant",
  description: "Zero agents · for first-run / empty-state QA",
  build(): AgentsSeedData {
    return {
      summaries: [],
      snapshotsByName: {},
      hashIndex: [],
    };
  },
};
