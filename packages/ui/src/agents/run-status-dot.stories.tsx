import type { Meta, StoryObj } from "@storybook/react";

import { RunStatusDot } from "./run-status-dot";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof RunStatusDot> = {
  title: "Agents/atoms/RunStatusDot",
  component: RunStatusDot,
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="480px">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof RunStatusDot>;

export const AllStatuses: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-1.5 font-mono text-[11px] text-l-ink-lo">
        <RunStatusDot status="started" /> started
      </span>
      <span className="flex items-center gap-1.5 font-mono text-[11px] text-l-ink-lo">
        <RunStatusDot status="success" /> success
      </span>
      <span className="flex items-center gap-1.5 font-mono text-[11px] text-l-ink-lo">
        <RunStatusDot status="error" /> error
      </span>
      <span className="flex items-center gap-1.5 font-mono text-[11px] text-l-ink-lo">
        <RunStatusDot status="success" pulse /> live
      </span>
    </div>
  ),
};
