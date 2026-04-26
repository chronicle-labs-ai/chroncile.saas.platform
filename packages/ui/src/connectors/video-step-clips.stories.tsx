import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { VideoStepClips } from "./video-step-clips";
import { getSource } from "../onboarding/data";

const meta: Meta<typeof VideoStepClips> = {
  title: "Connectors/VideoStepClips",
  component: VideoStepClips,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof VideoStepClips>;

function DefaultDemo() {
  const [open, setOpen] = React.useState(true);
  return (
    <VideoStepClips
      source={getSource("salesforce")!}
      isOpen={open}
      onClose={() => setOpen(false)}
    />
  );
}

export const Default: Story = { render: () => <DefaultDemo /> };
