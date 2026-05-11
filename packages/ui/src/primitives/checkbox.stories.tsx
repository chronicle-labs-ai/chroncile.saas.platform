import type { Meta, StoryObj } from "@storybook/react";
import { Checkbox } from "./checkbox";

const meta: Meta<typeof Checkbox> = {
  title: "Primitives/Checkbox",
  component: Checkbox,
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  render: () => (
    <div className="flex flex-col gap-s-3">
      <label className="flex items-center gap-s-2 font-sans text-[13px] text-l-ink">
        <Checkbox defaultChecked />
        Record scenario on live capture
      </label>
      <label className="flex items-center gap-s-2 font-sans text-[13px] text-l-ink">
        <Checkbox />
        Block deploy on any divergence
      </label>
      <label className="flex items-center gap-s-2 font-sans text-[13px] text-l-ink-lo">
        <Checkbox disabled />
        Disabled option
      </label>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-s-8">
      <div className="flex flex-col gap-s-3">
        <span className="font-sans text-[11px] font-medium uppercase tracking-[0.04em] text-l-ink-dim">
          {`size="sm"`}
        </span>
        <Checkbox size="sm" defaultChecked>
          Include system events
        </Checkbox>
        <Checkbox size="sm">Include sandbox events</Checkbox>
        <Checkbox size="sm" disabled>
          Disabled
        </Checkbox>
      </div>
      <div className="flex flex-col gap-s-3">
        <span className="font-sans text-[11px] font-medium uppercase tracking-[0.04em] text-l-ink-dim">
          {`size="md"`} (default)
        </span>
        <Checkbox defaultChecked>Include system events</Checkbox>
        <Checkbox>Include sandbox events</Checkbox>
        <Checkbox disabled>Disabled</Checkbox>
      </div>
    </div>
  ),
};
