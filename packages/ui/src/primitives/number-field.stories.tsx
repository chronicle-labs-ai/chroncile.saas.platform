import type { Meta, StoryObj } from "@storybook/react";
import { NumberField } from "./number-field";

const meta: Meta<typeof NumberField> = {
  title: "Primitives/NumberField",
  component: NumberField,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof NumberField>;

export const Default: Story = {
  render: () => (
    <div className="w-[200px]">
      <NumberField
        aria-label="Count"
        defaultValue={10}
        minValue={0}
        maxValue={100}
      />
    </div>
  ),
};

export const Currency: Story = {
  render: () => (
    <div className="w-[200px]">
      <NumberField
        aria-label="Price"
        defaultValue={49}
        formatOptions={{ style: "currency", currency: "USD" }}
      />
    </div>
  ),
};
