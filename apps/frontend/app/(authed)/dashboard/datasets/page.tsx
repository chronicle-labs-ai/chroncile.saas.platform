"use client";

import { DashboardViewportShell, DatasetsManager } from "ui";

import {
  useCreateDatasetAction,
  useDatasetSnapshotIndex,
  useDatasets,
  useDeleteDatasetAction,
  useUpdateDatasetAction,
  useUpdateTracesAction,
} from "@/lib/data/datasets";

/*
 * /dashboard/datasets
 *
 * Datasets surface — list/grid of datasets with the in-component
 * drill into a single dataset's detail page (Overview / Traces /
 * Clusters / Graph / Timeline).
 *
 * Data + mutations flow through the `DatasetsProvider` middleware so
 * `NEXT_PUBLIC_DATA_DATASETS=mock|app|chronicle` swaps the source
 * without changes here. The CRUD action hooks
 * (`useCreateDatasetAction`, `useUpdateDatasetAction`,
 * `useDeleteDatasetAction`, `useUpdateTracesAction`) return
 * promise-shaped callbacks that drop directly into the manager's
 * existing handler props.
 *
 * `DatasetsManager` snapshots its `datasets` prop into internal
 * state on first mount and never re-syncs (it owns optimistic
 * mutations from there). We wait for the provider's first response
 * before mounting it — otherwise the prop default (the design-system
 * fixture) lands first and the manager freezes on those rows even
 * after the support-flow data arrives.
 */
export default function DatasetsPage() {
  const { data: datasets } = useDatasets();
  const { data: snapshotsById } = useDatasetSnapshotIndex();

  const onCreateDataset = useCreateDatasetAction();
  const onUpdateDataset = useUpdateDatasetAction();
  const onDeleteDataset = useDeleteDatasetAction();
  const onUpdateTraces = useUpdateTracesAction();

  if (!datasets || !snapshotsById) {
    return <DashboardViewportShell>{null}</DashboardViewportShell>;
  }

  return (
    <DashboardViewportShell>
      <DatasetsManager
        datasets={datasets}
        snapshotsById={snapshotsById}
        onCreateDataset={onCreateDataset}
        onUpdateDataset={onUpdateDataset}
        onDeleteDataset={onDeleteDataset}
        onUpdateTraces={onUpdateTraces}
      />
    </DashboardViewportShell>
  );
}
