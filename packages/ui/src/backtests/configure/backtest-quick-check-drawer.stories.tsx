import type { Meta, StoryObj } from "@storybook/react";

import { BacktestQuickCheckDrawer } from "./backtest-quick-check-drawer";
import { ProductChromeFrame } from "../_story-frame";
import { BACKTEST_JOB_PRESETS, cloneRecipe } from "../data";

const meta: Meta<typeof BacktestQuickCheckDrawer> = {
  title: "Backtests/Configure/QuickCheckDrawer",
  component: BacktestQuickCheckDrawer,
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
type Story = StoryObj<typeof BacktestQuickCheckDrawer>;

const recipe = cloneRecipe(BACKTEST_JOB_PRESETS.find((j) => j.id === "regression")!.recipe);

export const RunningEarly: Story = {
  args: { isOpen: true, state: "running", progress: 18, recipe },
};

export const RunningHalf: Story = {
  args: { isOpen: true, state: "running", progress: 56, recipe },
};

export const Done: Story = {
  args: { isOpen: true, state: "done", progress: 100, recipe },
};

export const SingleAgent: Story = {
  args: {
    isOpen: true,
    state: "done",
    progress: 100,
    recipe: cloneRecipe(BACKTEST_JOB_PRESETS.find((j) => j.id === "suite")!.recipe),
  },
};
