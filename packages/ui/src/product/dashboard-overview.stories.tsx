import type { Meta, StoryObj } from "@storybook/react";

import { DashboardOverview, dashboardOverviewSeed } from "./dashboard-overview";

const meta = {
  title: "Product/DashboardOverview",
  component: DashboardOverview,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof DashboardOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="min-h-screen bg-background p-4">
      <DashboardOverview data={dashboardOverviewSeed} />
    </div>
  ),
};

export const DenseData: Story = {
  render: () => (
    <div className="min-h-screen bg-background p-4">
      <DashboardOverview
        data={{
          ...dashboardOverviewSeed,
          range: "Last 60m",
          metrics: [
            { label: "Events / hour", value: "3,904", delta: "+ 41" },
            { label: "Active traces", value: "18", delta: "Live", tone: "green" },
            { label: "Interventions", value: "7", delta: "Review", tone: "ember" },
            { label: "Last backtest", value: "71.4%", delta: "Warn", tone: "amber" },
          ],
        }}
      />
    </div>
  ),
};
