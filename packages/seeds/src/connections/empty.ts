/*
 * Empty connections seed — exercises the manager's `ConnectionEmpty`
 * view and the add-connection-picker entry path.
 */

import type { ConnectionsSeed, ConnectionsSeedData } from "./types";

export const emptyConnectionsSeed: ConnectionsSeed = {
  id: "empty",
  label: "Brand new tenant",
  description: "Zero connections · for first-run / empty-state QA",
  build(): ConnectionsSeedData {
    return {
      connections: [],
      backfillsByConnection: {},
      deliveriesByConnection: {},
      eventSubsByConnection: {},
    };
  },
};
