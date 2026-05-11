import type { Meta, StoryObj } from "@storybook/react";

import { AgentConfigHashChip } from "./agent-config-hash-chip";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof AgentConfigHashChip> = {
  title: "Agents/atoms/AgentConfigHashChip",
  component: AgentConfigHashChip,
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="540px">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentConfigHashChip>;

const HASH =
  "sha256:926546012657a032fa5088ec556034e3962a036affe2718b873be5ecaf902150";

export const Default: Story = {
  args: { hash: HASH },
};

export const Subtle: Story = {
  args: { hash: HASH, tone: "subtle" },
};

export const Labeled: Story = {
  args: { hash: HASH, label: "config" },
};

export const NoCopy: Story = {
  args: { hash: HASH, hideCopy: true },
};
