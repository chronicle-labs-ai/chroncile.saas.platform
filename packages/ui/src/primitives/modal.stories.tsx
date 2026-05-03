import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { Modal, ConfirmModal } from "./modal";
import { Button } from "./button";

/*
 * @deprecated The declarative `<Modal>` and `<ConfirmModal>` APIs are
 * retained for the in-flight call sites that haven't migrated yet. New
 * code should reach for `<Dialog>` (non-destructive — see
 * "Primitives/Dialog") or `<AlertDialog>` (destructive — see
 * "Primitives/AlertDialog").
 */

const meta: Meta<typeof Modal> = {
  title: "Primitives/Modal (legacy)",
  component: Modal,
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof Modal>;

export const Basic: Story = {
  render: () => {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open modal</Button>
        <Modal
          isOpen={open}
          onClose={() => setOpen(false)}
          title="Save scenario"
          actions={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setOpen(false)}>Save</Button>
            </>
          }
        >
          Save this trace as a named scenario in the replay suite?
        </Modal>
      </>
    );
  },
};

export const Confirm: Story = {
  render: () => {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <Button variant="critical" onClick={() => setOpen(true)}>
          Block deploy
        </Button>
        <ConfirmModal
          isOpen={open}
          onClose={() => setOpen(false)}
          onConfirm={() => setOpen(false)}
          title="Block deploy?"
          message="This will hold the candidate version in staging until the divergence is classified."
          confirmText="Block"
          variant="danger"
        />
      </>
    );
  },
};
