import type { Meta, StoryObj } from "@storybook/react";
import { Status, type StatusKind } from "./status";

const kinds: StatusKind[] = [
  "backlog",
  "todo",
  "inprogress",
  "done",
  "canceled",
];

const meta: Meta<typeof Status> = {
  title: "Primitives/Status",
  component: Status,
  parameters: { layout: "centered" },
  args: { kind: "inprogress" },
};
export default meta;
type Story = StoryObj<typeof Status>;

export const Default: Story = {};

export const AllKinds: Story = {
  render: () => (
    <div className="flex items-center gap-s-5">
      {kinds.map((k) => (
        <div key={k} className="flex flex-col items-center gap-s-2">
          <Status kind={k} />
          <span className="font-mono text-mono-sm uppercase tracking-tactical text-l-ink-dim">
            {k}
          </span>
        </div>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-s-4">
      <Status kind="done" size={10} />
      <Status kind="done" size={14} />
      <Status kind="done" size={18} />
      <Status kind="done" size={24} />
    </div>
  ),
};
