/*
 * Chronicle-demo timeline seed.
 *
 * Re-uses the same event corpus the agents + datasets seeds emit
 * (see `_scenarios/chronicle-demo.ts`), plus a sprinkling of
 * background webhook events so the viewer doesn't render long
 * empty gaps between conversations. Datasets come from the
 * matching `datasets/chronicle-demo` seed so the dataset picker
 * on the detail sidebar shows the same two datasets that surface
 * the same trace ids.
 */

import {
  DatasetSchema,
  StreamTimelineEventSchema,
} from "chronicle/schemas/datasets";
import type { Dataset, StreamTimelineEvent } from "chronicle/types/datasets";
import { z } from "zod";

import { validateInDev } from "../_validate";
import { materializeTimelineEvents } from "../_scenarios/chronicle-demo";
import { chronicleDemoDatasetsSeed } from "../datasets/chronicle-demo";
import type { TimelineSeed, TimelineSeedData } from "./types";

const EventListSchema = z.array(StreamTimelineEventSchema);
const DatasetListSchema = z.array(DatasetSchema);

export const chronicleDemoTimelineSeed: TimelineSeed = {
  id: "chronicle-demo",
  label: "Chronicle demo (billing)",
  description:
    "Trace events from the seven billing conversations + background webhook traffic from the four connections.",
  build(): TimelineSeedData {
    const events = structuredClone(
      materializeTimelineEvents(),
    ) as StreamTimelineEvent[];
    const datasets = structuredClone(
      chronicleDemoDatasetsSeed.build().datasets,
    ) as Dataset[];
    validateInDev(EventListSchema, events, "timeline:chronicle-demo events");
    validateInDev(
      DatasetListSchema,
      datasets,
      "timeline:chronicle-demo datasets",
    );
    return { events, datasets };
  },
};
