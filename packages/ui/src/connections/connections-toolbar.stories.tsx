import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { ConnectionsToolbar, type ConnectionsView } from "./connections-toolbar";
import { type ConnectionHealth } from "./data";

const meta: Meta<typeof ConnectionsToolbar> = {
  title: "Connections/ConnectionsToolbar",
  component: ConnectionsToolbar,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof ConnectionsToolbar>;

function ToolbarDemo({ initialView = "list" }: { initialView?: ConnectionsView }) {
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<ConnectionsView>(initialView);
  const [selected, setSelected] = React.useState<ConnectionHealth[]>([]);

  return (
    <div className="bg-background p-6">
      <ConnectionsToolbar
        query={query}
        onQueryChange={setQuery}
        view={view}
        onViewChange={setView}
        selectedHealth={selected}
        onHealthToggle={(h) =>
          setSelected((cur) =>
            cur.includes(h) ? cur.filter((x) => x !== h) : [...cur, h],
          )
        }
        totalCount={12}
        onAdd={() => console.log("add")}
      />
    </div>
  );
}

export const ListView: Story = { render: () => <ToolbarDemo initialView="list" /> };
export const GridView: Story = { render: () => <ToolbarDemo initialView="grid" /> };
export const NoAdd: Story = {
  render: () => {
    const [query, setQuery] = React.useState("stripe");
    const [view, setView] = React.useState<ConnectionsView>("list");
    const [selected, setSelected] = React.useState<ConnectionHealth[]>(["live"]);
    return (
      <div className="bg-background p-6">
        <ConnectionsToolbar
          query={query}
          onQueryChange={setQuery}
          view={view}
          onViewChange={setView}
          selectedHealth={selected}
          onHealthToggle={(h) =>
            setSelected((cur) =>
              cur.includes(h) ? cur.filter((x) => x !== h) : [...cur, h],
            )
          }
          hideAdd
          totalCount={12}
        />
      </div>
    );
  },
};
