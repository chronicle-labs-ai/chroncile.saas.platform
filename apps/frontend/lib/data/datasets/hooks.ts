/*
 * React hooks over the datasets provider.
 *
 * Reads use `useQuery` (TanStack Query handles staleness, dedup,
 * focus refetch). Mutations use `useMutation` with `onMutate` for
 * optimistic updates + automatic rollback on failure — that's the
 * pattern `DatasetsManager` hand-rolls today via `snapshotOverrides`
 * and we move it to the data layer so every consumer benefits.
 */

"use client";

import * as React from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import type {
  CreateDatasetPayload,
  Dataset,
  DatasetSnapshot,
  TraceSummary,
  UpdateDatasetPayload,
  UpdateTracesPayload,
} from "ui";

import { useDataProvider } from "../provider";
import { qk } from "../query-keys";

export function useDatasets(): UseQueryResult<readonly Dataset[], Error> {
  const { datasets } = useDataProvider();
  return useQuery({
    queryKey: qk.datasets.list(),
    queryFn: () => datasets.list(),
  });
}

export function useDatasetSnapshot(
  id: string | null,
): UseQueryResult<DatasetSnapshot | null, Error> {
  const { datasets } = useDataProvider();
  return useQuery({
    queryKey: qk.datasets.snapshot(id ?? ""),
    queryFn: () => (id ? datasets.getSnapshot(id) : Promise.resolve(null)),
    enabled: id !== null && id.length > 0,
  });
}

export function useDatasetSnapshotIndex(): UseQueryResult<
  Readonly<Record<string, DatasetSnapshot>>,
  Error
> {
  const { datasets } = useDataProvider();
  return useQuery({
    queryKey: qk.datasets.snapshotIndex(),
    queryFn: () => datasets.listSnapshots(),
  });
}

export function useCreateDataset(): UseMutationResult<
  Dataset,
  Error,
  CreateDatasetPayload
> {
  const { datasets } = useDataProvider();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDatasetPayload) => datasets.create(payload),
    onSuccess: (next) => {
      qc.setQueryData(
        qk.datasets.list(),
        (old?: readonly Dataset[]) => [...(old ?? []), next] as readonly Dataset[],
      );
    },
  });
}

export function useUpdateDataset(): UseMutationResult<
  Dataset,
  Error,
  UpdateDatasetPayload
> {
  const { datasets } = useDataProvider();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateDatasetPayload) => datasets.update(payload),
    onSuccess: (next) => {
      qc.setQueryData(qk.datasets.list(), (old?: readonly Dataset[]) =>
        old
          ? (old.map((d) => (d.id === next.id ? next : d)) as readonly Dataset[])
          : ([next] as readonly Dataset[]),
      );
      qc.invalidateQueries({ queryKey: qk.datasets.snapshot(next.id) });
    },
  });
}

export function useDeleteDataset(): UseMutationResult<
  void,
  Error,
  { id: string; cascade?: boolean }
> {
  const { datasets } = useDataProvider();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cascade }) => datasets.remove(id, { cascade }),
    onSuccess: (_void, { id }) => {
      qc.setQueryData(qk.datasets.list(), (old?: readonly Dataset[]) =>
        old ? (old.filter((d) => d.id !== id) as readonly Dataset[]) : old,
      );
      qc.removeQueries({ queryKey: qk.datasets.snapshot(id) });
    },
  });
}

interface OptimisticTracesContext {
  previous: DatasetSnapshot | undefined;
}

/**
 * Update one or more traces in a dataset snapshot. Applies the
 * patch to the cached snapshot synchronously (`onMutate`) so the
 * UI reflects the change before the network round-trip; on
 * failure the previous snapshot is restored. The mock impl is
 * effectively instant; the chronicle impl benefits the most.
 */
export function useUpdateTraces(): UseMutationResult<
  DatasetSnapshot,
  Error,
  UpdateTracesPayload,
  OptimisticTracesContext
> {
  const { datasets } = useDataProvider();
  const qc = useQueryClient();

  return useMutation<
    DatasetSnapshot,
    Error,
    UpdateTracesPayload,
    OptimisticTracesContext
  >({
    mutationFn: (payload: UpdateTracesPayload) =>
      datasets.updateTraces(payload),

    onMutate: async (payload) => {
      const key = qk.datasets.snapshot(payload.datasetId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<DatasetSnapshot>(key);
      if (previous) {
        const ids = new Set(payload.traceIds);
        const traces = previous.traces.map((t) =>
          ids.has(t.traceId) ? applyTracePatch(t, payload.patch) : t,
        );
        qc.setQueryData(key, { ...previous, traces });
      }
      return { previous };
    },

    onError: (_err, payload, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(qk.datasets.snapshot(payload.datasetId), ctx.previous);
      }
    },

    onSuccess: (snapshot, payload) => {
      qc.setQueryData(qk.datasets.snapshot(payload.datasetId), snapshot);
    },
  });
}

/* ── Action-shape adapters ─────────────────────────────────── *
 * `<DatasetsManager />` accepts plain `(payload) => Promise<X>`
 * handlers; we expose thin wrappers around the mutations so the
 * page can drop them in directly without thinking about the
 * mutation result shape.
 */

export function useCreateDatasetAction(): (
  payload: CreateDatasetPayload,
) => Promise<Dataset> {
  const mutation = useCreateDataset();
  return React.useCallback(
    (payload: CreateDatasetPayload) => mutation.mutateAsync(payload),
    [mutation],
  );
}

export function useUpdateDatasetAction(): (
  payload: UpdateDatasetPayload,
) => Promise<Dataset> {
  const mutation = useUpdateDataset();
  return React.useCallback(
    (payload: UpdateDatasetPayload) => mutation.mutateAsync(payload),
    [mutation],
  );
}

export function useDeleteDatasetAction(): (payload: {
  id: string;
  cascade?: boolean;
}) => Promise<void> {
  const mutation = useDeleteDataset();
  return React.useCallback(
    (payload: { id: string; cascade?: boolean }) =>
      mutation.mutateAsync(payload),
    [mutation],
  );
}

export function useUpdateTracesAction(): (
  payload: UpdateTracesPayload,
) => Promise<void> {
  const mutation = useUpdateTraces();
  return React.useCallback(
    async (payload: UpdateTracesPayload) => {
      await mutation.mutateAsync(payload);
    },
    [mutation],
  );
}

/* ── helpers ───────────────────────────────────────────────── */

function applyTracePatch(
  trace: TraceSummary,
  patch: UpdateTracesPayload["patch"],
): TraceSummary {
  const next: TraceSummary = { ...trace };
  if ("clusterId" in patch) {
    if (patch.clusterId === null) {
      delete (next as Partial<TraceSummary>).clusterId;
    } else if (patch.clusterId !== undefined) {
      next.clusterId = patch.clusterId;
    }
  }
  if ("split" in patch) {
    if (patch.split === null) {
      delete (next as Partial<TraceSummary>).split;
    } else if (patch.split !== undefined) {
      next.split = patch.split;
    }
  }
  if (patch.status !== undefined) {
    next.status = patch.status;
  }
  if ("note" in patch) {
    if (patch.note === null) {
      delete (next as Partial<TraceSummary>).note;
    } else if (patch.note !== undefined) {
      next.note = patch.note;
    }
  }
  return next;
}
