import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { AgentsToolbar, type AgentHealthFilter } from "./agents-toolbar";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof AgentsToolbar> = {
  title: "Agents/AgentsToolbar",
  component: AgentsToolbar,
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="900px">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentsToolbar>;

function ToolbarHarness() {
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<"list" | "grid">("grid");
  const [health, setHealth] = React.useState<AgentHealthFilter[]>(["healthy"]);
  return (
    <AgentsToolbar
      query={query}
      onQueryChange={setQuery}
      view={view}
      onViewChange={setView}
      selectedHealth={health}
      onHealthToggle={(h) =>
        setHealth((cur) =>
          cur.includes(h) ? cur.filter((x) => x !== h) : [...cur, h],
        )
      }
      totalCount={5}
      onOpenHashSearch={() => undefined}
    />
  );
}

export const Default: Story = {
  render: () => <ToolbarHarness />,
};
