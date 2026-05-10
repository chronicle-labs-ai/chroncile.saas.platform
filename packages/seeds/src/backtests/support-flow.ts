/*
 * Support-flow backtests seed.
 *
 * Lines up the Backtests pickers with the same `support-agent` story
 * the agents/datasets/connections/timeline support-flow seeds tell —
 * the dataset picker shows the support-flow datasets, the agent
 * picker shows `support-agent`. One historical run row appears on
 * the list for navigation; we deliberately don't pre-fill a recipe
 * because the support-flow narrative lives on the agents/timeline
 * surfaces.
 */

import {
  environmentsSeed,
  type AgentSummary,
  type BacktestRunSummary,
  type Dataset,
  type DatasetSnapshot,
  type SandboxEnvironment,
} from "ui";

import { supportFlowAgentsSeed } from "../agents/support-flow";
import {
  SUPPORT_FLOW_ANCHOR_MS,
  SUPPORT_FLOW_AGENT_CURRENT,
  SUPPORT_FLOW_AGENT_NAME,
} from "../_scenarios/support-flow";
import { supportFlowDatasetsSeed } from "../datasets/support-flow";
import type { BacktestsSeed, BacktestsSeedData } from "./types";

const ANCHOR = SUPPORT_FLOW_ANCHOR_MS;
const iso = (offsetMin: number) =>
  new Date(ANCHOR - offsetMin * 60_000).toISOString();

export const supportFlowBacktestsSeed: BacktestsSeed = {
  id: "support-flow",
  label: "Support flow",
  description:
    "Pickers wired to the support-agent + support-flow datasets, plus one prior run on the list.",
  build(): BacktestsSeedData {
    const datasetsSeedBuild = supportFlowDatasetsSeed.build();
    const agentsSeedBuild = supportFlowAgentsSeed.build();

    const availableDatasets = structuredClone(
      datasetsSeedBuild.datasets,
    ) as Dataset[];
    const availableDatasetSnapshots = structuredClone(
      datasetsSeedBuild.snapshotsById,
    ) as Record<string, DatasetSnapshot>;
    const availableAgents = structuredClone(
      agentsSeedBuild.summaries,
    ) as AgentSummary[];

    /* Pick a single environment from the ui catalog so the env picker
       isn't empty. Pulled by index rather than id so we don't break
       if `environmentsSeed[0]` ever moves. */
    const baseEnv =
      environmentsSeed.find((e) => e.id === "env_acme_refunds") ??
      environmentsSeed[0];
    const availableEnvironments = baseEnv
      ? ([structuredClone(baseEnv) as SandboxEnvironment] as const)
      : ([] as readonly SandboxEnvironment[]);

    /* One prior `done` run pointing at the refund replay corpus +
       support-agent. Gives the list a non-empty state without
       implying a result we haven't authored. */
    const replayDataset = availableDatasets.find(
      (d) => d.id === "ds_support_refund_replay",
    );
    const runs: BacktestRunSummary[] = replayDataset
      ? [
          {
            id: "run_support_flow_replay",
            name: `replay · ${SUPPORT_FLOW_AGENT_NAME}@${SUPPORT_FLOW_AGENT_CURRENT}`,
            mode: "replay",
            status: "done",
            updatedAt: iso(60),
            datasetLabel: replayDataset.name,
            environmentLabel: baseEnv?.name,
            agentIds: [
              `${SUPPORT_FLOW_AGENT_NAME}@${SUPPORT_FLOW_AGENT_CURRENT}`,
            ],
            totalRuns: replayDataset.traceCount,
            verdict: "no regressions",
            hue: "var(--c-event-teal)",
            divergences: 0,
            owner: "naomi",
          },
        ]
      : [];

    return {
      runs,
      availableDatasets,
      availableDatasetSnapshots,
      availableEnvironments,
      availableAgents,
    };
  },
};
