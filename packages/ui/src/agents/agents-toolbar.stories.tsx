import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import {
  AgentsToolbar,
  type AgentsGroupBy,
} from "./agents-toolbar";
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
  const [groupBy, setGroupBy] = React.useState<AgentsGroupBy>("purpose");
  return (
    <AgentsToolbar
      query={query}
      onQueryChange={setQuery}
      view={view}
      onViewChange={setView}
      groupBy={groupBy}
      onGroupByChange={setGroupBy}
      totalCount={5}
      onOpenHashSearch={() => undefined}
    />
  );
}

export const Default: Story = {
  render: () => <ToolbarHarness />,
};
