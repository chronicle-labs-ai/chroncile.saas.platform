import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { StreamsPanel } from "./streams-panel";
import { recordingStreamsSeed } from "./data";
import {
  REC_IDLE,
  REC_SELECTING,
  recPendingSave,
  recRecording,
  type RecordingState,
} from "./types";

const meta: Meta<typeof StreamsPanel> = {
  title: "Stream Timeline/StreamsPanel",
  component: StreamsPanel,
};
export default meta;
type Story = StoryObj<typeof StreamsPanel>;

function Controlled({ initial }: { initial: RecordingState }) {
  const [state, setState] = React.useState<RecordingState>(initial);
  return (
    <div className="max-w-2xl p-s-4">
      <StreamsPanel
        recordingState={state}
        streams={recordingStreamsSeed}
        onRecordingStateChange={setState}
        onSaveRecordingRequested={() => console.log("save")}
        onDiscardRecordingRequested={() => console.log("discard")}
      />
    </div>
  );
}

export const Idle: Story = {
  render: () => <Controlled initial={REC_IDLE} />,
};

export const Selecting: Story = {
  render: () => <Controlled initial={REC_SELECTING} />,
};

export const Recording: Story = {
  render: () => (
    <Controlled
      initial={recRecording(
        Date.now() - 87 * 1000,
        42,
        recordingStreamsSeed.slice(0, 3).map((s) => s.id),
      )}
    />
  ),
};

export const PendingSave: Story = {
  render: () => (
    <Controlled
      initial={recPendingSave(
        128,
        174,
        recordingStreamsSeed.slice(0, 3).map((s) => s.id),
      )}
    />
  ),
};
