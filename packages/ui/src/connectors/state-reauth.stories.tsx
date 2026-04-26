import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { StateReauth } from "./state-reauth";
import { getSource } from "../onboarding/data";

const meta: Meta<typeof StateReauth> = {
  title: "Connectors/StateReauth",
  component: StateReauth,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof StateReauth>;

function DefaultDemo() {
  const [open, setOpen] = React.useState(true);
  return (
    <StateReauth
      isOpen={open}
      onClose={() => setOpen(false)}
      source={getSource("salesforce")!}
      expiredAt="14 minutes ago"
      onReauth={() => setOpen(false)}
    />
  );
}

export const Default: Story = { render: () => <DefaultDemo /> };
