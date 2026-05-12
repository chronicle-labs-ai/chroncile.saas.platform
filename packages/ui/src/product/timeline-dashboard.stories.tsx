import type { Meta, StoryObj } from "@storybook/react";

import { TimelineDashboard } from "./timeline-dashboard";

const meta: Meta<typeof TimelineDashboard> = {
  title: "Product/TimelineDashboard",
  component: TimelineDashboard,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof TimelineDashboard>;

/**
 * Default — exactly what `/dashboard/timeline` renders in the
 * customer-facing app. Seed events are re-anchored so the latest
 * trace lands ~5 minutes before now; the playhead therefore sweeps
 * forward through real wall-clock time.
 */
export const Default: Story = {
  render: () => (
    <div className="flex h-screen flex-col bg-page p-s-4">
      <TimelineDashboard />
    </div>
  ),
};

/**
 * Frozen — uses the original seed timestamps (March 14 2026) so
 * VRT snapshots stay deterministic. Toggle `disableRebase` when you
 * need a stable visual for review.
 */
export const Frozen: Story = {
  render: () => (
    <div className="flex h-screen flex-col bg-page p-s-4">
      <TimelineDashboard disableRebase />
    </div>
  ),
};
