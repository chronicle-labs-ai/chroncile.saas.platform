import type { Meta, StoryObj } from "@storybook/react";
import { ShowcaseCard as Card } from "./showcase-card";

const meta: Meta<typeof Card> = {
  title: "Product/ShowcaseCard",
  component: Card,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-s-4 w-[820px]">
      <Card
        href="#"
        num="01"
        title="Event stream"
        subtitle="The core product surface"
        thumb={
          <div className="flex h-full items-center justify-center font-display text-display-sm text-ink-hi">
            →
          </div>
        }
      />
      <Card
        href="#"
        num="02"
        title="Replay suite"
        subtitle="Scenario runner + divergence diff"
        thumb={
          <div className="flex h-full items-center justify-center font-mono text-mono-lg text-ink-lo">
            11 TURNS · 1 DIVERGENCE
          </div>
        }
      />
    </div>
  ),
};
