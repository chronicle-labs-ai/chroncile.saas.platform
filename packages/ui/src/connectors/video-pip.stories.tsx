import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { VideoPip } from "./video-pip";
import { getSource } from "../onboarding/data";

const meta: Meta<typeof VideoPip> = {
  title: "Connectors/VideoPip",
  component: VideoPip,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof VideoPip>;

function DefaultDemo() {
  const [open, setOpen] = React.useState(true);
  return (
    <VideoPip
      source={getSource("salesforce")!}
      isOpen={open}
      onClose={() => setOpen(false)}
    />
  );
}

export const Default: Story = { render: () => <DefaultDemo /> };
