import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { BacktestAgentsEditor } from "./backtest-agents-editor";
import { ProductChromeFrame } from "../_story-frame";
import { BACKTEST_CANDIDATES } from "../data";
import type { BacktestAgent } from "../types";

const meta: Meta<typeof BacktestAgentsEditor> = {
  title: "Backtests/Configure/AgentsEditor",
  component: BacktestAgentsEditor,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md">
        <div className="rounded-md border border-hairline bg-surface-00 p-4">
          <Story />
        </div>
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof BacktestAgentsEditor>;

function Stateful(initial: readonly BacktestAgent[]) {
  return function Component() {
    const [agents, setAgents] = React.useState<readonly BacktestAgent[]>(initial);
    return <BacktestAgentsEditor agents={agents} onChange={setAgents} />;
  };
}

export const Empty: Story = {
  render: Stateful([]),
};

export const OneAgent: Story = {
  render: Stateful([BACKTEST_CANDIDATES[0]!]),
};

export const TwoAgentsWithHint: Story = {
  render: Stateful([BACKTEST_CANDIDATES[0]!, BACKTEST_CANDIDATES[1]!]),
};

export const FullRoster: Story = {
  render: Stateful(BACKTEST_CANDIDATES),
};
