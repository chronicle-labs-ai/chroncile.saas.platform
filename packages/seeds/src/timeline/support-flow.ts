/*
 * Support-flow timeline seed.
 *
 * Re-uses the same event corpus the agents + datasets seeds emit
 * (see `_scenarios/support-flow.ts`), plus a sprinkling of
 * background webhook events so the viewer doesn't render long
 * empty gaps between conversations. Datasets come from the
 * matching `datasets/support-flow` seed so the dataset picker on
 * the detail sidebar shows the same three datasets that surface
 * the same trace ids.
 */

import { DatasetSchema, StreamTimelineEventSchema } from "chronicle/schemas/datasets";
import type { Dataset, StreamTimelineEvent } from "chronicle/types/datasets";
import { z } from "zod";

import { validateInDev } from "../_validate";
import { materializeTimelineEvents } from "../_scenarios/support-flow";
import { supportFlowDatasetsSeed } from "../datasets/support-flow";
import type { TimelineSeed, TimelineSeedData } from "./types";

const EventListSchema = z.array(StreamTimelineEventSchema);
const DatasetListSchema = z.array(DatasetSchema);

export const supportFlowTimelineSeed: TimelineSeed = {
  id: "support-flow",
  label: "Support flow",
  description:
    "Trace events from the seven support conversations + background webhook traffic from the four connections.",
  build(): TimelineSeedData {
    const events = structuredClone(
      materializeTimelineEvents(),
    ) as StreamTimelineEvent[];
    const datasets = structuredClone(
      supportFlowDatasetsSeed.build().datasets,
    ) as Dataset[];
    validateInDev(EventListSchema, events, "timeline:support-flow events");
    validateInDev(
      DatasetListSchema,
      datasets,
      "timeline:support-flow datasets",
    );
    return { events, datasets };
  },
};
