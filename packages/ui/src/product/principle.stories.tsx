import type { Meta, StoryObj } from "@storybook/react";
import { Principle } from "./principle";

const meta: Meta<typeof Principle> = {
  title: "Product/Principle",
  component: Principle,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof Principle>;

export const ThreePrinciples: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-s-5">
      <Principle
        index="01"
        heading={
          <>
            Serif for judgement.
            <br />
            Mono for evidence.
          </>
        }
        body="Every claim about behavior lands in Kalice. Every piece of evidence lands in mono."
      />
      <Principle
        index="02"
        heading={
          <>
            One hot surface.
            <br />
            Everything else rests.
          </>
        }
        body="The ember gradient is a signal, not decoration. It marks the living scenario — and nothing else."
      />
      <Principle
        index="03"
        heading={
          <>
            Streams are colored.
            <br />
            Systems are quiet.
          </>
        }
        body="Teal for intercom, amber for shopify, green for stripe. System chrome stays neutral."
      />
    </div>
  ),
};
