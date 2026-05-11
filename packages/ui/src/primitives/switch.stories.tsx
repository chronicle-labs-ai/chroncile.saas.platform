import type { Meta, StoryObj } from "@storybook/react";
import { Switch } from "./switch";

const meta: Meta<typeof Switch> = {
  title: "Primitives/Switch",
  component: Switch,
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof Switch>;

export const Default: Story = {
  render: () => (
    <div className="flex flex-col gap-s-3">
      <Switch>Record scenario on live capture</Switch>
      <Switch defaultSelected>Block deploy on divergence</Switch>
      <Switch isDisabled>Disabled toggle</Switch>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-s-8">
      <div className="flex flex-col gap-s-3">
        <span className="font-mono text-mono-sm uppercase tracking-eyebrow text-l-ink-dim">
          {`size="sm"`} (Linear)
        </span>
        <Switch size="sm">Pause capture on divergence</Switch>
        <Switch size="sm" defaultSelected>
          Auto-escalate to Slack
        </Switch>
        <Switch size="sm" isDisabled>
          Disabled
        </Switch>
      </div>
      <div className="flex flex-col gap-s-3">
        <span className="font-mono text-mono-sm uppercase tracking-eyebrow text-ink-dim">
          {`size="md"`} (brand, default)
        </span>
        <Switch>Pause capture on divergence</Switch>
        <Switch defaultSelected>Auto-escalate to Slack</Switch>
        <Switch isDisabled>Disabled</Switch>
      </div>
    </div>
  ),
};
