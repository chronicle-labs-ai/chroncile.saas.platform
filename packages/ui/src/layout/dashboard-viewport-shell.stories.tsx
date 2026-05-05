import type { Meta, StoryObj } from "@storybook/react";
import { DashboardViewportShell } from "./dashboard-viewport-shell";

const meta: Meta<typeof DashboardViewportShell> = {
  title: "Layout/DashboardViewportShell",
  component: DashboardViewportShell,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof DashboardViewportShell>;

export const Default: Story = {
  render: () => (
    <div style={{ ["--header-height" as string]: "3.5rem" }}>
      <DashboardViewportShell>
        <div className="flex flex-1 items-center justify-center rounded-md border border-hairline-strong bg-surface-01 p-s-6 font-mono text-mono-sm text-ink-dim">
          Manager content lives here. The shell pins the page so this
          area can run its own internal scrolling.
        </div>
      </DashboardViewportShell>
    </div>
  ),
};
