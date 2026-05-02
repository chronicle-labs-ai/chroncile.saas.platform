import type { Meta, StoryObj } from "@storybook/react";

import { AgentModelLabel } from "./agent-model-label";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof AgentModelLabel> = {
  title: "Agents/atoms/AgentModelLabel",
  component: AgentModelLabel,
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="540px">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentModelLabel>;

export const OpenAI: Story = {
  args: {
    model: {
      provider: "openai.responses",
      modelId: "gpt-4.1-mini",
      label: "openai.responses/gpt-4.1-mini",
    },
  },
};

export const Anthropic: Story = {
  args: {
    model: {
      provider: "anthropic",
      modelId: "claude-3-5-sonnet-20241022",
      label: "anthropic/claude-3-5-sonnet-20241022",
    },
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <AgentModelLabel
        size="xs"
        model={{ provider: "openai", modelId: "gpt-4o-mini", label: "openai/gpt-4o-mini" }}
      />
      <AgentModelLabel
        size="sm"
        model={{ provider: "openai", modelId: "gpt-4o-mini", label: "openai/gpt-4o-mini" }}
      />
      <AgentModelLabel
        size="md"
        model={{ provider: "openai", modelId: "gpt-4o-mini", label: "openai/gpt-4o-mini" }}
      />
    </div>
  ),
};

export const ResolvedDrift: Story = {
  args: {
    model: {
      provider: "openai.responses",
      modelId: "gpt-4.1-mini",
      label: "openai.responses/gpt-4.1-mini",
    },
    resolvedModelId: "gpt-4.1-mini-2025-06-12",
  },
};

export const UnknownProvider: Story = {
  args: {
    model: {
      provider: "internal-llm",
      modelId: "private-1.5",
      label: "internal-llm/private-1.5",
    },
  },
};
