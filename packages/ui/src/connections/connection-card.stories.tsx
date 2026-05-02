import type { Meta, StoryObj } from "@storybook/react";

import { ConnectionCard } from "./connection-card";
import { connectionsSeed } from "./data";

const meta: Meta<typeof ConnectionCard> = {
  title: "Connections/ConnectionCard",
  component: ConnectionCard,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof ConnectionCard>;

export const Grid: Story = {
  render: () => (
    <div className="bg-background p-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {connectionsSeed.map((c) => (
          <ConnectionCard
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {connectionsSeed.slice(0, 3).map((c, i) => (
          <ConnectionCard
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
