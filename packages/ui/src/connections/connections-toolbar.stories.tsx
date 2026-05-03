import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import * as React from "react";

import {
  ConnectionsToolbar,
  type ConnectionsView,
} from "./connections-toolbar";
import { type ConnectionHealth } from "./data";

const meta: Meta<typeof ConnectionsToolbar> = {
  title: "Connections/ConnectionsToolbar",
  component: ConnectionsToolbar,
  parameters: { layout: "fullscreen" },
  args: { totalCount: 12, hideAdd: false, onAdd: fn() },
  argTypes: {
    hideAdd: { control: "boolean" },
    totalCount: { control: { type: "number", min: 0 } },
  },
};
export default meta;
type Story = StoryObj<typeof ConnectionsToolbar>;

function Demo({
  initialView = "list",
  initialQuery = "",
  initialFilters = [],
  hideAdd,
  totalCount,
  onAdd,
}: {
  initialView?: ConnectionsView;
  initialQuery?: string;
  initialFilters?: ConnectionHealth[];
  hideAdd?: boolean;
  totalCount?: number;
  onAdd?: () => void;
}) {
  const [query, setQuery] = React.useState(initialQuery);
  const [view, setView] = React.useState<ConnectionsView>(initialView);
  const [selected, setSelected] =
    React.useState<ConnectionHealth[]>(initialFilters);

  return (
    <div className="bg-page p-6">
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
        totalCount={totalCount}
        hideAdd={hideAdd}
        onAdd={onAdd}
      />
    </div>
  );
}

/**
 * Playground — fully wired toolbar with stateful query + filters +
 * view. Tweak `hideAdd` and `totalCount` from the Controls panel.
 */
export const Playground: Story = {
  render: (args) => (
    <Demo
      hideAdd={args.hideAdd}
      totalCount={args.totalCount}
      onAdd={args.onAdd}
    />
  ),
};

/**
 * List view — default landing surface. View segment shows `list`
 * pressed; the chip rail starts unfiltered.
 */
export const ListView: Story = {
  render: (args) => (
    <Demo
      initialView="list"
      hideAdd={args.hideAdd}
      totalCount={args.totalCount}
      onAdd={args.onAdd}
    />
  ),
};

/**
 * Grid view — same toolbar, view segment defaulted to `grid`. Used
 * when the dashboard renders the card layout.
 */
export const GridView: Story = {
  render: (args) => (
    <Demo
      initialView="grid"
      hideAdd={args.hideAdd}
      totalCount={args.totalCount}
      onAdd={args.onAdd}
    />
  ),
};

/**
 * Pre-filtered — landing on the toolbar with an active search query and
 * an active "Live" chip. Confirms the chip's active border + the
 * search input's prefilled state co-exist visually.
 */
export const Prefiltered: Story = {
  render: (args) => (
    <Demo
      initialView="list"
      initialQuery="stripe"
      initialFilters={["live"]}
      hideAdd={args.hideAdd}
      totalCount={args.totalCount}
      onAdd={args.onAdd}
    />
  ),
};

/**
 * No add — `hideAdd` set; the right side collapses to just the
 * view-switcher segment. Used in shared/read-only contexts where the
 * tenant cannot add connections.
 */
export const NoAdd: Story = {
  render: (args) => (
    <Demo
      hideAdd
      initialQuery="stripe"
      initialFilters={["live"]}
      totalCount={args.totalCount}
    />
  ),
};
