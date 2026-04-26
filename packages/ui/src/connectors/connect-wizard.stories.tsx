import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { ConnectWizard } from "./connect-wizard";
import { Button } from "../primitives/button";
import { getSource } from "../onboarding/data";

const meta: Meta<typeof ConnectWizard> = {
  title: "Connectors/ConnectWizard",
  component: ConnectWizard,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof ConnectWizard>;

function SalesforceDemo() {
  const [open, setOpen] = React.useState(true);
  return (
    <>
      <div className="p-s-6">
        <Button onPress={() => setOpen(true)}>Open Salesforce wizard</Button>
      </div>
      {open ? (
        <ConnectWizard
          source={getSource("salesforce")!}
          onClose={() => setOpen(false)}
          onDone={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export const Salesforce: Story = { render: () => <SalesforceDemo /> };
