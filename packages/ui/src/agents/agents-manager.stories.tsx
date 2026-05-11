import type { Meta, StoryObj } from "@storybook/react";

import { AgentsManager } from "./agents-manager";
import { ProductChromeFrame } from "./_story-frame";
import { agentsManagerSeed } from "./data";

const meta: Meta<typeof AgentsManager> = {
  title: "Agents/AgentsManager",
  component: AgentsManager,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="none">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentsManager>;

export const Default: Story = {};

/** Single-framework subset to show how the grouped list collapses
 *  down when only one framework bucket is populated. */
export const SingleFramework: Story = {
  args: {
    agents: agentsManagerSeed.filter(
      (agent) => agent.framework === "vercel-ai-sdk",
    ),
  },
};

export const Empty: Story = {
  args: { agents: [] },
};
