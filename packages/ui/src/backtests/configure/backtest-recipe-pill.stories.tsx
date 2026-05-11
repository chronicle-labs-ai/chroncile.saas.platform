import type { Meta, StoryObj } from "@storybook/react";

import { BacktestRecipePill } from "./backtest-recipe-pill";
import { ProductChromeFrame } from "../_story-frame";

const meta: Meta<typeof BacktestRecipePill> = {
  title: "Backtests/Configure/RecipePill",
  component: BacktestRecipePill,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof BacktestRecipePill>;

export const Closed: Story = {
  args: { label: "agents", children: "support-v3, support-v4.0", open: false },
};

export const Open: Story = {
  args: { label: "agents", children: "support-v3, support-v4.0", open: true },
};
