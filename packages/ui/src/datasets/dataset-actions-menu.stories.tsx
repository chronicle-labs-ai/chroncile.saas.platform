import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { datasetsManagerSeed } from "./data";
import { DatasetActionsMenu } from "./dataset-actions-menu";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof DatasetActionsMenu> = {
  title: "Datasets/DatasetActionsMenu",
  component: DatasetActionsMenu,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md">
        <div className="flex items-start gap-4">
          <Story />
        </div>
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DatasetActionsMenu>;

const evalDataset = datasetsManagerSeed.find((d) => d.purpose === "eval")!;

export const Default: Story = {
  render: function Render() {
    const [last, setLast] = React.useState<string | null>(null);
    return (
      <div className="flex items-center gap-3">
        <DatasetActionsMenu
          dataset={evalDataset}
          onOpen={(id) => setLast(`open ${id}`)}
          onEdit={(id) => setLast(`edit ${id}`)}
          onDuplicate={(id) => setLast(`duplicate ${id}`)}
          onCopyId={(id) => setLast(`copyId ${id}`)}
          onDelete={(id) => setLast(`delete ${id}`)}
        />
        <span className="font-mono text-[11px] text-l-ink-dim">
          {last ?? "no action yet"}
        </span>
      </div>
    );
  },
};
