import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { Button } from "./button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./command";

const meta: Meta = {
  title: "Primitives/Command",
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj;

export const Inline: Story = {
  render: () => (
    <div className="w-[480px]">
      <Command>
        <CommandInput placeholder="Search runs, datasets, agents…" />
        <CommandList>
          <CommandEmpty>No matches.</CommandEmpty>
          <CommandGroup heading="Recent">
            <CommandItem>
              Open run #4829
              <CommandShortcut>⏎</CommandShortcut>
            </CommandItem>
            <CommandItem>Open run #4828</CommandItem>
            <CommandItem>Open run #4827</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Workspaces">
            <CommandItem>
              Switch to staging
              <CommandShortcut>⌘⇧S</CommandShortcut>
            </CommandItem>
            <CommandItem>Switch to production</CommandItem>
          </CommandGroup>
          <CommandGroup heading="Actions">
            <CommandItem>New backtest</CommandItem>
            <CommandItem>New dataset</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  ),
};

const DialogDemo = () => {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return (
    <div className="flex flex-col gap-s-3">
      <Button onPress={() => setOpen(true)}>Open command palette</Button>
      <span className="font-mono text-mono-sm text-l-ink-dim">
        Or press ⌘K / Ctrl+K
      </span>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search…" />
        <CommandList>
          <CommandEmpty>No matches.</CommandEmpty>
          <CommandGroup heading="Suggested">
            <CommandItem onSelect={() => setOpen(false)}>
              Run last backtest
              <CommandShortcut>⏎</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => setOpen(false)}>
              View today's signal
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
};

export const Dialog: Story = {
  render: () => <DialogDemo />,
};
