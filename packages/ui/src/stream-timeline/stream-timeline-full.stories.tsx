import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { StreamEventDetail } from "./stream-event-detail";
import { StreamTimelineViewer } from "./stream-timeline-viewer";
import { StreamsPanel } from "./streams-panel";
import {
  STREAM_TIMELINE_MOCK_ANCHOR_MS,
  recordingStreamsSeed,
  streamTimelineSeed,
} from "./data";
import {
  REC_IDLE,
  type RecordingState,
  type StreamPlaybackState,
  type StreamTimelineEvent,
} from "./types";

const meta: Meta = {
  title: "StreamTimeline/Full",
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj;

function FullStory() {
  const [playback, setPlayback] = React.useState<StreamPlaybackState>("paused");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [recordingState, setRecordingState] =
    React.useState<RecordingState>(REC_IDLE);

  const selectedEvent = React.useMemo<StreamTimelineEvent | null>(() => {
    if (!selectedId) return null;
    return streamTimelineSeed.find((e) => e.id === selectedId) ?? null;
  }, [selectedId]);

  return (
    <div className="flex h-screen flex-col gap-s-3 bg-page p-s-4">
      <StreamsPanel
        recordingState={recordingState}
        streams={recordingStreamsSeed}
        onRecordingStateChange={setRecordingState}
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-s-3 lg:grid-cols-[1fr_360px]">
        <StreamTimelineViewer
          events={streamTimelineSeed}
          playback={playback}
          selectedEventId={selectedId}
          onPlaybackChange={setPlayback}
          onSelect={(e) => setSelectedId(e.eventId)}
          initialCenterMs={STREAM_TIMELINE_MOCK_ANCHOR_MS - 15 * 60 * 1000}
          initialHalfWidthMs={20 * 60 * 1000}
          toolbarLeading={<span>Chronicle / Live events</span>}
        />
        <StreamEventDetail event={selectedEvent} />
      </div>
    </div>
  );
}

/**
 * Full — composite layout that mirrors the demo/yc events page:
 * StreamsPanel on top, the StreamTimelineViewer in the middle, and
 * the StreamEventDetail card on the right driven by the viewer's
 * selection callback.
 */
export const Full: Story = {
  render: () => <FullStory />,
};
