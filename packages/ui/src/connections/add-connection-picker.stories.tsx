import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { Button } from "../primitives/button";
import { AddConnectionPicker } from "./add-connection-picker";

const meta: Meta<typeof AddConnectionPicker> = {
  title: "Connections/AddConnectionPicker",
  component: AddConnectionPicker,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof AddConnectionPicker>;

function PickerDemo({
  initialOpen = true,
  alreadyConnected = [],
}: {
  initialOpen?: boolean;
  alreadyConnected?: ("stripe" | "slack" | "intercom")[];
}) {
  const [open, setOpen] = React.useState(initialOpen);
  return (
    <div className="min-h-screen bg-background p-6">
      <Button onPress={() => setOpen(true)}>Open picker</Button>
      <AddConnectionPicker
        isOpen={open}
        onClose={() => setOpen(false)}
        connectedIds={alreadyConnected}
        onConnected={(c) => {
          console.log("connected", c);
          setOpen(false);
        }}
      />
    </div>
  );
}

export const Default: Story = { render: () => <PickerDemo /> };

export const WithExistingConnections: Story = {
  render: () => (
    <PickerDemo alreadyConnected={["stripe", "slack", "intercom"]} />
  ),
};
