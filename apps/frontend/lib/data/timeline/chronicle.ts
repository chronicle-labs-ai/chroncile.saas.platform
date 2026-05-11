/*
 * `chronicle` timeline provider — direct browser → Chronicle backend.
 * Routes assume `/api/platform/timeline/*` once the Rust handlers
 * land. Until then this surfaces whatever the backend returns
 * (typically 404).
 *
 * Live updates ride SSE at `/api/platform/timeline/subscribe`. Each
 * envelope is parsed against `TimelineSubscriptionEventSchema` and
 * forwarded as the same `TimelineEvent` shape the mock impl emits.
 */

import { getBackendUrl } from "platform-api";
import { DatasetSchema } from "chronicle/schemas/datasets";
import {
  TimelineSubscriptionEventSchema,
  TimelineWindowSchema,
} from "chronicle/schemas/timeline";
import type { Dataset } from "chronicle/types/datasets";
import type {
  TimelineSubscriptionEvent,
  TimelineWindow,
} from "chronicle/types/timeline";
import { z } from "zod";

import { chronicleFetch } from "../shared/fetcher";
import { getBackendToken } from "../shared/auth-token";
import { validate } from "../shared/validate";
import type { Subscription } from "../types";
import type {
  TimelineProvider,
  TimelineWindowQuery,
  TimelineWindowResponse,
} from "./types";

const ROOT = "/api/platform/timeline";

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

export const chronicleTimelineProvider: TimelineProvider = {
  list: (query) =>
    chronicleFetch<unknown>(`${ROOT}${buildQueryString(query)}`).then(
      (raw) => {
        const parsed = validate(
          TimelineWindowSchema,
          raw,
          "chronicle timeline.list",
        ) as TimelineWindow;
        return parsed as TimelineWindowResponse;
      },
    ),

  listDatasets: () =>
    chronicleFetch<unknown>(`${ROOT}/datasets`).then(
      (raw) =>
        validate(
          DatasetListSchema,
          raw,
          "chronicle timeline.listDatasets",
        ) as readonly Dataset[],
    ),

  subscribe(handler): Subscription {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return { unsubscribe: () => undefined };
    }
    let source: EventSource | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const token = await getBackendToken();
        if (cancelled) return;
        const url = new URL(`${ROOT}/subscribe`, getBackendUrl());
        url.searchParams.set("access_token", token);
        source = new EventSource(url.toString(), { withCredentials: false });
        source.onmessage = (msg) => {
          try {
            const raw = JSON.parse(msg.data) as unknown;
            const payload = validate(
              TimelineSubscriptionEventSchema,
              raw,
              "chronicle timeline SSE envelope",
            ) as TimelineSubscriptionEvent;
            if (payload.kind === "snapshot") {
              handler({
                kind: "snapshot",
                events: payload.events,
                occurredAt: payload.occurredAt,
              });
            } else if (payload.kind === "appended") {
              handler({ kind: "appended", event: payload.event });
            } else if (payload.kind === "heartbeat") {
              handler({ kind: "heartbeat", occurredAt: payload.occurredAt });
            }
          } catch (err) {
            if (typeof console !== "undefined") {
              console.error("[chronicle-timeline] bad SSE payload", err);
            }
          }
        };
      } catch (err) {
        if (typeof console !== "undefined") {
          console.warn("[chronicle-timeline] subscribe failed", err);
        }
      }
    })();

    return {
      unsubscribe: () => {
        cancelled = true;
        source?.close();
      },
    };
  },
};
