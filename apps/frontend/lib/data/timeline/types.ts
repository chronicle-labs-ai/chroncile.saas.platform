/*
 * Timeline provider interface + event shape.
 *
 * The dashboard `/dashboard/timeline` surface needs two things:
 *
 *   1. A snapshot of recent events to paint the viewer on first
 *      mount (`list`).
 *   2. A push channel that streams new events as they arrive so
 *      the playhead can advance and rows can append in real time
 *      (`subscribe`).
 *
 * The wire shape is the canonical `TimelineSubscriptionEvent` from
 * `chronicle/types/timeline`. The provider owns the translation
 * between SSE / fake-interval / mock-store events and that shape;
 * consumers see exactly one envelope.
 */

import type { Dataset, StreamTimelineEvent } from "chronicle/types/datasets";

import type { Subscription } from "../types";

export type TimelineEvent =
  | { kind: "snapshot"; events: readonly StreamTimelineEvent[]; occurredAt: string }
  | { kind: "appended"; event: StreamTimelineEvent }
  | { kind: "heartbeat"; occurredAt: string };

export interface TimelineWindowResponse {
  events: readonly StreamTimelineEvent[];
  /** ISO timestamps bracketing the window. Echoed from the
   *  request when the caller pinned them, otherwise filled in by
   *  the server / mock impl. */
  from?: string;
  to?: string;
  hasMore: boolean;
  totalCount?: number;
}

export interface TimelineWindowQuery {
  /** ISO lower bound, exclusive when paging back. */
  from?: string;
  /** ISO upper bound, defaults to "now". */
  to?: string;
  /** Hard cap so the viewer never blocks rendering on a runaway
   *  page. Defaults to 200 in every impl. */
  limit?: number;
}

export interface TimelineProvider {
  /** Initial window. The viewer renders these immediately on
   *  mount; `subscribe()` then prepends new ones as they arrive. */
  list(query?: TimelineWindowQuery): Promise<TimelineWindowResponse>;

  /** Datasets the user can add traces to from the detail sidebar.
   *  Pulled from this domain (rather than the datasets one) so the
   *  picker stays consistent with whichever scenario the timeline
   *  is mocking. The `app` and `chronicle` impls proxy to the same
   *  dataset list endpoints. */
  listDatasets(): Promise<readonly Dataset[]>;

  /** Live updates. The handler receives a `snapshot` first (so a
   *  late-mounted consumer doesn't miss state), then `appended`
   *  envelopes for each new event, with `heartbeat`s in between. */
  subscribe(handler: (event: TimelineEvent) => void): Subscription;
}

export interface ResettableTimelineProvider extends TimelineProvider {
  reset?: (seedId?: string) => void;
}
