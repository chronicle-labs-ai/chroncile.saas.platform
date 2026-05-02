import type { Meta, StoryObj } from "@storybook/react";

import { BacktestResults } from "./backtest-results";
import { ProductChromeFrame } from "../_story-frame";
import {
  BACKTEST_DIVERGENCES,
  BACKTEST_JOB_PRESETS,
  BACKTEST_METRICS,
  cloneRecipe,
} from "../data";

const meta: Meta<typeof BacktestResults> = {
  title: "Backtests/Results",
  component: BacktestResults,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="none">
        <Story />
      </ProductChromeFrame>
    ),
  ],
  args: {
    metrics: BACKTEST_METRICS,
    divergences: BACKTEST_DIVERGENCES,
  },
};

export default meta;
type Story = StoryObj<typeof BacktestResults>;

const regression = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "regression")!.recipe,
);
const compare = cloneRecipe(BACKTEST_JOB_PRESETS.find((j) => j.id === "compare")!.recipe);
const bug = cloneRecipe(BACKTEST_JOB_PRESETS.find((j) => j.id === "bug")!.recipe);

export const Default: Story = {
  args: { recipe: regression },
};

export const TwoAgents: Story = {
  args: { recipe: compare },
};

export const FourAgentsBugRepro: Story = {
  args: { recipe: bug, defaultFocusedAgentId: "support-v4.2" },
};

export const RegressionFocused: Story = {
  args: {
    recipe: regression,
    verdictTitle: "support-v4.2 needs review · regressions on policy + cost",
    verdictSub:
      "Outcome quality unchanged but policy violations and per-trace cost increased. Hold for the next iteration.",
  },
};
