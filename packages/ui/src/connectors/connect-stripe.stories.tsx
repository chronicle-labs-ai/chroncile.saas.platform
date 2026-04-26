import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { ConnectStripe } from "./connect-stripe";
import { Button } from "../primitives/button";
import { getSource } from "../onboarding/data";

const meta: Meta<typeof ConnectStripe> = {
  title: "Connectors/ConnectStripe",
  component: ConnectStripe,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof ConnectStripe>;

function DefaultDemo() {
  const [open, setOpen] = React.useState(true);
  return (
    <>
      <div className="p-s-6">
        <Button onPress={() => setOpen(true)}>Open Stripe modal</Button>
      </div>
      {open ? (
        <ConnectStripe
          source={getSource("stripe")!}
          onClose={() => setOpen(false)}
          onDone={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export const Default: Story = { render: () => <DefaultDemo /> };
