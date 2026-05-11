/*
 * Timeline seed shape.
 *
 * The mock provider boots its `MockStore` from `TimelineSeedData`;
 * the `seed:chronicle` CLI consumes the same payload and POSTs each
 * event. Storybook decorators may render the viewer against
 * non-default scenarios.
 */

import type { StreamTimelineEvent } from "chronicle/types/datasets";
import type { Dataset } from "chronicle/types/datasets";

import type { Seed } from "../types";

export interface TimelineSeedData {
  /** Initial event list, sorted ascending by `occurredAt`. */
  events: readonly StreamTimelineEvent[];
  /** Datasets the user can add traces to from the detail sidebar.
   *  Lives on this seed (rather than dataset's seed) because the
   *  `/dashboard/timeline` surface needs both in lock-step — when
   *  the timeline shows a support-flow trace it should see the
   *  matching support-flow datasets in the picker. */
  datasets: readonly Dataset[];
}

export type TimelineSeed = Seed<TimelineSeedData>;
