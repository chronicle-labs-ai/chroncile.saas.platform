import type { Meta, StoryObj } from "@storybook/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSection,
  DropdownMenuSeparator,
} from "./dropdown-menu";
import { Button } from "./button";

const meta: Meta = {
  title: "Primitives/DropdownMenu",
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button>Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onAction={() => console.log("open")}>
          Open
        </DropdownMenuItem>
        <DropdownMenuItem onAction={() => console.log("duplicate")}>
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem danger onAction={() => console.log("delete")}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const WithSections: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="secondary">Run</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuSection title="Execute">
          <DropdownMenuItem>Run now</DropdownMenuItem>
          <DropdownMenuItem>Run against sandbox</DropdownMenuItem>
          <DropdownMenuItem>Schedule…</DropdownMenuItem>
        </DropdownMenuSection>
        <DropdownMenuSection title="Danger">
          <DropdownMenuItem danger>Block deploy</DropdownMenuItem>
        </DropdownMenuSection>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
