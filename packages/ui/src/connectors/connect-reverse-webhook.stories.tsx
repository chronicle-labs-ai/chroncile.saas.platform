import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { ConnectReverseWebhook } from "./connect-reverse-webhook";
import { Button } from "../primitives/button";
import { getSource } from "../onboarding/data";

const meta: Meta<typeof ConnectReverseWebhook> = {
  title: "Connectors/ConnectReverseWebhook",
  component: ConnectReverseWebhook,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof ConnectReverseWebhook>;

function AwaitingDemo() {
  const [open, setOpen] = React.useState(true);
  return (
    <>
      <div className="p-s-6">
        <Button onPress={() => setOpen(true)}>Open webhook modal</Button>
      </div>
      {open ? (
        <ConnectReverseWebhook
          source={getSource("webhooks")!}
          onClose={() => setOpen(false)}
          onDone={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function ReceivedDemo() {
  const [open, setOpen] = React.useState(true);
  return open ? (
    <ConnectReverseWebhook
      source={getSource("webhooks")!}
      onClose={() => setOpen(false)}
      onDone={() => setOpen(false)}
      forceReceived
    />
  ) : (
    <div className="p-s-6">
      <Button onPress={() => setOpen(true)}>Reopen</Button>
    </div>
  );
}

export const Awaiting: Story = { render: () => <AwaitingDemo /> };
export const Received: Story = { render: () => <ReceivedDemo /> };
