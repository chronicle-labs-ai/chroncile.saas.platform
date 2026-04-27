import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { Drawer } from "./drawer";
import { Button } from "./button";

const meta: Meta<typeof Drawer> = {
  title: "Primitives/Drawer",
  component: Drawer,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof Drawer>;

const DrawerDemo = ({
  placement,
}: {
  placement?: "left" | "right" | "top" | "bottom";
}) => {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onPress={() => setOpen(true)}>Open drawer</Button>
      <Drawer
        isOpen={open}
        onClose={() => setOpen(false)}
        title={`Drawer (${placement ?? "right"})`}
        placement={placement}
        actions={
          <>
            <Button variant="ghost" onPress={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onPress={() => setOpen(false)}>
              Save
            </Button>
          </>
        }
      >
        <p>
          Drawers slide in from the edge of the viewport. ESC, outside click,
          and the close button all dismiss.
        </p>
      </Drawer>
    </>
  );
};

export const Right: Story = { render: () => <DrawerDemo placement="right" /> };
export const Left: Story = { render: () => <DrawerDemo placement="left" /> };
export const Bottom: Story = {
  render: () => <DrawerDemo placement="bottom" />,
};
