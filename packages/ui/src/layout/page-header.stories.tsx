import type { Meta, StoryObj } from "@storybook/react";
import { PageHeader } from "./page-header";

const meta: Meta<typeof PageHeader> = {
  title: "Layout/PageHeader",
  component: PageHeader,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {
  render: () => (
    <div className="w-[960px]">
      <PageHeader
        eyebrow="06 / 07"
        title="Product — Event Stream"
        lede="The core surface. Heterogeneous events from every source land on one rail, colored by stream, sortable as list or timeline."
      />
    </div>
  ),
};
