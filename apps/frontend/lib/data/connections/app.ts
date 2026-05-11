/*
 * `app` connections provider — talks to Next.js routes under
 * `/api/connections/*`. Handler routes are scaffolded in a later
 * PR; today the provider exists so the env-flag flip is meaningful
 * and the schema validation contract is wired both ways.
 */

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

import { appFetch } from "../shared/fetcher";
import { validate } from "../shared/validate";
import type { ConnectionsProvider } from "./types";

const ROOT = "/api/connections";

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

export const appConnectionsProvider: ConnectionsProvider = {
  list: () =>
    appFetch<unknown>(`${ROOT}`).then(
      (raw) =>
        validate(
          ConnectionListSchema,
          raw,
          "app connections.list",
        ) as readonly Connection[],
    ),

  listBackfills: () =>
    appFetch<unknown>(`${ROOT}/backfills`).then(
      (raw) =>
        validate(
          BackfillsByConnectionSchema,
          raw,
          "app connections.listBackfills",
        ) as Readonly<Record<string, readonly ConnectionBackfillRecord[]>>,
    ),

  listDeliveries: () =>
    appFetch<unknown>(`${ROOT}/deliveries`).then(
      (raw) =>
        validate(
          DeliveriesByConnectionSchema,
          raw,
          "app connections.listDeliveries",
        ) as Readonly<Record<string, readonly ConnectionDelivery[]>>,
    ),

  listEventSubs: () =>
    appFetch<unknown>(`${ROOT}/event-subs`).then(
      (raw) =>
        validate(
          EventSubsByConnectionSchema,
          raw,
          "app connections.listEventSubs",
        ) as Readonly<Record<string, readonly ConnectionEventTypeSub[]>>,
    ),

  pause: (id) =>
    appFetch<unknown>(`${ROOT}/${encodeURIComponent(id)}/pause`, {
      method: "POST",
    }).then(
      (raw) =>
        validate(ConnectionSchema, raw, `app connections.pause(${id})`) as Connection,
    ),

  resume: (id) =>
    appFetch<unknown>(`${ROOT}/${encodeURIComponent(id)}/resume`, {
      method: "POST",
    }).then(
      (raw) =>
        validate(ConnectionSchema, raw, `app connections.resume(${id})`) as Connection,
    ),

  test: (id) =>
    appFetch<unknown>(`${ROOT}/${encodeURIComponent(id)}/test`, {
      method: "POST",
    }).then(
      (raw) =>
        validate(ConnectionSchema, raw, `app connections.test(${id})`) as Connection,
    ),

  reauth: (id) =>
    appFetch<unknown>(`${ROOT}/${encodeURIComponent(id)}/reauth`, {
      method: "POST",
    }).then(
      (raw) =>
        validate(ConnectionSchema, raw, `app connections.reauth(${id})`) as Connection,
    ),

  rotateSecret: (id) =>
    appFetch<unknown>(`${ROOT}/${encodeURIComponent(id)}/rotate-secret`, {
      method: "POST",
    }).then(
      (raw) =>
        validate(
          ConnectionSchema,
          raw,
          `app connections.rotateSecret(${id})`,
        ) as Connection,
    ),

  runBackfill: (id) =>
    appFetch<unknown>(`${ROOT}/${encodeURIComponent(id)}/backfill`, {
      method: "POST",
    }).then(
      (raw) =>
        validate(
          ConnectionSchema,
          raw,
          `app connections.runBackfill(${id})`,
        ) as Connection,
    ),

  disconnect: (id) =>
    appFetch<void>(`${ROOT}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  /* Live updates ride Chronicle SSE — the `app` provider returns a
     no-op subscription. */
  subscribe: () => ({ unsubscribe: () => undefined }),
};
