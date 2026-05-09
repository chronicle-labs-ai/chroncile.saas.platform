import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { StepCoverage } from "./step-coverage";
import { ProductChromeFrame } from "../../_story-frame";
import {
  BACKTEST_JOB_PRESETS,
  BACKTEST_DATASET_SNAPSHOTS,
  cloneRecipe,
} from "../../data";
import type { BacktestRecipe } from "../../types";

const meta: Meta<typeof StepCoverage> = {
  title: "Backtests/Configure/Steps/Coverage",
  component: StepCoverage,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md">
        <div className="mx-auto w-full max-w-3xl rounded-[2px] border border-divider bg-wash-micro">
          <Story />
        </div>
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof StepCoverage>;

function Stateful(initial: BacktestRecipe) {
  return function Component(args: React.ComponentProps<typeof StepCoverage>) {
    const [recipe, setRecipe] = React.useState<BacktestRecipe>(initial);
    return (
      <StepCoverage
        {...args}
        recipe={recipe}
        onChange={(patch) => setRecipe({ ...recipe, ...patch })}
      />
    );
  };
}

const replayRecipe = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "replay")!.recipe,
);
const compareRecipe = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "compare")!.recipe,
);
const regressionRecipe = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "regression")!.recipe,
);

const emptyCompare: BacktestRecipe = {
  ...compareRecipe,
  data: {
    ...compareRecipe.data,
    kind: "composed",
    dataset: undefined,
    datasetLabel: undefined,
    sources: [],
    scenarios: [],
    savedAs: null,
  },
};

/** Empty — no dataset selected; cluster + enrichment sections show
 *  empty-state placeholders. */
export const Empty: Story = {
  render: Stateful(emptyCompare),
};

/** Replay preset — pre-seeded with a small production-derived dataset
 *  (4 clusters, all-inclusive). */
export const Replay_PrebuiltDataset: Story = {
  render: Stateful(replayRecipe),
  args: { availableDatasetSnapshots: BACKTEST_DATASET_SNAPSHOTS },
};

/** Regression preset — larger dataset with 5 clusters, the recipe
 *  pre-scopes to 3 of them so the user sees a partially-included
 *  state on first paint. */
export const Regression_SkewedDensity: Story = {
  render: Stateful(regressionRecipe),
  args: { availableDatasetSnapshots: BACKTEST_DATASET_SNAPSHOTS },
};

/** Compare preset — same dataset as Replay, but with one enrichment
 *  proposal already accepted to show the gap-filler accent. */
export const Compare_WithEnrichment: Story = {
  render: Stateful({
    ...compareRecipe,
    data: {
      ...compareRecipe.data,
      scenarios: [
        {
          id: "ds_emerging_a",
          bucket: "emerging",
          kind: "longTurn",
          label: "refund.subscription_paused",
          count: 12,
          confidence: 0.71,
          accepted: true,
          clusterLabel: "Refund → escalate",
        },
      ],
    },
  }),
  args: { availableDatasetSnapshots: BACKTEST_DATASET_SNAPSHOTS },
};
