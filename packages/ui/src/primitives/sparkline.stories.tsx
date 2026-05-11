import type { Meta, StoryObj } from "@storybook/react";

import { Sparkline } from "./sparkline";

const meta = {
  title: "Primitives/Sparkline",
  component: Sparkline,
  parameters: { layout: "centered" },
  argTypes: {
    values: { control: "object" },
    tone: {
      control: "select",
      options: ["ember", "green", "amber", "red", "teal"],
    },
    width: { control: "number" },
    height: { control: "number" },
  },
} satisfies Meta<typeof Sparkline>;

export default meta;
type Story = StoryObj<typeof Sparkline>;

const values = [12, 18, 14, 28, 24, 36, 31, 44, 39, 52, 48, 60];

function SparklineDemo() {
  return (
    <div className="grid max-w-[420px] gap-s-4 rounded-md border border-hairline bg-surface-01 p-s-5">
      <Sparkline values={values} tone="ember" />
      <Sparkline values={[4, 8, 7, 9, 16, 15, 22, 26, 24]} tone="green" />
      <Sparkline values={[16, 14, 18, 12, 8, 10, 7, 5]} tone="red" />
    </div>
  );
}

export const Default: Story = {
  args: { values, tone: "ember" },
};

export const Gallery: Story = {
  render: () => <SparklineDemo />,
};
