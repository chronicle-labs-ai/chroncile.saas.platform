import type { Meta, StoryObj } from "@storybook/react";
import { VideoPlayer } from "./video-player";

const meta: Meta<typeof VideoPlayer> = {
  title: "Connectors/VideoPlayer",
  component: VideoPlayer,
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof VideoPlayer>;

const CHAPTERS = [
  { id: "intro", at: 0, label: "Where to find your key" },
  { id: "paste", at: 22, label: "Paste it in" },
  { id: "verify", at: 48, label: "First event arrives" },
];

export const AtStart: Story = {
  args: {
    caption: "Connecting Stripe — 1:12",
    duration: 72,
    current: 0,
    chapters: CHAPTERS,
  },
  render: (args) => (
    <div style={{ width: 480 }}>
      <VideoPlayer {...args} />
    </div>
  ),
};

export const Midway: Story = {
  args: {
    caption: "Connecting Stripe — 1:12",
    duration: 72,
    current: 28,
    chapters: CHAPTERS,
  },
  render: (args) => (
    <div style={{ width: 480 }}>
      <VideoPlayer {...args} />
    </div>
  ),
};

export const NoChapters: Story = {
  args: {
    caption: "Quick tour",
    duration: 36,
    current: 12,
  },
  render: (args) => (
    <div style={{ width: 360 }}>
      <VideoPlayer {...args} />
    </div>
  ),
};

export const Square: Story = {
  args: {
    caption: "PiP",
    duration: 60,
    current: 30,
    aspect: "1/1",
    playable: false,
  },
  render: (args) => (
    <div style={{ width: 240 }}>
      <VideoPlayer {...args} />
    </div>
  ),
};
