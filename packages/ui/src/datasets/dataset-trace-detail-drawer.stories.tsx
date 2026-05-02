import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../primitives/button";

import { trainingDatasetSnapshot } from "./data";
import { DatasetTraceDetailDrawer } from "./dataset-trace-detail-drawer";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof DatasetTraceDetailDrawer> = {
  title: "Datasets/DatasetTraceDetailDrawer",
  component: DatasetTraceDetailDrawer,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DatasetTraceDetailDrawer>;

const sampleTrace = trainingDatasetSnapshot.traces[0]!;
const traceWithNote = {
  ...sampleTrace,
  note: "Captured during the 2026-04-29 Friday outage; flagged by alerts-bot for review.",
};

export const Default: Story = {
  render: function Render() {
    const [open, setOpen] = React.useState(true);
    return (
      <div className="flex flex-col gap-3">
        <Button density="compact" variant="primary" onPress={() => setOpen(true)}>
          Open trace drawer
        </Button>
        <DatasetTraceDetailDrawer
          isOpen={open}
          onClose={() => setOpen(false)}
          snapshot={trainingDatasetSnapshot}
          trace={sampleTrace}
          onRemoveTrace={() => undefined}
          onJumpToTimeline={() => undefined}
        />
      </div>
    );
  },
};

export const WithNote: Story = {
  render: function Render() {
    const [open, setOpen] = React.useState(true);
    return (
      <DatasetTraceDetailDrawer
        isOpen={open}
        onClose={() => setOpen(false)}
        snapshot={trainingDatasetSnapshot}
        trace={traceWithNote}
        onRemoveTrace={() => undefined}
      />
    );
  },
};

export const NoRemove: Story = {
  render: function Render() {
    const [open, setOpen] = React.useState(true);
    return (
      <DatasetTraceDetailDrawer
        isOpen={open}
        onClose={() => setOpen(false)}
        snapshot={trainingDatasetSnapshot}
        trace={sampleTrace}
      />
    );
  },
};

export const TraceWithoutEvents: Story = {
  render: function Render() {
    const [open, setOpen] = React.useState(true);
    const traceWithoutEvents = {
      ...sampleTrace,
      traceId: "trace_no_events",
    };
    return (
      <DatasetTraceDetailDrawer
        isOpen={open}
        onClose={() => setOpen(false)}
        snapshot={{
          ...trainingDatasetSnapshot,
          events: [],
        }}
        trace={traceWithoutEvents}
        onRemoveTrace={() => undefined}
      />
    );
  },
};
