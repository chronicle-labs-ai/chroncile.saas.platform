import type { Meta, StoryObj } from "@storybook/react";

import { BacktestsManager } from "./backtests-manager";
import { ProductChromeFrame } from "./_story-frame";
import { BACKTEST_JOB_PRESETS, cloneRecipe } from "./data";

const meta: Meta<typeof BacktestsManager> = {
  title: "Backtests/BacktestsManager",
  component: BacktestsManager,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="none">
        <div className="h-screen">
          <Story />
        </div>
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof BacktestsManager>;

const regressionRecipe = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "regression")!.recipe,
);
const compareRecipe = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "compare")!.recipe,
);

export const Default: Story = {
  args: { initialStage: "configure" },
};

export const RecipePhase: Story = {
  args: { initialStage: "configure", initialRecipe: regressionRecipe },
};

export const Running: Story = {
  args: { initialStage: "running", initialRecipe: regressionRecipe },
};

export const Results: Story = {
  args: { initialStage: "results", initialRecipe: regressionRecipe },
};

export const TwoAgentRunning: Story = {
  args: { initialStage: "running", initialRecipe: compareRecipe },
};
