import type { Meta, StoryObj } from "@storybook/react";

import { BacktestConfigure } from "./backtest-configure";
import { ProductChromeFrame } from "../_story-frame";
import { BACKTEST_JOB_PRESETS, cloneRecipe } from "../data";

const meta: Meta<typeof BacktestConfigure> = {
  title: "Backtests/Configure/BacktestConfigure",
  component: BacktestConfigure,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="none">
        <div className="h-[calc(100svh-3rem)]">
          <Story />
        </div>
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof BacktestConfigure>;

const replayRecipe = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "replay")!.recipe,
);
const compareRecipe = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "compare")!.recipe,
);
const regressionRecipe = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "regression")!.recipe,
);
const suiteRecipe = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "suite")!.recipe,
);

export const EmptyState: Story = {};

export const ReplayPipeline_StepDataset: Story = {
  args: { initialRecipe: replayRecipe, initialStep: "dataset" },
};

export const ComparePipeline_StepEnrich: Story = {
  args: { initialRecipe: compareRecipe, initialStep: "enrich" },
};

export const RegressionPipeline_StepEnvironment: Story = {
  args: { initialRecipe: regressionRecipe, initialStep: "environment" },
};

export const SuitePipeline_StepVersions: Story = {
  args: { initialRecipe: suiteRecipe, initialStep: "versions" },
};
