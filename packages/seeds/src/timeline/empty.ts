/*
 * Empty timeline seed — exercises the viewer's `Empty` story
 * surface and the "no events yet" copy.
 */

import type { TimelineSeed, TimelineSeedData } from "./types";

export const emptyTimelineSeed: TimelineSeed = {
  id: "empty",
  label: "Brand new tenant",
  description: "Zero events · for first-run / empty-state QA",
  build(): TimelineSeedData {
    return { events: [], datasets: [] };
  },
};
