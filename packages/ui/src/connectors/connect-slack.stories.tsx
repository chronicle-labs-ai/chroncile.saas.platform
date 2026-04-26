import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { ConnectSlack } from "./connect-slack";
import { Button } from "../primitives/button";
import { getSource } from "../onboarding/data";

const meta: Meta<typeof ConnectSlack> = {
  title: "Connectors/ConnectSlack",
  component: ConnectSlack,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof ConnectSlack>;

function DefaultDemo() {
  const [open, setOpen] = React.useState(true);
  return (
    <>
      <div className="p-s-6">
        <Button onPress={() => setOpen(true)}>Open Slack modal</Button>
      </div>
      {open ? (
        <ConnectSlack
          source={getSource("slack")!}
          onClose={() => setOpen(false)}
          onDone={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export const Default: Story = { render: () => <DefaultDemo /> };
