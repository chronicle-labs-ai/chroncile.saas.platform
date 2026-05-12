"use client";

/*
 * Client-side glue for the `/dashboard/timeline` route.
 *
 * Pulls events + datasets from the data middleware and feeds them
 * into the design-system `<TimelineDashboard />`. The provider's
 * subscription bridge keeps the cached events array in sync as new
 * `appended` envelopes arrive — no extra subscribe call here.
 *
 * `disableRebase` is passed because the events already carry
 * realistic wall-clock timestamps in mock mode (the seed wraps
 * `streamTimelineSeed` / the support-flow scenario, both of which
 * are anchored to recent dates) and the chronicle / app modes
 * return real production timestamps the user expects to see.
 */

import { TimelineDashboard } from "ui";

import { useTimelineDatasets, useTimelineEvents } from "@/lib/data/timeline";

export function TimelineDashboardClient() {
  const events = useTimelineEvents({ limit: 500 });
  const { data: datasets } = useTimelineDatasets();
  return (
    <TimelineDashboard
      events={events}
      initialDatasets={datasets}
      disableRebase
    />
  );
}
