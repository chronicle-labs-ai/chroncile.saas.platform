/*
 * StepCoverage — pipeline STEP 01.
 *
 * Merges the previous "Dataset" + "Discover gaps" steps into a single
 * panel:
 *
 *   1. SavedDatasetPicker — pick a saved dataset (all modes).
 *   2. ClusterDensityList — once a dataset is selected, surface its
 *      clusters with density bars and sample trace chips so the user
 *      can scope the run to specific behaviour buckets.
 *   3. EnrichmentProposals — gap-filler scenarios grouped by the
 *      cluster they target, with a final "New cluster" group for
 *      patterns not yet represented in the dataset.
 *
 * Done state: a dataset is selected AND at least one cluster is
 * included (or the dataset has zero clusters yet, in which case the
 * run uses the whole dataset). Scenarios are always optional.
 */

"use client";

import * as React from "react";

import { cx } from "../../../utils/cx";
import { Eyebrow } from "../../../primitives/eyebrow";
import { Mono } from "../../../typography/mono";
import {
  BACKTEST_DISCOVERY_PROPOSALS,
  BACKTEST_DATASET_SNAPSHOTS,
} from "../../data";
import type {
  BacktestData,
  BacktestDataScenario,
  BacktestDataSource,
  BacktestRecipe,
} from "../../types";
import type { Dataset } from "../../../stream-timeline/types";
import type {
  DatasetCluster,
  DatasetSnapshot,
  TraceSummary,
} from "../../../datasets/types";
import { ClusterDensityList } from "../coverage/cluster-density-list";
import { EnrichmentProposals } from "../coverage/enrichment-proposals";
import { SavedDatasetPicker } from "../coverage/saved-dataset-picker";

export interface StepCoverageProps {
  recipe: BacktestRecipe;
  onChange: (patch: Partial<BacktestRecipe>) => void;
  /** Real datasets provided by the host app for the picker. */
  availableDatasets?: readonly Dataset[];
  /** Per-dataset snapshot lookup so the cluster list and enrichment
   *  proposals can be scoped to the selected dataset. Falls back to
   *  the deterministic mock map (`BACKTEST_DATASET_SNAPSHOTS`) when
   *  not provided. */
  availableDatasetSnapshots?: Record<string, DatasetSnapshot>;
  /** Override the discovery proposals — host can pass real ones from
   *  the data-science layer. Defaults to the deterministic seed. */
  proposals?: readonly BacktestDataScenario[];
  className?: string;
}

