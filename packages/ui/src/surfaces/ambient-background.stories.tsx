import type { Meta, StoryObj } from "@storybook/react";
import { AmbientBackground } from "./ambient-background";

const meta: Meta<typeof AmbientBackground> = {
  title: "Surfaces/AmbientBackground",
  component: AmbientBackground,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof AmbientBackground>;

export const BehindContent: Story = {
  render: () => (
    <div className="relative isolate min-h-[420px] overflow-hidden bg-surface-00 p-s-12">
      <AmbientBackground />
      <h1 className="relative z-10 font-display text-display-md text-ink-hi">
        The system behind the stream.
      </h1>
      <p className="relative z-10 mt-s-4 max-w-[60ch] font-sans text-body-lg font-light text-ink-lo">
        Very subtle, ambient version of the light source — sits behind marketing
        and docs surfaces without competing with text.
      </p>
    </div>
  ),
};
