import type { Meta, StoryObj } from "@storybook/react";

import { HashDomainChip } from "./hash-domain-chip";
import { ProductChromeFrame } from "./_story-frame";
import type { HashDomain } from "./types";

const meta: Meta<typeof HashDomainChip> = {
  title: "Agents/atoms/HashDomainChip",
  component: HashDomainChip,
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="640px">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof HashDomainChip>;

const DOMAINS: HashDomain[] = [
  "agent.root",
  "prompt",
  "model.contract",
  "provider.options",
  "tool.contract",
  "runtime.policy",
  "dependency",
  "knowledge.contract",
  "workflow.graph",
  "effective.run",
  "provider.observation",
  "operational",
  "output",
];

export const Default: Story = {
  args: { domain: "prompt" },
};

export const AllDomains: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {DOMAINS.map((d) => (
        <HashDomainChip key={d} domain={d} />
      ))}
    </div>
  ),
};

export const InlineAndActive: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {DOMAINS.slice(0, 6).map((d) => (
          <HashDomainChip key={d} domain={d} active />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {DOMAINS.slice(0, 6).map((d) => (
          <HashDomainChip key={d} domain={d} inline />
        ))}
      </div>
    </div>
  ),
};
