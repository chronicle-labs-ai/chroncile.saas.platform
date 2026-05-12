import type { Meta, StoryObj } from "@storybook/react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";
import { Button } from "./button";

const meta: Meta = {
  title: "Primitives/Sheet",
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Open right sheet</Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Narrow the trace stream.</SheetDescription>
        </SheetHeader>
        <div className="px-[14px] py-[14px] font-sans text-[13px] text-l-ink-lo">
          Drop filter chips, dataset pickers, and time-range controls here.
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="secondary" size="sm">
              Done
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

export const LeftSheet: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary">Open left sheet</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Workspaces</SheetTitle>
          <SheetDescription>Switch between environments.</SheetDescription>
        </SheetHeader>
        <div className="px-[14px] py-[14px] font-sans text-[13px] text-l-ink-lo">
          Workspace list goes here.
        </div>
      </SheetContent>
    </Sheet>
  ),
};

export const BottomSheet: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost">Open bottom sheet</Button>
      </SheetTrigger>
      <SheetContent side="bottom" size="lg">
        <SheetHeader>
          <SheetTitle>Quick actions</SheetTitle>
        </SheetHeader>
        <div className="px-[14px] py-[14px] font-sans text-[13px] text-l-ink-lo">
          Bottom-sheet content for mobile-first surfaces.
        </div>
      </SheetContent>
    </Sheet>
  ),
};
