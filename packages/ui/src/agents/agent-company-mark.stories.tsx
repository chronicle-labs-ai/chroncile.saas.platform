import type { Meta, StoryObj } from "@storybook/react";

import { AgentCompanyMark } from "./agent-company-mark";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof AgentCompanyMark> = {
  title: "Agents/atoms/AgentCompanyMark",
  component: AgentCompanyMark,
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="640px">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentCompanyMark>;

const ROW = "flex items-center gap-3 font-mono text-[11px] text-l-ink-lo";

export const KnownDarkBrands: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className={ROW}>
        <AgentCompanyMark name="openai" size="md" />
        <span>openai — known dark, light tile applied</span>
      </div>
      <div className={ROW}>
        <AgentCompanyMark name="vercel" size="md" />
        <span>vercel — known dark, light tile applied</span>
      </div>
      <div className={ROW}>
        <AgentCompanyMark name="anthropic" size="md" />
        <span>anthropic — known dark</span>
      </div>
      <div className={ROW}>
        <AgentCompanyMark name="github" size="md" />
        <span>github — known dark</span>
      </div>
      <div className={ROW}>
        <AgentCompanyMark name="linear" size="md" />
        <span>linear — known dark</span>
      </div>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <AgentCompanyMark name="openai" size="xs" />
      <AgentCompanyMark name="openai" size="sm" />
      <AgentCompanyMark name="openai" size="md" />
    </div>
  ),
};

export const NeutralColored: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className={ROW}>
        <AgentCompanyMark name="slack" size="md" />
        <span>slack — colored, neutral surface</span>
      </div>
      <div className={ROW}>
        <AgentCompanyMark name="stripe" size="md" />
        <span>stripe — colored, neutral surface</span>
      </div>
      <div className={ROW}>
        <AgentCompanyMark name="intercom" size="md" />
        <span>intercom — colored, neutral surface</span>
      </div>
      <div className={ROW}>
        <AgentCompanyMark name="shopify" size="md" />
        <span>shopify — colored, neutral surface</span>
      </div>
    </div>
  ),
};

export const ForcedTone: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className={ROW}>
        <AgentCompanyMark name="vercel" size="md" tone="dark" />
        <span>tone="dark" forces a light tile</span>
      </div>
      <div className={ROW}>
        <AgentCompanyMark name="vercel" size="md" tone="neutral" />
        <span>tone="neutral" forces the input surface</span>
      </div>
      <div className={ROW}>
        <AgentCompanyMark name="vercel" size="md" tone="light" />
        <span>tone="light" forces a dark ink tile</span>
      </div>
    </div>
  ),
};

export const RuntimeProbe: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className={ROW}>
        <AgentCompanyMark name="huggingface" size="md" />
        <span>huggingface — static known-dark</span>
      </div>
      <div className={ROW}>
        <AgentCompanyMark name="cohere" size="md" />
        <span>cohere — runtime probe upgrades neutral → tone</span>
      </div>
      <div className={ROW}>
        <AgentCompanyMark name="cohere" size="md" runtimeDetect={false} />
        <span>cohere — runtime disabled, stays neutral</span>
      </div>
    </div>
  ),
};
