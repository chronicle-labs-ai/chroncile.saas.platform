import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { Pagination } from "./pagination";

const meta: Meta<typeof Pagination> = {
  title: "Primitives/Pagination",
  component: Pagination,
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof Pagination>;

export const Default: Story = {
  args: { totalPages: 10, defaultPage: 1 },
};

export const Controlled: Story = {
  render: () => {
    const [page, setPage] = React.useState(7);
    return (
      <div className="flex flex-col items-center gap-s-3">
        <Pagination
          page={page}
          onPageChange={setPage}
          totalPages={24}
          siblings={1}
        />
        <span className="font-mono text-mono-sm text-ink-dim">
          Page {page} / 24
        </span>
      </div>
    );
  },
};
