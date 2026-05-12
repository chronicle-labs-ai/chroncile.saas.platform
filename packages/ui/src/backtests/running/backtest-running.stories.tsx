import type { Meta, StoryObj } from "@storybook/react";

import { BacktestRunning } from "./backtest-running";
import { ProductChromeFrame } from "../_story-frame";
import { BACKTEST_DIVERGENCES, BACKTEST_JOB_PRESETS, cloneRecipe } from "../data";

const meta: Meta<typeof BacktestRunning> = {
  title: "Backtests/Running",
  component: BacktestRunning,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="none">
        <Story />
      </ProductChromeFrame>
    ),
  ],
  args: {
    divergences: BACKTEST_DIVERGENCES,
  },
};

export default meta;
type Story = StoryObj<typeof BacktestRunning>;

const regression = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "regression")!.recipe,
);
const compare = cloneRecipe(BACKTEST_JOB_PRESETS.find((j) => j.id === "compare")!.recipe);
const replay = cloneRecipe(BACKTEST_JOB_PRESETS.find((j) => j.id === "replay")!.recipe);

export const Mid: Story = {
  args: { recipe: regression, initialProgress: 47 },
};

export const NearDone: Story = {
  args: { recipe: regression, initialProgress: 92 },
};

export const TwoAgents: Story = {
  args: { recipe: compare, initialProgress: 38 },
};

export const ReplayAcrossVersions: Story = {
  args: { recipe: replay, initialProgress: 26 },
};
