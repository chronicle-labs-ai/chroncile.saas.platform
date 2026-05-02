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
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof BacktestConfigure>;

const regressionRecipe = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "regression")!.recipe,
);

export const PickPhase: Story = {};

export const RecipePhase: Story = {
  args: { initialRecipe: regressionRecipe },
};
