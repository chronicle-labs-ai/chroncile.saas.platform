/*
 * `chronicle` connections provider — direct browser → Chronicle
 * backend. Routes assume `/api/platform/connections/*` once the
 * Rust handlers land. Until then this surfaces whatever the
 * backend returns (typically 404).
 *
 * Live updates ride SSE at `/api/platform/connections/subscribe`;
 * `subscribe()` translates each envelope into the same
 * `ConnectionsEvent` shape the mock impl emits.
 */

import { getBackendUrl } from "platform-api";
import {
  ConnectionBackfillRecordSchema,
  ConnectionDeliverySchema,
  ConnectionEventTypeSubSchema,
  ConnectionSchema,
} from "chronicle/schemas/connections";
import type {
  Connection,
  ConnectionBackfillRecord,
  ConnectionDelivery,
  ConnectionEventTypeSub,
} from "chronicle/types/connections";
import { z } from "zod";

import { chronicleFetch } from "../shared/fetcher";
import { getBackendToken } from "../shared/auth-token";
import { validate } from "../shared/validate";
import type { Subscription } from "../types";
import type { ConnectionsEvent, ConnectionsProvider } from "./types";

const ROOT = "/api/platform/connections";

const ConnectionListSchema = z.array(ConnectionSchema);
const BackfillsByConnectionSchema = z.record(
  z.array(ConnectionBackfillRecordSchema),
);
const DeliveriesByConnectionSchema = z.record(
  z.array(ConnectionDeliverySchema),
);
const EventSubsByConnectionSchema = z.record(
  z.array(ConnectionEventTypeSubSchema),
);

interface SubscribeEnvelope {
  kind: ConnectionsEvent["kind"];
  connections?: readonly Connection[];
  patch?: Partial<Connection> & { id: string };
}

export const chronicleConnectionsProvider: ConnectionsProvider = {
  list: () =>
    chronicleFetch<unknown>(`${ROOT}`).then(
      (raw) =>
        validate(
          ConnectionListSchema,
          raw,
          "chronicle connections.list",
        ) as readonly Connection[],
    ),

  listBackfills: () =>
    chronicleFetch<unknown>(`${ROOT}/backfills`).then(
      (raw) =>
        validate(
          BackfillsByConnectionSchema,
          raw,
          "chronicle connections.listBackfills",
        ) as Readonly<Record<string, readonly ConnectionBackfillRecord[]>>,
    ),

  listDeliveries: () =>
    chronicleFetch<unknown>(`${ROOT}/deliveries`).then(
      (raw) =>
        validate(
          DeliveriesByConnectionSchema,
          raw,
          "chronicle connections.listDeliveries",
        ) as Readonly<Record<string, readonly ConnectionDelivery[]>>,
    ),

  listEventSubs: () =>
    chronicleFetch<unknown>(`${ROOT}/event-subs`).then(
      (raw) =>
        validate(
          EventSubsByConnectionSchema,
          raw,
          "chronicle connections.listEventSubs",
        ) as Readonly<Record<string, readonly ConnectionEventTypeSub[]>>,
    ),

  pause: (id) =>
    chronicleFetch<unknown>(`${ROOT}/${encodeURIComponent(id)}/pause`, {
      method: "POST",
    }).then(
      (raw) =>
        validate(
          ConnectionSchema,
          raw,
          `chronicle connections.pause(${id})`,
        ) as Connection,
    ),

  resume: (id) =>
    chronicleFetch<unknown>(`${ROOT}/${encodeURIComponent(id)}/resume`, {
      method: "POST",
    }).then(
      (raw) =>
        validate(
          ConnectionSchema,
          raw,
          `chronicle connections.resume(${id})`,
        ) as Connection,
    ),

  test: (id) =>
    chronicleFetch<unknown>(`${ROOT}/${encodeURIComponent(id)}/test`, {
      method: "POST",
    }).then(
      (raw) =>
        validate(
          ConnectionSchema,
          raw,
          `chronicle connections.test(${id})`,
        ) as Connection,
    ),

  reauth: (id) =>
    chronicleFetch<unknown>(`${ROOT}/${encodeURIComponent(id)}/reauth`, {
      method: "POST",
    }).then(
      (raw) =>
        validate(
          ConnectionSchema,
          raw,
          `chronicle connections.reauth(${id})`,
        ) as Connection,
    ),

  rotateSecret: (id) =>
    chronicleFetch<unknown>(
      `${ROOT}/${encodeURIComponent(id)}/rotate-secret`,
      { method: "POST" },
    ).then(
      (raw) =>
        validate(
          ConnectionSchema,
          raw,
          `chronicle connections.rotateSecret(${id})`,
        ) as Connection,
    ),

  runBackfill: (id) =>
    chronicleFetch<unknown>(`${ROOT}/${encodeURIComponent(id)}/backfill`, {
      method: "POST",
    }).then(
      (raw) =>
        validate(
          ConnectionSchema,
          raw,
          `chronicle connections.runBackfill(${id})`,
        ) as Connection,
    ),

  disconnect: (id) =>
    chronicleFetch<void>(`${ROOT}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

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
            const payload = JSON.parse(msg.data) as SubscribeEnvelope;
            if (payload.kind === "list-changed" && payload.connections) {
              const connections = validate(
                ConnectionListSchema,
                payload.connections,
                "chronicle connections SSE list-changed",
              ) as readonly Connection[];
              handler({ kind: "list-changed", connections });
            } else if (payload.kind === "row-patched" && payload.patch?.id) {
              /* Row patches are validated against a partial — just
                 pass through; the cache reducer merges. */
              handler({ kind: "row-patched", patch: payload.patch });
            }
          } catch (err) {
            if (typeof console !== "undefined") {
              console.error("[chronicle-connections] bad SSE payload", err);
            }
          }
        };
      } catch (err) {
        if (typeof console !== "undefined") {
          console.warn("[chronicle-connections] subscribe failed", err);
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
