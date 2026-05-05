import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { StepDataset } from "./step-dataset";
import { ProductChromeFrame } from "../../_story-frame";
import { BACKTEST_JOB_PRESETS, cloneRecipe } from "../../data";
import type { BacktestRecipe } from "../../types";

const meta: Meta<typeof StepDataset> = {
  title: "Backtests/Configure/Steps/Dataset",
  component: StepDataset,
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
type Story = StoryObj<typeof StepDataset>;

function Stateful(initial: BacktestRecipe) {
  return function Component(args: React.ComponentProps<typeof StepDataset>) {
    const [recipe, setRecipe] = React.useState<BacktestRecipe>(initial);
    return (
      <StepDataset
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
const suiteRecipe = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "suite")!.recipe,
);
const emptyCompare: BacktestRecipe = {
  ...compareRecipe,
  data: { ...compareRecipe.data, sources: [], dataset: undefined, datasetLabel: undefined, kind: "composed" },
};

export const Replay_ProductionWindow: Story = {
  render: Stateful(replayRecipe),
};

export const Compare_PickDataset: Story = {
  render: Stateful(emptyCompare),
};

export const Suite_DatasetSelected: Story = {
  render: Stateful(suiteRecipe),
};
