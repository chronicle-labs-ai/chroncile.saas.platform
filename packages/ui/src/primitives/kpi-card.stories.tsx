import type { Meta, StoryObj } from "@storybook/react";

import { KpiCard, KpiGrid } from "./kpi-card";

const meta = {
  title: "Primitives/KpiCard",
  component: KpiCard,
  parameters: { layout: "centered" },
  argTypes: {
    label: { control: "text" },
    value: { control: "text" },
    sub: { control: "text" },
    valueTone: {
      control: "select",
      options: ["default", "ember", "green", "amber", "red"],
    },
    monoValue: { control: "boolean" },
  },
  args: {
    label: "CPU",
    value: "42%",
    sub: "5m average",
    valueTone: "default",
    monoValue: false,
  },
} satisfies Meta<typeof KpiCard>;

export default meta;
type Story = StoryObj<typeof KpiCard>;

function KpiDemo() {
  return (
    <KpiGrid>
      <KpiCard label="CPU" value="42%" sub="5m average" />
      <KpiCard label="P95" value="182ms" valueTone="ember" />
      <KpiCard label="Commit" value="8f3a91c" monoValue />
      <KpiCard label="Errors" value="0" valueTone="green" sub="last hour" />
    </KpiGrid>
  );
}

export const Default: Story = {
  render: (args) => (
    <div className="w-[220px]">
      <KpiCard {...args} />
    </div>
  ),
};

export const Grid: Story = {
  render: () => <KpiDemo />,
};
