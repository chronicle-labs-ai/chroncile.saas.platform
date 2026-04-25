import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { FilterPill } from "./filter-pill";

const Triangle = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M8 2.5l5.5 10h-11z" />
  </svg>
);
const Bolt = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden
  >
    <path d="M9 2L3 9h4l-1 5 6-7H8l1-5z" />
  </svg>
);
const Globe = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden
  >
    <circle cx="8" cy="8" r="5.5" />
    <path d="M2.5 8h11M8 2.5c2 2 2 9 0 11M8 2.5c-2 2-2 9 0 11" />
  </svg>
);

const meta: Meta<typeof FilterPill> = {
  title: "Primitives/FilterPill",
  component: FilterPill,
  parameters: { layout: "centered" },
  args: {
    icon: <Triangle />,
    dimension: "Outcome",
    verb: "is",
    value: "Failed",
  },
};
export default meta;
type Story = StoryObj<typeof FilterPill>;

export const Default: Story = {};

export const WithRemove: Story = {
  args: { onRemove: () => alert("removed") },
};

export const Stack: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-wrap items-center gap-[6px]">
      <FilterPill
        icon={<Triangle />}
        dimension="Outcome"
        value="Failed"
        onRemove={() => {}}
      />
      <FilterPill
        icon={<Bolt />}
        dimension="Priority"
        value="Urgent, High"
        onRemove={() => {}}
      />
      <FilterPill
        icon={<Globe />}
        dimension="Source"
        verb="in"
        value="intercom, shopify"
        onRemove={() => {}}
      />
    </div>
  ),
};
