import type { Meta, StoryObj } from "@storybook/react";

import { AgentHashIndexPage } from "./agent-hash-index-page";
import { globalHashIndexSeed } from "./data";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof AgentHashIndexPage> = {
  title: "Agents/AgentHashIndexPage",
  component: AgentHashIndexPage,
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
type Story = StoryObj<typeof AgentHashIndexPage>;

export const Default: Story = {};

export const FilteredToPrompts: Story = {
  args: { initialDomains: ["prompt"] },
};

export const FilteredToProviderObservations: Story = {
  args: { initialDomains: ["provider.observation"] },
};

export const Empty: Story = {
  args: { entries: [], initialQuery: "support-agent" },
};

export const WithExternalQuery: Story = {
  args: {
    entries: globalHashIndexSeed,
    initialQuery: "support-agent",
  },
};
