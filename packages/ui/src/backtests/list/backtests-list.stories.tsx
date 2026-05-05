import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { BacktestsList } from "./backtests-list";
import { ProductChromeFrame } from "../_story-frame";
import { BACKTEST_RUNS_SEED } from "../data";

const meta: Meta<typeof BacktestsList> = {
  title: "Backtests/List/BacktestsList",
  component: BacktestsList,
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
type Story = StoryObj<typeof BacktestsList>;

export const Default: Story = {
  args: { runs: BACKTEST_RUNS_SEED },
};

export const Empty: Story = {
  args: { runs: [] },
};

export const OnlyDoneRuns: Story = {
  args: {
    runs: BACKTEST_RUNS_SEED.filter((r) => r.status === "done"),
  },
};
