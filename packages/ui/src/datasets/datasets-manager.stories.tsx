import type { Meta, StoryObj } from "@storybook/react";

import { DatasetsManager } from "./datasets-manager";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof DatasetsManager> = {
  title: "Datasets/DatasetsManager",
  component: DatasetsManager,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="none">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DatasetsManager>;

export const Default: Story = {};

export const ListView: Story = {
  args: { initialView: "list" },
};

export const GridView: Story = {
  args: { initialView: "grid" },
};

export const EmptyAll: Story = {
  args: { datasets: [] },
};

/* Wires bulk + inline mutation handlers so the chip pickers + batch
 * strip in the dataset canvas behave end-to-end. The optimistic
 * snapshot overlay inside DatasetsManager handles the actual
 * patch — these handlers just demonstrate the consumer surface. */
export const WithBulkActions: Story = {
  args: {
    initialView: "grid",
    onUpdateTraces: async (payload) => {
      console.info("[story] onUpdateTraces", payload);
    },
    onRemoveTraceFromDataset: async (payload) => {
      console.info("[story] onRemoveTraceFromDataset", payload);
    },
  },
};

/* Demonstrates compact saved-view chips (with optimistic save +
 * update + delete) and eval-run chips that mark failing rows in the
 * active lens when selected. Multi-selecting two rows opens the
 * compare drawer in place of the single-trace inspector. */
export const WithRailAndCompare: Story = {
  args: {
    initialView: "grid",
    onUpdateTraces: async (payload) => {
      console.info("[story] onUpdateTraces", payload);
    },
    onRemoveTraceFromDataset: async (payload) => {
      console.info("[story] onRemoveTraceFromDataset", payload);
    },
    savedViewsByDatasetId: {
      ds_train_q1: [
        {
          id: "view_p0",
          name: "P0 failures",
          scope: "workspace",
          updatedAt: new Date().toISOString(),
          state: {
            lens: "list",
            groupBy: "cluster",
            density: "dense",
            filters: [
              {
                columnId: "status",
                operator: "isAnyOf",
                value: ["error"],
              },
            ],
          },
        },
        {
          id: "view_validation",
          name: "Needs validation",
          scope: "workspace",
          updatedAt: new Date().toISOString(),
          state: {
            lens: "coverage",
            groupBy: "cluster",
            density: "dense",
            filters: [
              {
                columnId: "split",
                operator: "isAnyOf",
                value: [null],
              },
            ],
          },
        },
        {
          id: "view_drift",
          name: "Drift watch",
          scope: "personal",
          updatedAt: new Date().toISOString(),
          state: {
            lens: "list",
            groupBy: "cluster",
            density: "dense",
            showEmptyGroups: true,
          },
        },
      ],
    },
    evalRunsByDatasetId: {
      ds_train_q1: [
        {
          id: "run_v014_3",
          agentLabel: "support@v0.14.3",
          startedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
          status: "passing",
          passRate: 0.92,
          totalCount: 250,
          failedTraceIds: [],
        },
        {
          id: "run_v014_2",
          agentLabel: "support@v0.14.2",
          startedAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
          status: "regressed",
          passRate: 0.71,
          totalCount: 250,
          failedTraceIds: [
            "trace_password_0",
            "trace_password_3",
            "trace_billing_1",
          ],
        },
        {
          id: "run_v014_1",
          agentLabel: "support@v0.14.1",
          startedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
          status: "passing",
          passRate: 0.89,
          totalCount: 250,
          failedTraceIds: ["trace_billing_4"],
        },
      ],
    },
  },
};
