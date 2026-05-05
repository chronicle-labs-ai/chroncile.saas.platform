import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../primitives/button";
import { InviteMemberModal } from "./invite-member-modal";

const meta: Meta<typeof InviteMemberModal> = {
  title: "Team/InviteMemberModal",
  component: InviteMemberModal,
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof InviteMemberModal>;

function Demo({ withError = false }: { withError?: boolean }) {
  const [open, setOpen] = React.useState(true);
  return (
    <div className="flex flex-col items-start gap-s-3">
      <Button variant="primary" onPress={() => setOpen(true)}>
        Open invite modal
      </Button>
      <InviteMemberModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onSubmit={() => setOpen(false)}
        error={withError ? "We couldn't send the invitation. Try again." : null}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <Demo />,
};

export const WithBannerError: Story = {
  render: () => <Demo withError />,
};
