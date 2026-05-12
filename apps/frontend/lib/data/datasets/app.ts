/*
 * `app` datasets provider — mediates Chronicle through Next.js
 * routes under `/api/datasets/*`. Phase 1 ships only the contract;
 * route handlers land alongside.
 *
 * Responses are validated against the same Zod schemas as the
 * `chronicle` impl so a misbehaving Next.js handler can't slip a
 * bad shape past the boundary.
 */

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

import { appFetch } from "../shared/fetcher";
import { validate, validateNullable } from "../shared/validate";
import type { DatasetsProvider } from "./types";

const ROOT = "/api/datasets";

const DatasetListSchema = z.array(DatasetSchema);
const DatasetSnapshotIndexSchema = z.record(DatasetSnapshotSchema);
const DatasetSavedViewListSchema = z.array(DatasetSavedViewSchema);
const DatasetEvalRunListSchema = z.array(DatasetEvalRunSchema);

export const appDatasetsProvider: DatasetsProvider = {
  list: () =>
    appFetch<unknown>(`${ROOT}`).then(
      (raw) =>
        validate(DatasetListSchema, raw, "app datasets.list") as readonly Dataset[],
    ),

  getSnapshot: (id) =>
    appFetch<unknown>(`${ROOT}/${encodeURIComponent(id)}/snapshot`).then(
      (raw) =>
        validateNullable(
          DatasetSnapshotSchema,
          raw,
          `app datasets.getSnapshot(${id})`,
        ) as DatasetSnapshot | null,
    ),

  listSnapshots: () =>
    appFetch<unknown>(`${ROOT}/snapshots`).then(
      (raw) =>
        validate(
          DatasetSnapshotIndexSchema,
          raw,
          "app datasets.listSnapshots",
        ) as Readonly<Record<string, DatasetSnapshot>>,
    ),

  create: (payload: CreateDatasetPayload) =>
    appFetch<unknown>(`${ROOT}`, { method: "POST", body: payload }).then(
      (raw) => validate(DatasetSchema, raw, "app datasets.create") as Dataset,
    ),

  update: ({ id, patch }: UpdateDatasetPayload) =>
    appFetch<unknown>(`${ROOT}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: patch,
    }).then(
      (raw) =>
        validate(DatasetSchema, raw, `app datasets.update(${id})`) as Dataset,
    ),

  remove: (id, opts) =>
    appFetch<void>(`${ROOT}/${encodeURIComponent(id)}`, {
      method: "DELETE",
      searchParams: opts?.cascade ? { cascade: "1" } : undefined,
    }),

  updateTraces: ({ datasetId, traceIds, patch }: UpdateTracesPayload) =>
    appFetch<unknown>(
      `${ROOT}/${encodeURIComponent(datasetId)}/traces`,
      { method: "PATCH", body: { traceIds, patch } },
    ).then(
      (raw) =>
        validate(
          DatasetSnapshotSchema,
          raw,
          `app datasets.updateTraces(${datasetId})`,
        ) as DatasetSnapshot,
    ),

  listSavedViews: (datasetId) =>
    appFetch<unknown>(
      `${ROOT}/${encodeURIComponent(datasetId)}/saved-views`,
    ).then(
      (raw) =>
        validate(
          DatasetSavedViewListSchema,
          raw,
          `app datasets.listSavedViews(${datasetId})`,
        ) as readonly DatasetSavedView[],
    ),

  listEvalRuns: (datasetId) =>
    appFetch<unknown>(
      `${ROOT}/${encodeURIComponent(datasetId)}/eval-runs`,
    ).then(
      (raw) =>
        validate(
          DatasetEvalRunListSchema,
          raw,
          `app datasets.listEvalRuns(${datasetId})`,
        ) as readonly DatasetEvalRun[],
    ),

  /* Live updates ride Chronicle SSE — the `app` provider returns a
     no-op so consumers don't crash when this mode is on. Flip to
     `chronicle` mode for live updates. */
  subscribe: () => ({ unsubscribe: () => undefined }),
};
