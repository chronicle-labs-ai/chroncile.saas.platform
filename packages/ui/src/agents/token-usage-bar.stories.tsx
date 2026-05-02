import type { Meta, StoryObj } from "@storybook/react";

import { TokenUsageBar } from "./token-usage-bar";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof TokenUsageBar> = {
  title: "Agents/atoms/TokenUsageBar",
  component: TokenUsageBar,
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="540px">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TokenUsageBar>;

export const Compact: Story = {
  args: {
    usage: {
      inputTokens: 162,
      outputTokens: 79,
      reasoningTokens: 0,
      cachedInputTokens: 0,
      totalTokens: 241,
    },
  },
};

export const CompactWithCache: Story = {
  args: {
    usage: {
      inputTokens: 480,
      cachedInputTokens: 220,
      outputTokens: 130,
      reasoningTokens: 40,
      totalTokens: 650,
    },
  },
};

export const Detailed: Story = {
  args: {
    variant: "detailed",
    usage: {
      inputTokens: 480,
      cachedInputTokens: 220,
      outputTokens: 130,
      reasoningTokens: 40,
      totalTokens: 650,
    },
  },
};

export const Empty: Story = {
  args: { usage: undefined },
};
