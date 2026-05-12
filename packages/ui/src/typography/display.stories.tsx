import type { Meta, StoryObj } from "@storybook/react";
import { Display } from "./display";

const meta: Meta<typeof Display> = {
  title: "Typography/Display",
  component: Display,
  parameters: { layout: "padded" },
  args: { size: "lg", children: "Behind the stream." },
  argTypes: {
    size: { control: "radio", options: ["sm", "md", "lg", "xl", "xxl"] },
  },
};
export default meta;
type Story = StoryObj<typeof Display>;

export const Default: Story = {};
export const WithItalicBone: Story = {
  render: () => (
    <Display size="xl">
      The <em className="italic font-normal text-bone">system</em> behind the
      stream.
    </Display>
  ),
};
