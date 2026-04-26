import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { WatchPill } from "./watch-pill";
import { VideoPlayer } from "./video-player";

const meta: Meta<typeof WatchPill> = {
  title: "Connectors/WatchPill",
  component: WatchPill,
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof WatchPill>;

function CollapsedDemo() {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ width: 380 }}>
      <WatchPill expanded={open} onChange={setOpen} duration="1:12" />
    </div>
  );
}

function ExpandedDemo() {
  const [open, setOpen] = React.useState(true);
  return (
    <div style={{ width: 380 }}>
      <WatchPill expanded={open} onChange={setOpen} duration="1:12" />
      {open ? (
        <div className="watch-expanded">
          <VideoPlayer
            caption="Connecting Stripe"
            duration={72}
            current={18}
            chapters={[
              { id: "a", at: 0, label: "Find your key" },
              { id: "b", at: 22, label: "Paste it" },
              { id: "c", at: 48, label: "First event" },
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}

export const Collapsed: Story = { render: () => <CollapsedDemo /> };
export const Expanded: Story = { render: () => <ExpandedDemo /> };
