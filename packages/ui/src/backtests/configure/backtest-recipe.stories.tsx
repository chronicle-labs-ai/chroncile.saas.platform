import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { BacktestRecipe } from "./backtest-recipe";
import { ProductChromeFrame } from "../_story-frame";
import { BACKTEST_JOB_PRESETS, cloneRecipe } from "../data";
import type { BacktestRecipe as BacktestRecipeType } from "../types";

const meta: Meta<typeof BacktestRecipe> = {
  title: "Backtests/Configure/Recipe",
  component: BacktestRecipe,
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
type Story = StoryObj<typeof BacktestRecipe>;

const regressionRecipe = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "regression")!.recipe,
);
const compareRecipe = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "compare")!.recipe,
);
const suiteRecipe = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "suite")!.recipe,
);
const bugRecipe = cloneRecipe(BACKTEST_JOB_PRESETS.find((j) => j.id === "bug")!.recipe);

function StatefulRecipe(initial: BacktestRecipeType) {
  return function Component(args: React.ComponentProps<typeof BacktestRecipe>) {
    const [recipe, setRecipe] = React.useState<BacktestRecipeType>(initial);
    return <BacktestRecipe {...args} recipe={recipe} onRecipeChange={setRecipe} />;
  };
}

export const Default: Story = {
  render: StatefulRecipe(regressionRecipe),
};

export const TwoAgents: Story = {
  render: StatefulRecipe(compareRecipe),
};

export const FourAgents: Story = {
  render: StatefulRecipe(bugRecipe),
};

export const FromSavedDataset: Story = {
  render: StatefulRecipe(suiteRecipe),
};

export const AgentsEditorOpen: Story = {
  render: StatefulRecipe(regressionRecipe),
  args: { initialOpenPart: "agents" },
};

export const DataBuilderOpen: Story = {
  render: StatefulRecipe(regressionRecipe),
  args: { initialOpenPart: "data" },
};

export const GraderBuilderOpen: Story = {
  render: StatefulRecipe(regressionRecipe),
  args: { initialOpenPart: "graders" },
};

export const QuickCheckRunning: Story = {
  render: StatefulRecipe(regressionRecipe),
  args: { initialQuickCheck: "running" },
};

export const QuickCheckDone: Story = {
  render: StatefulRecipe(regressionRecipe),
  args: { initialQuickCheck: "done" },
};
