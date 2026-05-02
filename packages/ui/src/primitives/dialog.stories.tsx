import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogXClose,
} from "./dialog";

const meta: Meta = {
  title: "Primitives/Dialog",
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save scenario</DialogTitle>
          <DialogXClose />
        </DialogHeader>
        <DialogBody>
          <DialogDescription>
            Save this trace as a named scenario in the replay suite. You can
            attach it to a backtest later.
          </DialogDescription>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary">Cancel</Button>
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
