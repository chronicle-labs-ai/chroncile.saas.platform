import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { ConnectShared } from "./connect-shared";
import { Button } from "../primitives/button";
import { getSource, type SourceId } from "../onboarding/data";

const meta: Meta<typeof ConnectShared> = {
  title: "Connectors/ConnectShared",
  component: ConnectShared,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof ConnectShared>;

function OauthDemo() {
  const [open, setOpen] = React.useState(true);
  return (
    <>
      <div className="p-s-6">
        <Button onPress={() => setOpen(true)}>Open Intercom modal</Button>
      </div>
      {open ? (
        <ConnectShared
          source={getSource("intercom")!}
          onClose={() => setOpen(false)}
          onDone={(id: SourceId) => {
            console.log("done", id);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function ApiKeyDemo() {
  const [open, setOpen] = React.useState(true);
  return open ? (
    <ConnectShared
      source={getSource("segment")!}
      onClose={() => setOpen(false)}
      onDone={() => setOpen(false)}
    />
  ) : (
    <div className="p-s-6">
      <Button onPress={() => setOpen(true)}>Reopen</Button>
    </div>
  );
}

function WebhookDemo() {
  const [open, setOpen] = React.useState(true);
  return open ? (
    <ConnectShared
      source={getSource("webhooks")!}
      onClose={() => setOpen(false)}
      onDone={() => setOpen(false)}
    />
  ) : (
    <div className="p-s-6">
      <Button onPress={() => setOpen(true)}>Reopen</Button>
    </div>
  );
}

export const Oauth: Story = { render: () => <OauthDemo /> };
export const ApiKey: Story = { render: () => <ApiKeyDemo /> };
export const Webhook: Story = { render: () => <WebhookDemo /> };
