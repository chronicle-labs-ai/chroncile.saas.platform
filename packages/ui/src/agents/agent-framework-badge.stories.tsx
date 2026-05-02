import type { Meta, StoryObj } from "@storybook/react";

import { AgentFrameworkBadge } from "./agent-framework-badge";
import { ProductChromeFrame } from "./_story-frame";
import type { AgentFramework } from "./types";

const meta: Meta<typeof AgentFrameworkBadge> = {
  title: "Agents/atoms/AgentFrameworkBadge",
  component: AgentFrameworkBadge,
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="640px">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentFrameworkBadge>;

const ALL_FRAMEWORKS: AgentFramework[] = [
  "vercel-ai-sdk",
  "openai-agents",
  "langchain",
  "mastra",
  "langchain-python",
  "llamaindex",
  "crewai",
  "smolagents",
  "pydantic-ai",
  "strands",
  "google-adk",
  "openai-agents-python",
  "autogen",
];

export const Default: Story = {
  args: { framework: "vercel-ai-sdk" },
};

export const AllFrameworks: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {ALL_FRAMEWORKS.map((f) => (
        <AgentFrameworkBadge key={f} framework={f} />
      ))}
    </div>
  ),
};

export const SizesAndIconless: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <AgentFrameworkBadge framework="langchain" size="sm" />
        <AgentFrameworkBadge framework="langchain" size="md" />
        <AgentFrameworkBadge framework="langchain" iconless />
      </div>
      <div className="flex items-center gap-2">
        <AgentFrameworkBadge framework="crewai" size="sm" />
        <AgentFrameworkBadge framework="crewai" size="md" />
        <AgentFrameworkBadge framework="crewai" iconless />
      </div>
    </div>
  ),
};
