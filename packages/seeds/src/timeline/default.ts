/*
 * Default timeline seed — wraps the canonical fixtures already
 * shipped by the design system (`streamTimelineSeed`, `datasetsSeed`).
 * Phase A keeps the bodies in `packages/ui` and structuredClones
 * here so mock-provider mutations never leak into shared state.
 *
 * `build()` validates each cloned slice against the generated Zod
 * schemas in dev mode so a UI fixture that drifts from the canonical
 * Rust shape fails at first use, not silently in production.
 */

import { DatasetSchema, StreamTimelineEventSchema } from "chronicle/schemas/datasets";
import type { Dataset, StreamTimelineEvent } from "chronicle/types/datasets";
import { datasetsSeed, streamTimelineSeed } from "ui";
import { z } from "zod";

import { validateInDev } from "../_validate";
import type { TimelineSeed, TimelineSeedData } from "./types";

const EventListSchema = z.array(StreamTimelineEventSchema);
const DatasetListSchema = z.array(DatasetSchema);

export const defaultTimelineSeed: TimelineSeed = {
  id: "default",
  label: "Realistic stream",
  description:
    "120 curated stream events + dataset registry · matches Storybook",
  build(): TimelineSeedData {
    const events = structuredClone(streamTimelineSeed) as StreamTimelineEvent[];
    const datasets = structuredClone(datasetsSeed) as Dataset[];
    validateInDev(EventListSchema, events, "timeline:default events");
    validateInDev(DatasetListSchema, datasets, "timeline:default datasets");
    return { events, datasets };
  },
};
