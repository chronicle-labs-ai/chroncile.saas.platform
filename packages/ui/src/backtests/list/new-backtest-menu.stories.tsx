import type { Meta, StoryObj } from "@storybook/react";

import { NewBacktestMenu } from "./new-backtest-menu";
import { ProductChromeFrame } from "../_story-frame";

const meta: Meta<typeof NewBacktestMenu> = {
  title: "Backtests/List/NewBacktestMenu",
  component: NewBacktestMenu,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md">
        <div className="flex h-32 items-center justify-center">
          <Story />
        </div>
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof NewBacktestMenu>;

export const Default: Story = {};

export const CustomLabel: Story = {
  args: { label: "Start a backtest" },
};
