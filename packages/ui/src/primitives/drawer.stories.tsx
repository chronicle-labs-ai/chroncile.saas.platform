import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { Drawer } from "./drawer";
import { Button } from "./button";

/*
 * Drawer is now backed by `vaul` — drag-to-dismiss, optional snap
 * points, and a touch-first handle bar are wired in. The declarative
 * `<Drawer isOpen onClose title actions placement size>` API is
 * unchanged for existing call sites; the new props (`showHandle`,
 * `snapPoints`, `handleOnly`, `repositionInputs`, `closeThreshold`,
 * `shouldScaleBackground`) opt into Vaul-specific behavior.
 */

const meta: Meta<typeof Drawer> = {
  title: "Primitives/Drawer",
  component: Drawer,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof Drawer>;

const DrawerDemo = ({
  placement,
  ...rest
}: {
  placement?: "left" | "right" | "top" | "bottom";
} & Partial<React.ComponentProps<typeof Drawer>>) => {
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
        {...rest}
      >
        <p>
          Drawers slide in from the edge of the viewport. Drag past the
          threshold (or click outside, or hit Escape) to dismiss.
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

export const BottomWithSnapPoints: Story = {
  name: "Bottom · snap points",
  render: () => (
    <DrawerDemo
      placement="bottom"
      snapPoints={["140px", 0.5, 1]}
      fadeFromIndex={1}
    />
  ),
};

export const HandleOnly: Story = {
  name: "Handle-only drag",
  render: () => (
    <DrawerDemo
      placement="bottom"
      handleOnly
      snapPoints={["180px", 0.6]}
    />
  ),
};

export const NotDismissable: Story = {
  name: "Locked open",
  render: () => <DrawerDemo placement="right" isDismissable={false} />,
};
