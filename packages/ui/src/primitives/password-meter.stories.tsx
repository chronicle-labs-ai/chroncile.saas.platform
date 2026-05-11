import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { PasswordMeter, scorePassword } from "./password-meter";

const meta: Meta<typeof PasswordMeter> = {
  title: "Primitives/PasswordMeter",
  component: PasswordMeter,
  parameters: { layout: "padded" },
  args: { value: "" },
};
export default meta;
type Story = StoryObj<typeof PasswordMeter>;

export const Empty: Story = {
  render: (args) => (
    <div className="w-[360px]">
      <PasswordMeter {...args} value="" />
    </div>
  ),
};

export const Weak: Story = {
  render: () => (
    <div className="w-[360px]">
      <PasswordMeter value="abc12345" />
    </div>
  ),
};

export const Fair: Story = {
  render: () => (
    <div className="w-[360px]">
      <PasswordMeter value="passwordOne" />
    </div>
  ),
};

export const Strong: Story = {
  render: () => (
    <div className="w-[360px]">
      <PasswordMeter value="ChronicleLabs1" />
    </div>
  ),
};

export const Excellent: Story = {
  render: () => (
    <div className="w-[360px]">
      <PasswordMeter value="Chr0nicle!Labs#" />
    </div>
  ),
};

export const Live: Story = {
  render: () => {
    const [v, setV] = React.useState("");
    return (
      <div className="flex w-[360px] flex-col gap-s-3">
        <input
          type="text"
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="Type a password"
          className="rounded-sm border border-hairline-strong bg-surface-00 px-s-3 py-s-2 font-mono text-mono-lg text-ink outline-none focus:border-ember"
        />
        <PasswordMeter value={v} />
        <span className="font-mono text-mono-sm text-ink-dim">
          score: {scorePassword(v)} / 4
        </span>
      </div>
    );
  },
};

export const HideRules: Story = {
  render: () => (
    <div className="w-[360px]">
      <PasswordMeter value="ChronicleLabs1!" hideRules />
    </div>
  ),
};
