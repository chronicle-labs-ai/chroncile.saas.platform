import type { Meta, StoryObj } from "@storybook/react";

import { BacktestNav } from "./backtest-nav";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof BacktestNav> = {
  title: "Backtests/BacktestNav",
  component: BacktestNav,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="none">
        <Story />
      </ProductChromeFrame>
    ),
  ],
  args: {
    runName: "support-v4 · refund+escalation regression",
    workspace: "chronicle",
  },
};

export default meta;
type Story = StoryObj<typeof BacktestNav>;

export const Configure: Story = {
  args: { stage: "configure", runName: "new backtest", runStatus: null },
};

export const Running: Story = {
  args: { stage: "running", runStatus: "running" },
};

export const Results: Story = {
  args: { stage: "results", runStatus: "done" },
};

export const WithBackToList: Story = {
  args: {
    stage: "configure",
    runName: "compare v3 vs v4.0",
    runStatus: null,
    onBackToList: () => {
      console.log("back to list");
    },
  },
};
