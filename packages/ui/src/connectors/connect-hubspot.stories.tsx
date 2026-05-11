import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { ConnectHubSpot } from "./connect-hubspot";
import { Button } from "../primitives/button";
import { getSource } from "../onboarding/data";

const meta: Meta<typeof ConnectHubSpot> = {
  title: "Connectors/ConnectHubSpot",
  component: ConnectHubSpot,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof ConnectHubSpot>;

function DefaultDemo() {
  const [open, setOpen] = React.useState(true);
  return (
    <>
      <div className="p-s-6">
        <Button onPress={() => setOpen(true)}>Open HubSpot wizard</Button>
      </div>
      {open ? (
        <ConnectHubSpot
          source={getSource("hubspot")!}
          onClose={() => setOpen(false)}
          onDone={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export const Default: Story = { render: () => <DefaultDemo /> };
