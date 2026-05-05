import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { BacktestRecipeStrip } from "./backtest-recipe-strip";
import { ProductChromeFrame } from "../_story-frame";
import { BACKTEST_JOB_PRESETS, cloneRecipe } from "../data";

const meta: Meta<typeof BacktestRecipeStrip> = {
  title: "Backtests/Configure/RecipeStrip",
  component: BacktestRecipeStrip,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md">
        <div className="w-[920px] max-w-full">
          <Story />
        </div>
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof BacktestRecipeStrip>;

const compare = cloneRecipe(BACKTEST_JOB_PRESETS.find((j) => j.id === "compare")!.recipe);
const regression = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "regression")!.recipe,
);
const replay = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "replay")!.recipe,
);
const suite = cloneRecipe(BACKTEST_JOB_PRESETS.find((j) => j.id === "suite")!.recipe);

export const TwoAgentsCompose: Story = { args: { recipe: compare } };
export const ThreeAgentsRegression: Story = { args: { recipe: regression } };
export const ReplayAcrossVersions: Story = { args: { recipe: replay } };
export const SavedDataset: Story = { args: { recipe: suite } };

export const AgentsOpen: Story = { args: { recipe: regression, open: "agents" } };
export const DataOpen: Story = { args: { recipe: regression, open: "data" } };
export const GradersOpen: Story = { args: { recipe: regression, open: "graders" } };
