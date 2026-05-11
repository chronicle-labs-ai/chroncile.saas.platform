import type { Meta, StoryObj } from "@storybook/react";
import { RadioGroup, Radio } from "./radio";

const meta: Meta = {
  title: "Primitives/RadioGroup",
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <RadioGroup aria-label="Environment" defaultValue="prod">
      <Radio value="dev">Development</Radio>
      <Radio value="stg">Staging</Radio>
      <Radio value="prod">Production</Radio>
    </RadioGroup>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <RadioGroup aria-label="Mode" orientation="horizontal" defaultValue="auto">
      <Radio value="manual">Manual</Radio>
      <Radio value="auto">Auto</Radio>
      <Radio value="disabled">Disabled</Radio>
    </RadioGroup>
  ),
};
