import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { VideoRail } from "./video-rail";
import { getSource } from "../onboarding/data";

const meta: Meta<typeof VideoRail> = {
  title: "Connectors/VideoRail",
  component: VideoRail,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof VideoRail>;

function DefaultDemo() {
  const [open, setOpen] = React.useState(true);
  return (
    <VideoRail
      source={getSource("hubspot")!}
      isOpen={open}
      onClose={() => setOpen(false)}
    />
  );
}

export const Default: Story = { render: () => <DefaultDemo /> };
