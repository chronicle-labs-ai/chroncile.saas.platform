import type { Meta, StoryObj } from "@storybook/react";

import { BacktestSummaryStrip } from "./backtest-summary-strip";
import { ProductChromeFrame } from "../_story-frame";
import { BACKTEST_JOB_PRESETS, cloneRecipe } from "../data";

const meta: Meta<typeof BacktestSummaryStrip> = {
  title: "Backtests/Configure/SummaryStrip",
  component: BacktestSummaryStrip,
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
type Story = StoryObj<typeof BacktestSummaryStrip>;

const replay = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "replay")!.recipe,
);
const compare = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "compare")!.recipe,
);
const regression = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "regression")!.recipe,
);
const suite = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "suite")!.recipe,
);

export const Replay: Story = { args: { recipe: replay } };
export const Compare: Story = { args: { recipe: compare } };
export const Regression: Story = { args: { recipe: regression } };
export const Suite: Story = { args: { recipe: suite } };
