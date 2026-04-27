import type { Meta, StoryObj } from "@storybook/react";
import { Popover, PopoverTrigger, PopoverContent } from "./popover";
import { Button } from "./button";

const meta: Meta = {
  title: "Primitives/Popover",
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger>
        <Button>Open popover</Button>
      </PopoverTrigger>
      <PopoverContent placement="bottom">
        <div className="p-s-4 w-[260px]">
          <p className="font-sans text-sm text-ink">
            A popover renders above the page and closes on outside click or
            escape. Focus is trapped while open.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export const WithArrow: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger>
        <Button variant="ember">Release settings</Button>
      </PopoverTrigger>
      <PopoverContent placement="top" showArrow>
        <div className="p-s-3">Pointing arrow mode</div>
      </PopoverContent>
    </Popover>
  ),
};
