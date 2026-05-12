import type { Meta, StoryObj } from "@storybook/react";

import { MetricChart } from "./metric-chart";

const meta = {
  title: "Env Manager/MetricChart",
  component: MetricChart,
  parameters: { layout: "padded" },
  argTypes: {
    label: { control: "text" },
    value: { control: "text" },
    tone: {
      control: "select",
      options: ["ember", "green", "amber", "red", "teal"],
    },
    values: { control: "object" },
  },
  args: {
    label: "CPU",
    value: "42%",
    values: [12, 18, 14, 28, 24, 36, 31, 44, 39, 52, 48, 60],
    tone: "ember",
  },
} satisfies Meta<typeof MetricChart>;

export default meta;
type Story = StoryObj<typeof MetricChart>;

function MetricDemo() {
  return (
    <div className="grid max-w-[760px] grid-cols-1 gap-s-3 md:grid-cols-2">
      <MetricChart
        label="CPU"
        value="42%"
        values={[12, 18, 14, 28, 24, 36, 31, 44, 39, 52, 48, 60]}
        tone="ember"
      />
      <MetricChart
        label="Memory"
        value="612mb"
        values={[32, 40, 38, 48, 45, 52, 56, 54, 62]}
        tone="teal"
      />
    </div>
  );
}

export const Default: Story = {
  render: (args) => (
    <div className="max-w-[380px]">
      <MetricChart {...args} />
    </div>
  ),
};

export const Gallery: Story = {
  render: () => <MetricDemo />,
};
