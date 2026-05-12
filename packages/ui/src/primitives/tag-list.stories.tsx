import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import {
  TagList,
  type TagListItem,
} from "./tag-list";

const labels: TagListItem[] = [
  { id: "bug", label: "Bug", color: "bug" },
  { id: "feature", label: "Feature", color: "feature" },
  { id: "improvement", label: "Improvement", color: "improvement" },
];

const meta: Meta<typeof TagList> = {
  title: "Primitives/TagList",
  component: TagList,
  parameters: { layout: "centered" },
  args: { items: labels.slice(0, 2), "aria-label": "Change labels" },
};

export default meta;
type Story = StoryObj<typeof TagList>;

export const Summary: Story = {};

export const Empty: Story = {
  args: {
    items: [],
    emptyLabel: "No labels",
  },
};

export const Overflow: Story = {
  args: {
    items: [
      ...labels,
      { id: "ops", label: "Ops", color: "amber" },
      { id: "security", label: "Security", color: "red" },
    ],
    maxDots: 3,
  },
};

export const CustomLabel: Story = {
  args: {
    items: labels,
    renderLabel: ({ selectedItems, totalItems }) =>
      selectedItems.length > 0
        ? `${selectedItems.map((item) => item.label).join(", ")}`
        : `0 of ${totalItems}`,
  },
};

export const Dropdown: Story = {
  render: () => {
    const [selected, setSelected] = React.useState<Set<string>>(
      () => new Set(["bug", "feature"])
    );
    return (
      <div className="min-h-[180px]">
        <TagList
          items={labels}
          aria-label="Change labels"
          dropdown
          defaultOpen
          selectedIds={selected}
          onSelectionChange={setSelected}
        />
      </div>
    );
  },
};

export const LightMode: Story = {
  render: () => {
    const [selected, setSelected] = React.useState<Set<string>>(
      () => new Set(["bug", "improvement"])
    );
    return (
      <div
        data-theme="light"
        className="min-h-[180px] rounded-md bg-page p-s-6"
      >
        <TagList
          items={labels}
          aria-label="Change labels"
          dropdown
          defaultOpen
          selectedIds={selected}
          onSelectionChange={setSelected}
        />
      </div>
    );
  },
};

export const AsyncSelection: Story = {
  render: () => {
    const [selected, setSelected] = React.useState<Set<string>>(
      () => new Set(["bug"])
    );
    return (
      <div className="min-h-[180px]">
        <TagList
          items={labels}
          aria-label="Change labels"
          dropdown
          defaultOpen
          selectedIds={selected}
          selectionMode="async"
          onSelectionChange={(next) =>
            new Promise<void>((resolve) => {
              window.setTimeout(() => {
                setSelected(next);
                resolve();
              }, 900);
            })
          }
        />
      </div>
    );
  },
};
