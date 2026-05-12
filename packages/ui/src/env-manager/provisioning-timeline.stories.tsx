import type { Meta, StoryObj } from "@storybook/react";
import type * as React from "react";

import { LogStream } from "./log-stream";
import { ProvisioningTimeline } from "./provisioning-timeline";

const meta = {
  title: "Env Manager/ProvisioningTimeline",
  component: ProvisioningTimeline,
  parameters: { layout: "padded" },
  argTypes: {
    title: { control: "text" },
    meta: { control: "text" },
  },
  args: {
    title: "Provisioning...",
    meta: "4/8 steps",
  },
} satisfies Meta<typeof ProvisioningTimeline>;

export default meta;
type Story = StoryObj<typeof ProvisioningTimeline>;

function TimelineDemo() {
  return (
    <div className="max-w-[720px]">
      <ProvisioningTimeline title="Provisioning..." meta="4/8 steps">
        <ProvisioningTimeline.Step
          status="done"
          label="Fetch Branch Info"
          description="github branch sha resolved"
          time="1.2s"
        />
        <ProvisioningTimeline.Step
          status="done"
          label="Create Postgres Cluster"
          description="reusing warm cluster template"
          time="14.8s"
        />
        <ProvisioningTimeline.Step
          status="active"
          label="Configure Vercel"
          description="setting frontend environment variables"
          time="running..."
        >
          <LogStream heightClassName="max-h-32">
            <LogStream.Line time="12:04:20" level="info">
              setting <em>NEXT_PUBLIC_API_URL</em>
            </LogStream.Line>
            <LogStream.Line time="12:04:24" level="warn">
              waiting for deployment propagation
            </LogStream.Line>
          </LogStream>
        </ProvisioningTimeline.Step>
        <ProvisioningTimeline.Step
          status="pending"
          label="Wait for Healthy"
          description="backend and frontend health checks"
          isLast
        />
      </ProvisioningTimeline>
    </div>
  );
}

function ControlledTimeline(
  args: Omit<React.ComponentProps<typeof ProvisioningTimeline>, "children">
) {
  return (
    <div className="max-w-[720px]">
      <ProvisioningTimeline {...args}>
        <ProvisioningTimeline.Step
          status="done"
          label="Fetch Branch Info"
          description="github branch sha resolved"
          time="1.2s"
        />
        <ProvisioningTimeline.Step
          status="active"
          label="Configure Vercel"
          description="setting frontend environment variables"
          time="running..."
        />
        <ProvisioningTimeline.Step
          status="pending"
          label="Wait for Healthy"
          description="backend and frontend health checks"
          isLast
        />
      </ProvisioningTimeline>
    </div>
  );
}

export const Default: Story = {
  render: (args) => <ControlledTimeline {...args} />,
};

export const WithExpandedLogs: Story = {
  render: () => <TimelineDemo />,
};
