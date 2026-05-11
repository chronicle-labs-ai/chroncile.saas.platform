import type { Meta, StoryObj } from "@storybook/react";
import type * as React from "react";

import { LogStream } from "./log-stream";

const meta = {
  title: "Env Manager/LogStream",
  component: LogStream,
  parameters: { layout: "padded" },
  argTypes: {
    heightClassName: { control: "text" },
  },
  args: {
    heightClassName: "h-[220px]",
  },
} satisfies Meta<typeof LogStream>;

export default meta;
type Story = StoryObj<typeof LogStream>;

function LogDemo() {
  return (
    <div className="max-w-[760px] overflow-hidden rounded-md border border-hairline bg-surface-01">
      <LogStream heightClassName="h-[220px]">
        <LogStream.Line time="12:04:11" level="info">
          fetching branch info for <em>feature/invite-flow</em>
        </LogStream.Line>
        <LogStream.Line time="12:04:14" level="ok">
          branch sha resolved <em>8f3a91c</em>
        </LogStream.Line>
        <LogStream.Line time="12:04:20" level="warn">
          frontend endpoint is waiting for Vercel propagation
        </LogStream.Line>
        <LogStream.Line time="12:04:31" level="info">
          backend is healthy
        </LogStream.Line>
      </LogStream>
    </div>
  );
}

function ControlledLog(
  args: Omit<React.ComponentProps<typeof LogStream>, "children">
) {
  return (
    <div className="max-w-[760px] overflow-hidden rounded-md border border-hairline bg-surface-01">
      <LogStream {...args}>
        <LogStream.Line time="12:04:11" level="info">
          fetching branch info for <em>feature/invite-flow</em>
        </LogStream.Line>
        <LogStream.Line time="12:04:14" level="ok">
          branch sha resolved <em>8f3a91c</em>
        </LogStream.Line>
        <LogStream.Line time="12:04:20" level="warn">
          frontend endpoint is waiting for Vercel propagation
        </LogStream.Line>
      </LogStream>
    </div>
  );
}

export const Default: Story = {
  render: (args) => <ControlledLog {...args} />,
};

export const LogList: Story = {
  render: () => <LogDemo />,
};