export function StepCoverage({
  recipe,
  onChange,
  availableDatasets,
  availableDatasetSnapshots,
  proposals = BACKTEST_DISCOVERY_PROPOSALS,
  className,
}: StepCoverageProps) {
  const datasetId = recipe.data.dataset ?? null;

  const snapshot = React.useMemo<DatasetSnapshot | null>(() => {
    if (!datasetId) return null;
    if (availableDatasetSnapshots && availableDatasetSnapshots[datasetId]) {
      return availableDatasetSnapshots[datasetId];
    }
    return BACKTEST_DATASET_SNAPSHOTS[datasetId] ?? null;
  }, [availableDatasetSnapshots, datasetId]);

  const clusters: readonly DatasetCluster[] = snapshot?.clusters ?? [];
  const traces: readonly TraceSummary[] = snapshot?.traces ?? [];

  const selectedClusterIds = React.useMemo<readonly string[]>(() => {
    const filterLabels = recipe.data.sources[0]?.filters?.clusters;
    if (!filterLabels || filterLabels.length === 0) {
      return clusters.map((c) => c.id);
    }
    const labelToId = new Map(clusters.map((c) => [c.label, c.id]));
    return filterLabels
      .map((label) => labelToId.get(label))
      .filter((id): id is string => Boolean(id));
  }, [clusters, recipe.data.sources]);

  const handleToggleCluster = React.useCallback(
    (clusterId: string, included: boolean) => {
      const idToLabel = new Map(clusters.map((c) => [c.id, c.label]));
      const currentIds = new Set(selectedClusterIds);
      if (included) currentIds.add(clusterId);
      else currentIds.delete(clusterId);
      const allIncluded = currentIds.size === clusters.length;
      const filters = allIncluded
        ? undefined
        : Array.from(currentIds)
            .map((id) => idToLabel.get(id))
            .filter((label): label is string => Boolean(label));
      const nextSources: BacktestDataSource[] = recipe.data.sources.map(
        (s, idx) => {
          if (idx > 0) return s;
          const baseFilters = { ...(s.filters ?? {}) };
          if (filters && filters.length > 0) {
            baseFilters.clusters = filters;
          } else {
            delete baseFilters.clusters;
          }
          return {
            ...s,
            filters:
              Object.keys(baseFilters).length > 0 ? baseFilters : undefined,
          };
        },
      );
      const next: BacktestData = { ...recipe.data, sources: nextSources };
      onChange({ data: next });
    },
    [clusters, onChange, recipe.data, selectedClusterIds],
  );

  const datasetSelected = Boolean(datasetId);

  return (
    <div className={cx("flex flex-col gap-4 px-4 py-4", className)}>
      <header className="flex flex-col gap-0.5">
        <Eyebrow className="text-l-ink-dim">STEP 01 · COVERAGE</Eyebrow>
        <h3 className="font-display text-[15px] leading-none tracking-[-0.02em] text-l-ink-hi">
          {datasetSelected
            ? "Scope the run by cluster, then fill the gaps"
            : "Pick a dataset to see clusters and coverage gaps"}
        </h3>
        <p className="max-w-2xl text-[12.5px] text-l-ink-lo">
          Datasets are clustered by behaviour. Include the clusters
          worth running, then accept any proposed scenarios that
          surface coverage gaps before launch.
        </p>
      </header>

      <Section
        eyebrow="DATASET"
        title="Saved dataset"
        sub="The seed of the run. All modes start from a saved dataset — switch any time before launch."
      >
        <SavedDatasetPicker
          recipe={recipe}
          onChange={onChange}
          availableDatasets={availableDatasets}
        />
      </Section>

      <Section
        eyebrow="CLUSTERS"
        title="Cluster coverage"
        sub={
          datasetSelected
            ? "Include the clusters worth running. Density shows each cluster's share of the dataset."
            : "Select a dataset above to surface its clusters."
        }
        right={
          datasetSelected && clusters.length > 0 ? (
            <Mono size="sm" tone="dim" className="tabular-nums">
              {selectedClusterIds.length} of {clusters.length} included
            </Mono>
          ) : null
        }
      >
        <ClusterDensityList
          clusters={clusters}
          traces={traces}
          selectedClusterIds={selectedClusterIds}
          onToggle={handleToggleCluster}
        />
      </Section>

      <Section
        eyebrow="FILL THE GAPS"
        title="Enrichment proposals"
        sub={
          datasetSelected
            ? "Optional — accept proposals that fill coverage holes the dataset doesn't represent."
            : "Pick a dataset to see proposed scenarios."
        }
      >
        {datasetSelected ? (
          <EnrichmentProposals
            recipe={recipe}
            onChange={onChange}
            proposals={proposals}
            clusters={clusters}
          />
        ) : (
          <div className="rounded-[2px] border border-dashed border-l-border-faint bg-l-wash-1 px-3 py-6 text-center">
            <Mono size="sm" tone="dim">
              no proposals yet · pick a dataset above
            </Mono>
          </div>
        )}
      </Section>
    </div>
  );
}

/* ── Section shell ─────────────────────────────────────────── */

function Section({
  eyebrow,
  title,
  sub,
  right,
  children,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <Eyebrow className="text-l-ink-dim">{eyebrow}</Eyebrow>
          <h4 className="font-sans text-[13px] font-medium leading-none text-l-ink-hi">
            {title}
          </h4>
          <p className="max-w-2xl text-[12px] text-l-ink-lo">{sub}</p>
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {children}
    </section>
  );
}
