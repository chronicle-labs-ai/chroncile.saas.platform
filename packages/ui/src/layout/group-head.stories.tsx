import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { GroupHead } from "./group-head";
import { Status } from "../primitives/status";

const meta: Meta<typeof GroupHead> = {
  title: "Layout/GroupHead",
  component: GroupHead,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof GroupHead>;

export const Default: Story = {
  render: () => (
    <div className="w-[800px] border border-hairline-strong bg-l-surface">
      <GroupHead>
        <Status kind="inprogress" />
        <span>In progress</span>
        <GroupHead.Count>4</GroupHead.Count>
      </GroupHead>
      <div className="px-s-4 py-s-3 text-[13px] text-l-ink-lo">
        …rows go here…
      </div>
    </div>
  ),
};

export const Toggleable: Story = {
  render: () => {
    function Demo() {
      const [openA, setOpenA] = React.useState(true);
      const [openB, setOpenB] = React.useState(false);
      return (
        <div className="w-[800px] border border-hairline-strong bg-l-surface">
          <GroupHead expanded={openA} onToggle={setOpenA}>
            <Status kind="todo" />
            <span>Todo</span>
            <GroupHead.Count>12</GroupHead.Count>
          </GroupHead>
          {openA ? (
            <div className="px-s-4 py-s-3 text-[13px] text-l-ink-lo">
              …12 rows…
            </div>
          ) : null}
          <GroupHead expanded={openB} onToggle={setOpenB}>
            <Status kind="done" />
            <span>Done</span>
            <GroupHead.Count>26</GroupHead.Count>
            <GroupHead.Spacer />
            <span className="font-mono text-[10.5px] text-l-ink-dim">
              this week
            </span>
          </GroupHead>
          {openB ? (
            <div className="px-s-4 py-s-3 text-[13px] text-l-ink-lo">
              …26 rows…
            </div>
          ) : null}
        </div>
      );
    }
    return <Demo />;
  },
};
