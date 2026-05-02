import type { Meta, StoryObj } from "@storybook/react";

import { AgentRow } from "./agent-row";
import { agentsManagerSeed } from "./data";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof AgentRow> = {
  title: "Agents/AgentRow",
  component: AgentRow,
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="900px">
        <div className="rounded-[4px] border border-l-border bg-l-surface-raised">
          <Story />
        </div>
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentRow>;

export const Default: Story = {
  args: { agent: agentsManagerSeed[0]! },
};

export const Stack: Story = {
  render: () => (
    <>
      {agentsManagerSeed.map((agent) => (
        <AgentRow key={agent.name} agent={agent} onOpen={() => undefined} />
      ))}
    </>
  ),
};
