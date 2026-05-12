import type { Meta, StoryObj } from "@storybook/react";
import { EmptyState } from "./empty-state";
import { Button } from "./button";

const meta: Meta<typeof EmptyState> = {
  title: "Primitives/EmptyState",
  component: EmptyState,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  render: () => (
    <div className="w-[640px]">
      <EmptyState
        icon={
          <svg viewBox="0 0 24 24" fill="none" className="h-full w-full">
            <path
              d="M4 6h16M4 12h10M4 18h16"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          </svg>
        }
        title="No runs yet"
        description="Kick off a scenario to see it materialize here as a run with replayable detail."
        actions={
          <>
            <Button variant="ghost">View docs</Button>
            <Button variant="ember">Create scenario</Button>
          </>
        }
      />
    </div>
  ),
};
