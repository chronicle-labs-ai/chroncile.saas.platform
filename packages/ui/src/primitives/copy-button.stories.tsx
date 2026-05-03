import type { Meta, StoryObj } from "@storybook/react";
import { CopyButton } from "./copy-button";

const meta: Meta<typeof CopyButton> = {
  title: "Primitives/CopyButton",
  component: CopyButton,
  parameters: { layout: "centered" },
  args: { text: "trace_cus_demo_01" },
};
export default meta;
type Story = StoryObj<typeof CopyButton>;

export const Default: Story = {
  render: (args) => (
    <div className="flex items-center gap-s-3">
      <code className="font-mono text-mono-lg text-ink-hi">{args.text}</code>
      <CopyButton {...args} />
    </div>
  ),
};

export const TextAction: Story = {
  args: { appearance: "text", label: "Copy", copiedLabel: "Copied" },
  render: (args) => (
    <div className="rounded-md border border-hairline bg-surface-01 p-s-4">
      <CopyButton {...args} />
    </div>
  ),
};

/*
 * Stress-test for layout shift: `label` is shorter than `copiedLabel`.
 * The button must not jiggle neighbouring siblings when the state flips
 * — both labels share a single grid cell so the box is sized to the
 * longer string from first paint.
 */
export const NoLayoutShift: Story = {
  args: { appearance: "text", label: "Copy", copiedLabel: "Copied to clipboard" },
  render: (args) => (
    <div className="flex items-center gap-s-3 rounded-md border border-hairline bg-surface-01 px-s-4 py-s-2">
      <code className="font-mono text-mono-sm text-ink-dim">
        sk_live_***************
      </code>
      <CopyButton {...args} />
      <span className="text-mono-xs text-ink-faint">/ no shift</span>
    </div>
  ),
};

/*
 * Side-by-side row to inspect the crossfade & press-scale at various
 * resting widths. Click each in quick succession; a state still
 * confirming on one button should never disturb the others.
 */
export const Gallery: Story = {
  render: () => (
    <div className="flex items-center gap-s-6">
      <CopyButton text="abc" />
      <CopyButton text="abc" appearance="text" label="Copy" />
      <CopyButton
        text="abc"
        appearance="text"
        label="Copy ID"
        copiedLabel="Copied!"
      />
      <CopyButton text="abc" disabled />
    </div>
  ),
};
