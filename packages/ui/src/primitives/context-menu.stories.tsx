import type { Meta, StoryObj } from "@storybook/react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "./context-menu";

const meta: Meta = {
  title: "Primitives/ContextMenu",
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger
        className="flex h-[160px] w-[420px] cursor-context-menu items-center justify-center rounded-md border border-dashed border-hairline-strong bg-l-surface-input font-sans text-[13px] text-l-ink-lo"
      >
        Right-click anywhere in this region.
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>Run #4829</ContextMenuLabel>
        <ContextMenuItem>
          Open
          <ContextMenuShortcut>⏎</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          Copy ID
          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>Move to environment</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem>Staging</ContextMenuItem>
            <ContextMenuItem>Production</ContextMenuItem>
            <ContextMenuItem>Sandbox</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive">
          Delete
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
};
