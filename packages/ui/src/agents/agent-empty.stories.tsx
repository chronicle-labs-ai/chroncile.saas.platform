import type { Meta, StoryObj } from "@storybook/react";

import { AgentEmpty } from "./agent-empty";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof AgentEmpty> = {
  title: "Agents/AgentEmpty",
  component: AgentEmpty,
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="640px">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentEmpty>;

export const Empty: Story = { args: { variant: "empty" } };
export const Filtered: Story = { args: { variant: "filtered" } };
export const Detail: Story = { args: { variant: "detail" } };
