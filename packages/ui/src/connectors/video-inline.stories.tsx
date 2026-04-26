import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { VideoInline } from "./video-inline";
import { getSource } from "../onboarding/data";

const meta: Meta<typeof VideoInline> = {
  title: "Connectors/VideoInline",
  component: VideoInline,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof VideoInline>;

function DefaultDemo() {
  const [open, setOpen] = React.useState(true);
  return (
    <VideoInline
      source={getSource("stripe")!}
      isOpen={open}
      onClose={() => setOpen(false)}
    />
  );
}

export const Default: Story = { render: () => <DefaultDemo /> };
