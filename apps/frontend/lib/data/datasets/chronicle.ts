/*
 * `chronicle` datasets provider — direct browser → Chronicle backend.
 *
 * Routes mirror the manager's needs and assume the Rust side
 * exposes them under `/api/platform/datasets/*`. Until those land
 * the provider raises `ProviderError(404)` (or whatever the
 * backend returns) which percolates up through React Query into the
 * page's error state.
 *
 * Every response is validated against the generated Zod schemas
 * before being handed back. A schema miss surfaces as
 * `ProviderError(502, …)` so consumers get a typed, narrow error
 * instead of a runtime crash inside the component tree.
 *
 * The `as <Type>` casts after `validate(...)` are safe — `validate`
 * just confirmed the runtime shape matches the schema, and the
 * static drift-check blocks emitted into `shared/src/schemas/*.ts`
 * fail compilation if the Zod schema's inferred type diverges from
 * the matching ts-rs type.
 */

import { getBackendUrl } from "platform-api";
import {
  DatasetEvalRunSchema,
  DatasetSavedViewSchema,
  DatasetSchema,
  DatasetSnapshotSchema,
} from "chronicle/schemas";
import type {
  CreateDatasetPayload,
  Dataset,
  DatasetEvalRun,
  DatasetSavedView,
  DatasetSnapshot,
  UpdateDatasetPayload,
  UpdateTracesPayload,
} from "ui";
import { z } from "zod";

import { chronicleFetch } from "../shared/fetcher";
import { getBackendToken } from "../shared/auth-token";
import { validate, validateNullable } from "../shared/validate";
import type { Subscription } from "../types";
import type { DatasetsEvent, DatasetsProvider } from "./types";

const ROOT = "/api/platform/datasets";

const DatasetListSchema = z.array(DatasetSchema);
const DatasetSnapshotIndexSchema = z.record(DatasetSnapshotSchema);
const DatasetSavedViewListSchema = z.array(DatasetSavedViewSchema);
const DatasetEvalRunListSchema = z.array(DatasetEvalRunSchema);

interface SubscribeEnvelope {
  kind: DatasetsEvent["kind"];
  datasets?: readonly Dataset[];
  datasetId?: string;
  snapshot?: DatasetSnapshot;
}

export const chronicleDatasetsProvider: DatasetsProvider = {
  list: () =>
    chronicleFetch<unknown>(`${ROOT}`).then(
      (raw) =>
        validate(DatasetListSchema, raw, "chronicle datasets.list") as readonly Dataset[],
    ),

  getSnapshot: (id) =>
    chronicleFetch<unknown>(
      `${ROOT}/${encodeURIComponent(id)}/snapshot`,
    ).then(
      (raw) =>
        validateNullable(
          DatasetSnapshotSchema,
          raw,
          `chronicle datasets.getSnapshot(${id})`,
        ) as DatasetSnapshot | null,
    ),

  listSnapshots: () =>
    chronicleFetch<unknown>(`${ROOT}/snapshots`).then(
      (raw) =>
        validate(
          DatasetSnapshotIndexSchema,
          raw,
          "chronicle datasets.listSnapshots",
        ) as Readonly<Record<string, DatasetSnapshot>>,
    ),

  create: (payload: CreateDatasetPayload) =>
    chronicleFetch<unknown>(`${ROOT}`, { method: "POST", body: payload }).then(
      (raw) => validate(DatasetSchema, raw, "chronicle datasets.create") as Dataset,
    ),

  update: ({ id, patch }: UpdateDatasetPayload) =>
    chronicleFetch<unknown>(`${ROOT}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: patch,
    }).then(
      (raw) =>
        validate(DatasetSchema, raw, `chronicle datasets.update(${id})`) as Dataset,
    ),

  remove: (id, opts) =>
    chronicleFetch<void>(`${ROOT}/${encodeURIComponent(id)}`, {
      method: "DELETE",
      searchParams: opts?.cascade ? { cascade: "1" } : undefined,
    }),

  updateTraces: ({ datasetId, traceIds, patch }: UpdateTracesPayload) =>
    chronicleFetch<unknown>(
      `${ROOT}/${encodeURIComponent(datasetId)}/traces`,
      { method: "PATCH", body: { traceIds, patch } },
    ).then(
      (raw) =>
        validate(
          DatasetSnapshotSchema,
          raw,
          `chronicle datasets.updateTraces(${datasetId})`,
        ) as DatasetSnapshot,
    ),

  listSavedViews: (datasetId) =>
    chronicleFetch<unknown>(
      `${ROOT}/${encodeURIComponent(datasetId)}/saved-views`,
    ).then(
      (raw) =>
        validate(
          DatasetSavedViewListSchema,
          raw,
          `chronicle datasets.listSavedViews(${datasetId})`,
        ) as readonly DatasetSavedView[],
    ),

  listEvalRuns: (datasetId) =>
    chronicleFetch<unknown>(
      `${ROOT}/${encodeURIComponent(datasetId)}/eval-runs`,
    ).then(
      (raw) =>
        validate(
          DatasetEvalRunListSchema,
          raw,
          `chronicle datasets.listEvalRuns(${datasetId})`,
        ) as readonly DatasetEvalRun[],
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
            const payload = JSON.parse(msg.data) as SubscribeEnvelope;
            if (payload.kind === "list-changed" && payload.datasets) {
              const datasets = validate(
                DatasetListSchema,
                payload.datasets,
                "chronicle datasets SSE list-changed",
              ) as readonly Dataset[];
              handler({ kind: "list-changed", datasets });
            } else if (
              payload.kind === "snapshot-changed" &&
              payload.datasetId &&
              payload.snapshot
            ) {
              const snapshot = validate(
                DatasetSnapshotSchema,
                payload.snapshot,
                "chronicle datasets SSE snapshot-changed",
              ) as DatasetSnapshot;
              handler({
                kind: "snapshot-changed",
                datasetId: payload.datasetId,
                snapshot,
              });
            }
          } catch (err) {
            if (typeof console !== "undefined") {
              console.error("[chronicle-datasets] bad SSE payload", err);
            }
          }
        };
      } catch (err) {
        if (typeof console !== "undefined") {
          console.warn("[chronicle-datasets] subscribe failed", err);
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
