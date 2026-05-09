/*
 * `app` timeline provider — talks to Next.js routes under
 * `/api/timeline/*`. Handler routes are scaffolded in a later PR;
 * today the provider exists so the env-flag flip is meaningful and
 * the schema validation contract is wired both ways.
 *
 * Live updates ride Chronicle SSE — the `app` mode purposefully
 * returns a no-op subscription so consumers fall back to polling
 * if they need anything live before SSE lands.
 */

import { DatasetSchema } from "chronicle/schemas/datasets";
import { TimelineWindowSchema } from "chronicle/schemas/timeline";
import type { Dataset } from "chronicle/types/datasets";
import type { TimelineWindow } from "chronicle/types/timeline";
import { z } from "zod";

import { appFetch } from "../shared/fetcher";
import { validate } from "../shared/validate";
import type {
  TimelineProvider,
  TimelineWindowQuery,
  TimelineWindowResponse,
} from "./types";

const ROOT = "/api/timeline";

const DatasetListSchema = z.array(DatasetSchema);

function buildQueryString(query?: TimelineWindowQuery): string {
  if (!query) return "";
  const params = new URLSearchParams();
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const appTimelineProvider: TimelineProvider = {
  list: (query) =>
    appFetch<unknown>(`${ROOT}${buildQueryString(query)}`).then((raw) => {
      const parsed = validate(
        TimelineWindowSchema,
        raw,
        "app timeline.list",
      ) as TimelineWindow;
      return parsed as TimelineWindowResponse;
    }),

  listDatasets: () =>
    appFetch<unknown>(`${ROOT}/datasets`).then(
      (raw) =>
        validate(
          DatasetListSchema,
          raw,
          "app timeline.listDatasets",
        ) as readonly Dataset[],
    ),

  subscribe: () => ({ unsubscribe: () => undefined }),
};
