import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { AgentsToolbar, type AgentsScope } from "./agents-toolbar";
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
  const [scope, setScope] = React.useState<AgentsScope>("all");
  const [panelOpen, setPanelOpen] = React.useState(true);
  return (
    <AgentsToolbar
      query={query}
      onQueryChange={setQuery}
      selectedScope={scope}
      onScopeChange={setScope}
      panelOpen={panelOpen}
      onPanelToggle={() => setPanelOpen((prev) => !prev)}
      totalCount={5}
      onOpenHashSearch={() => undefined}
    />
  );
}

export const Default: Story = {
  render: () => <ToolbarHarness />,
};

export const PanelClosed: Story = {
  render: () => {
    const [query, setQuery] = React.useState("");
    const [scope, setScope] = React.useState<AgentsScope>("all");
    return (
      <AgentsToolbar
        query={query}
        onQueryChange={setQuery}
        selectedScope={scope}
        onScopeChange={setScope}
        panelOpen={false}
        onPanelToggle={() => undefined}
        totalCount={18}
        onOpenHashSearch={() => undefined}
      />
    );
  },
};
