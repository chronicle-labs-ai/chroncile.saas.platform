import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../primitives/button";

import { DatasetShortcutSheet } from "./dataset-shortcut-sheet";
import { DatasetCommandPalette } from "./dataset-command-palette";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof DatasetShortcutSheet> = {
  title: "Datasets/Keyboard layer",
  component: DatasetShortcutSheet,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DatasetShortcutSheet>;

/* The shortcut sheet rendered above an inert canvas. Press ? in the
 * full DatasetsManager story to reach it from the keyboard layer. */
export const ShortcutSheet: Story = {
  render: function Render() {
    const [open, setOpen] = React.useState(true);
    return (
      <div className="flex flex-col gap-3">
        <Button variant="primary" size="sm" onPress={() => setOpen(true)}>
          Show keyboard shortcuts
        </Button>
        <DatasetShortcutSheet open={open} onOpenChange={setOpen} />
      </div>
    );
  },
};

export const CommandPalette: Story = {
  render: function Render() {
    const [open, setOpen] = React.useState(true);
    return (
      <div className="flex flex-col gap-3">
        <Button variant="primary" size="sm" onPress={() => setOpen(true)}>
          Open command palette
        </Button>
        <DatasetCommandPalette
          open={open}
          onOpenChange={setOpen}
          onShortcut={(id) => {
            console.info("[story] palette shortcut", id);
          }}
        />
      </div>
    );
  },
};
