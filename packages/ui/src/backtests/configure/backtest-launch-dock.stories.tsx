import type { Meta, StoryObj } from "@storybook/react";

import { BacktestLaunchDock } from "./backtest-launch-dock";
import { ProductChromeFrame } from "../_story-frame";
import { BACKTEST_JOB_PRESETS, cloneRecipe } from "../data";

const meta: Meta<typeof BacktestLaunchDock> = {
  title: "Backtests/Configure/LaunchDock",
  component: BacktestLaunchDock,
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
type Story = StoryObj<typeof BacktestLaunchDock>;

export const Compare: Story = {
  args: {
    recipe: cloneRecipe(BACKTEST_JOB_PRESETS.find((j) => j.id === "compare")!.recipe),
  },
};

export const Regression: Story = {
  args: {
    recipe: cloneRecipe(BACKTEST_JOB_PRESETS.find((j) => j.id === "regression")!.recipe),
  },
};

export const SavedSuite: Story = {
  args: {
    recipe: cloneRecipe(BACKTEST_JOB_PRESETS.find((j) => j.id === "suite")!.recipe),
  },
};
