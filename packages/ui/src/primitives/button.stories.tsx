import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import { Kbd } from "./kbd";

const meta: Meta<typeof Button> = {
  title: "Primitives/Button",
  component: Button,
  parameters: { layout: "centered" },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "ember", "ghost", "icon", "critical"],
    },
    size: { control: "radio", options: ["sm", "md", "lg"] },
    isLoading: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  args: {
    variant: "primary",
    size: "md",
    children: "Run replay",
  },
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { variant: "primary" } };
export const Secondary: Story = { args: { variant: "secondary" } };
export const Ghost: Story = {
  args: { variant: "ghost", children: "All sources" },
};
export const Critical: Story = {
  args: { variant: "critical", children: "Block deploy" },
};
export const Ember: Story = {
  args: { variant: "ember", children: "Ember" },
};

export const WithKbd: Story = {
  args: {
    variant: "secondary",
    children: (
      <>
        Search
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </>
    ),
  },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-s-3">
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg">
        Large
      </Button>
    </div>
  ),
};

export const AllVariants: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-s-3">
      <Button {...args} variant="primary">
        Inject event
      </Button>
      <Button {...args} variant="secondary">
        All sources
      </Button>
      <Button {...args} variant="ghost">
        Cancel
      </Button>
      <Button {...args} variant="critical">
        Delete trace
      </Button>
      <Button {...args} variant="primary" isLoading>
        Loading…
      </Button>
      <Button {...args} variant="primary" disabled>
        Disabled
      </Button>
    </div>
  ),
};
