import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { OTPInput } from "./otp-input";

/*
 * @deprecated The single-prop `<OTPInput>` API powers existing auth
 * flows and stays here as a regression baseline. New code should reach
 * for the shadcn-shape `<InputOTP>` compound (see "Primitives/InputOTP")
 * which composes the `input-otp` package.
 */

const meta: Meta<typeof OTPInput> = {
  title: "Primitives/OTPInput (legacy)",
  component: OTPInput,
  parameters: { layout: "centered" },
  argTypes: {
    length: { control: { type: "number", min: 4, max: 8 } },
    error: { control: "boolean" },
    success: { control: "boolean" },
    disabled: { control: "boolean" },
    codeGridStyle: { control: "boolean" },
  },
  args: { length: 6 },
};
export default meta;
type Story = StoryObj<typeof OTPInput>;

export const Default: Story = {
  render: (args) => {
    const [v, setV] = React.useState("");
    return (
      <div className="flex flex-col gap-s-3">
        <OTPInput {...args} value={v} onChange={setV} />
        <span className="font-mono text-mono-sm text-ink-dim">
          value: {v || "—"}
        </span>
      </div>
    );
  },
};

export const Prefilled: Story = {
  render: (args) => (
    <OTPInput {...args} defaultValue="483921" autoFocus={false} />
  ),
};

export const ErrorState: Story = {
  args: { error: true },
  render: (args) => (
    <OTPInput {...args} defaultValue="000000" autoFocus={false} />
  ),
};

export const SuccessState: Story = {
  args: { success: true },
  render: (args) => (
    <OTPInput {...args} defaultValue="483921" autoFocus={false} />
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => <OTPInput {...args} defaultValue="12" autoFocus={false} />,
};

export const FourCells: Story = {
  args: { length: 4 },
  render: (args) => <OTPInput {...args} />,
};

/* ── CodeGrid (re-skinned A.3 cells) ─────────────────────── */

export const CodeGridEmpty: Story = {
  name: "CodeGrid · empty",
  args: { codeGridStyle: true },
  render: (args) => <OTPInput {...args} autoFocus={false} />,
};

export const CodeGridPartial: Story = {
  name: "CodeGrid · partial",
  args: { codeGridStyle: true },
  render: (args) => <OTPInput {...args} defaultValue="483" autoFocus={false} />,
};

export const CodeGridComplete: Story = {
  name: "CodeGrid · complete",
  args: { codeGridStyle: true },
  render: (args) => (
    <OTPInput {...args} defaultValue="483921" autoFocus={false} />
  ),
};

export const CodeGridError: Story = {
  name: "CodeGrid · error halo",
  args: { codeGridStyle: true, error: true },
  render: (args) => (
    <OTPInput {...args} defaultValue="000000" autoFocus={false} />
  ),
};

export const CodeGridSuccess: Story = {
  name: "CodeGrid · success halo",
  args: { codeGridStyle: true, success: true },
  render: (args) => (
    <OTPInput {...args} defaultValue="483921" autoFocus={false} />
  ),
};

export const CodeGridDisabled: Story = {
  name: "CodeGrid · disabled",
  args: { codeGridStyle: true, disabled: true },
  render: (args) => <OTPInput {...args} defaultValue="12" autoFocus={false} />,
};
