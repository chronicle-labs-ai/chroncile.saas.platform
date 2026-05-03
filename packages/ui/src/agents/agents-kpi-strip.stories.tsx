import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { AgentsKpiStrip } from "./agents-kpi-strip";
import { agentsManagerSeed } from "./data";
import { ProductChromeFrame } from "./_story-frame";
import type { AgentHealthFilter } from "./agents-toolbar";

const meta: Meta<typeof AgentsKpiStrip> = {
  title: "Agents/AgentsKpiStrip",
  component: AgentsKpiStrip,
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="900px">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentsKpiStrip>;

function KpiStripHarness({
  initialSelected = [],
}: {
  initialSelected?: readonly AgentHealthFilter[];
}) {
  const [selected, setSelected] =
    React.useState<readonly AgentHealthFilter[]>(initialSelected);

  return (
    <AgentsKpiStrip
      agents={agentsManagerSeed}
      selected={selected}
      onToggle={(f) =>
        setSelected((cur) =>
          cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f],
        )
      }
    />
  );
}

export const Default: Story = {
  render: () => <KpiStripHarness />,
};

export const HealthySelected: Story = {
  render: () => <KpiStripHarness initialSelected={["healthy"]} />,
};

export const DriftingSelected: Story = {
  render: () => <KpiStripHarness initialSelected={["drifting"]} />,
};

export const Empty: Story = {
  render: () => (
    <AgentsKpiStrip agents={[]} selected={[]} onToggle={() => undefined} />
  ),
};
