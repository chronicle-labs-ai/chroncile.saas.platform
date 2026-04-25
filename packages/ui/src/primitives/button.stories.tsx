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
    density: { control: "radio", options: ["compact", "brand"] },
    isLoading: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  args: {
    variant: "primary",
    size: "md",
    density: "compact",
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

export const CompactVariants: Story = {
  args: { density: "compact" },
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

export const BrandVariants: Story = {
  args: { density: "brand" },
  render: (args) => (
    <div className="flex flex-wrap items-center gap-s-3">
      <Button {...args} variant="primary">
        Primary
      </Button>
      <Button {...args} variant="secondary">
        Secondary
      </Button>
      <Button {...args} variant="ember">
        Ember
      </Button>
      <Button {...args} variant="ghost">
        Ghost
      </Button>
      <Button {...args} variant="critical">
        Critical
      </Button>
    </div>
  ),
};

export const DensityCompare: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="grid grid-cols-2 gap-s-12">
      <div className="flex flex-col gap-s-3">
        <span className="font-mono text-mono-sm uppercase tracking-eyebrow text-l-ink-dim">
          {`density="compact"`}
        </span>
        <div className="flex flex-wrap items-center gap-s-2">
          <Button variant="primary">Run replay</Button>
          <Button variant="secondary">
            Search
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </Button>
          <Button variant="ghost">All sources</Button>
        </div>
      </div>
      <div className="flex flex-col gap-s-3">
        <span className="font-mono text-mono-sm uppercase tracking-eyebrow text-ink-dim">
          {`density="brand"`}
        </span>
        <div className="flex flex-wrap items-center gap-s-2">
          <Button density="brand" variant="primary">
            Run replay
          </Button>
          <Button density="brand" variant="secondary">
            Search
          </Button>
          <Button density="brand" variant="ghost">
            All sources
          </Button>
        </div>
      </div>
    </div>
  ),
};

// Legacy alias kept for back-compat
export const AllVariants: Story = CompactVariants;
export const Ember: Story = {
  args: { density: "brand", variant: "ember", children: "Ember" },
};
