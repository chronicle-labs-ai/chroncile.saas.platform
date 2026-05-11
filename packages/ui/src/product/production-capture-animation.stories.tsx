import type { Meta, StoryObj } from "@storybook/react";

import { ProductionCaptureAnimation } from "./production-capture-animation";
import { ProductionCaptureCard } from "./production-capture-card";

const meta: Meta<typeof ProductionCaptureAnimation> = {
  title: "Product/ProductionCaptureAnimation",
  component: ProductionCaptureAnimation,
  parameters: { layout: "centered" },
};

export default meta;

type Story = StoryObj<typeof ProductionCaptureAnimation>;

export const SquareAnimation: Story = {
  render: () => (
    <div className="w-[420px] max-w-[calc(100vw-32px)]">
      <ProductionCaptureAnimation />
    </div>
  ),
};

export const LandingCard: Story = {
  render: () => (
    <div className="w-[420px] max-w-[calc(100vw-32px)]">
      <ProductionCaptureCard href="#" />
    </div>
  ),
};
