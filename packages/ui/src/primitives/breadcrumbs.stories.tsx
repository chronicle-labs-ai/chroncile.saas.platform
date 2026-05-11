import type { Meta, StoryObj } from "@storybook/react";
import { Breadcrumbs, Breadcrumb } from "./breadcrumbs";

const meta: Meta = {
  title: "Primitives/Breadcrumbs",
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <Breadcrumbs>
      <Breadcrumb href="/">Chronicle</Breadcrumb>
      <Breadcrumb href="/runs">Runs</Breadcrumb>
      <Breadcrumb>Run 4829</Breadcrumb>
    </Breadcrumbs>
  ),
};
