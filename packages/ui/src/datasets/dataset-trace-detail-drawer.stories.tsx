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
const otherTrace =
  trainingDatasetSnapshot.traces[1] ?? trainingDatasetSnapshot.traces[0]!;
const traceWithNote = {
  ...sampleTrace,
  note: "Captured during the 2026-04-29 Friday outage; flagged by alerts-bot for review.",
};

/* Mimics the dataset detail chassis: a row-flex container with a
 * placeholder "main" surface on the left and the inspector panel
 * sliding in from the right. */
function ChassisFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[640px] min-h-0 overflow-hidden rounded-[4px] border border-hairline-strong bg-l-surface-raised">
      {children}
    </div>
  );
}

function MainPanePlaceholder({
  selectedTraceId,
  onSelectTrace,
  toggleSlot,
}: {
  selectedTraceId: string | null;
  onSelectTrace: (id: string) => void;
  toggleSlot?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
      <div className="flex items-center gap-2">{toggleSlot}</div>
      <div className="flex-1 rounded-[3px] border border-l-border-faint bg-l-surface p-4 font-sans text-[12.5px] leading-snug text-l-ink-lo">
        <p className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.06em] text-l-ink-dim">
          Detail page placeholder
        </p>
        <ul className="flex flex-col gap-1.5">
          {trainingDatasetSnapshot.traces.slice(0, 6).map((t) => {
            const active = t.traceId === selectedTraceId;
            return (
              <li key={t.traceId}>
                <button
                  type="button"
                  onClick={() => onSelectTrace(t.traceId)}
                  className={
                    "w-full rounded-[3px] border border-l-border-faint px-2 py-1.5 text-left text-l-ink hover:bg-l-surface-hover " +
                    (active ? "bg-l-surface-selected" : "")
                  }
                >
                  <span className="block truncate text-[12.5px]">{t.label}</span>
                  <span className="block truncate font-mono text-[10.5px] text-l-ink-dim">
                    {t.traceId}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export const Default: Story = {
  render: function Render() {
    const [selected, setSelected] = React.useState<string | null>(
      sampleTrace.traceId,
    );
    const trace =
      trainingDatasetSnapshot.traces.find((t) => t.traceId === selected) ??
      null;
    return (
      <ChassisFrame>
        <MainPanePlaceholder
          selectedTraceId={selected}
          onSelectTrace={setSelected}
        />
        <DatasetTraceDetailDrawer
          isOpen={selected != null}
          onClose={() => setSelected(null)}
          snapshot={trainingDatasetSnapshot}
          trace={trace}
          onRemoveTrace={() => undefined}
          onJumpToTimeline={() => undefined}
        />
      </ChassisFrame>
    );
  },
};

export const WithNote: Story = {
  render: function Render() {
    const [open, setOpen] = React.useState(true);
    return (
      <ChassisFrame>
        <MainPanePlaceholder
          selectedTraceId={open ? traceWithNote.traceId : null}
          onSelectTrace={() => setOpen(true)}
          toggleSlot={
            <Button variant="ghost" size="sm" onPress={() => setOpen((x) => !x)}>
              Toggle inspector
            </Button>
          }
        />
        <DatasetTraceDetailDrawer
          isOpen={open}
          onClose={() => setOpen(false)}
          snapshot={trainingDatasetSnapshot}
          trace={traceWithNote}
          onRemoveTrace={() => undefined}
        />
      </ChassisFrame>
    );
  },
};

export const NoRemove: Story = {
  render: function Render() {
    const [open, setOpen] = React.useState(true);
    return (
      <ChassisFrame>
        <MainPanePlaceholder
          selectedTraceId={open ? sampleTrace.traceId : null}
          onSelectTrace={() => setOpen(true)}
          toggleSlot={
            <Button variant="ghost" size="sm" onPress={() => setOpen((x) => !x)}>
              Toggle inspector
            </Button>
          }
        />
        <DatasetTraceDetailDrawer
          isOpen={open}
          onClose={() => setOpen(false)}
          snapshot={trainingDatasetSnapshot}
          trace={sampleTrace}
        />
      </ChassisFrame>
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
      <ChassisFrame>
        <MainPanePlaceholder
          selectedTraceId={open ? traceWithoutEvents.traceId : null}
          onSelectTrace={() => setOpen(true)}
        />
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
      </ChassisFrame>
    );
  },
};

/* Demonstrates the in-place swap behavior — picking a different
 * trace updates the inspector content without remounting the chassis,
 * mirroring the StreamTimelineViewer detail-panel pattern. */
export const SwitchingBetweenTraces: Story = {
  render: function Render() {
    const [selected, setSelected] = React.useState<string | null>(
      sampleTrace.traceId,
    );
    const trace =
      trainingDatasetSnapshot.traces.find((t) => t.traceId === selected) ??
      null;
    return (
      <ChassisFrame>
        <MainPanePlaceholder
          selectedTraceId={selected}
          onSelectTrace={setSelected}
          toggleSlot={
            <Button
              variant="ghost"
              size="sm"
              onPress={() =>
                setSelected(
                  selected === sampleTrace.traceId
                    ? otherTrace.traceId
                    : sampleTrace.traceId,
                )
              }
            >
              Swap trace
            </Button>
          }
        />
        <DatasetTraceDetailDrawer
          isOpen={selected != null}
          onClose={() => setSelected(null)}
          snapshot={trainingDatasetSnapshot}
          trace={trace}
          onRemoveTrace={() => undefined}
        />
      </ChassisFrame>
    );
  },
};
