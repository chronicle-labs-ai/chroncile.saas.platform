import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { ConnectionRow } from "./connection-row";
import { connectionsSeed } from "./data";

const meta: Meta<typeof ConnectionRow> = {
  title: "Connections/ConnectionRow",
  component: ConnectionRow,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof ConnectionRow>;

const Header = () => (
  <div className="grid grid-cols-[36px_minmax(0,1.4fr)_120px_minmax(0,0.8fr)_minmax(0,0.7fr)_72px_36px] items-center gap-3 px-3 pb-2 text-mono-sm font-mono uppercase tracking-tactical text-ink-dim">
    <span />
    <span>Connection</span>
    <span>Health</span>
    <span>Volume</span>
    <span>Trend</span>
    <span>Scopes</span>
    <span />
  </div>
);

export const AllStates: Story = {
  render: () => (
    <div className="bg-background p-6">
      <Header />
      <div className="flex flex-col gap-2">
        {connectionsSeed.map((c) => (
          <ConnectionRow
            key={c.id}
            connection={c}
            onOpen={(id) => console.log("open", id)}
            onPause={(id) => console.log("pause", id)}
            onResume={(id) => console.log("resume", id)}
            onReauth={(id) => console.log("reauth", id)}
            onTest={(id) => console.log("test", id)}
            onSettings={(id) => console.log("settings", id)}
            onDisconnect={(id) => console.log("disconnect", id)}
          />
        ))}
      </div>
    </div>
  ),
};

export const Active: Story = {
  render: () => (
    <div className="bg-background p-6">
      <Header />
      <div className="flex flex-col gap-2">
        {connectionsSeed.slice(0, 3).map((c, i) => (
          <ConnectionRow
            key={c.id}
            connection={c}
            isActive={i === 1}
            onOpen={() => undefined}
          />
        ))}
      </div>
    </div>
  ),
};

export const Minimal: Story = {
  render: () => (
    <div className="bg-background p-6">
      <ConnectionRow connection={connectionsSeed[0]!} />
    </div>
  ),
};
