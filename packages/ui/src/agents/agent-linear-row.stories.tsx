import type { Meta, StoryObj } from "@storybook/react";

import { AgentLinearRow } from "./agent-linear-row";
import { agentsManagerSeed } from "./data";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof AgentLinearRow> = {
  title: "Agents/AgentLinearRow",
  component: AgentLinearRow,
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="960px">
        <div className="rounded-[4px] border border-hairline-strong bg-l-surface-raised">
          <Story />
        </div>
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentLinearRow>;

export const Default: Story = {
  args: { agent: agentsManagerSeed[0]! },
};

export const Active: Story = {
  args: { agent: agentsManagerSeed[0]!, isActive: true },
};

export const Stack: Story = {
  render: () => (
    <>
      {agentsManagerSeed.map((agent) => (
        <AgentLinearRow
          key={agent.name}
          agent={agent}
          onOpen={() => undefined}
        />
      ))}
    </>
  ),
};
