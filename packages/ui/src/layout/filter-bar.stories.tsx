import type { Meta, StoryObj } from "@storybook/react";
import { FilterBar } from "./filter-bar";
import { FilterPill } from "../primitives/filter-pill";

const meta: Meta<typeof FilterBar> = {
  title: "Layout/FilterBar",
  component: FilterBar,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof FilterBar>;

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

export const Empty: Story = {
  render: () => (
    <div className="border-b border-hairline-strong bg-l-surface-bar px-s-3 h-[40px] w-[1100px] flex items-center">
      <FilterBar>
        <FilterBar.AddFilter />
        <FilterBar.Divider />
        <FilterBar.Display />
        <FilterBar.Spacer />
        <FilterBar.Count shown={42} total={42} unit="traces" />
      </FilterBar>
    </div>
  ),
};

export const WithFilters: Story = {
  render: () => (
    <div className="border-b border-hairline-strong bg-l-surface-bar px-s-3 h-[40px] w-[1100px] flex items-center">
      <FilterBar>
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
        <FilterBar.AddFilter label="" />
        <FilterBar.Clear />
        <FilterBar.Divider />
        <FilterBar.Display changed />
        <FilterBar.Spacer />
        <FilterBar.Count shown={8} total={42} unit="traces" />
      </FilterBar>
    </div>
  ),
};
