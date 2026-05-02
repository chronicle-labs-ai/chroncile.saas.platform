import type { Meta, StoryObj } from "@storybook/react";

import { BacktestJobsPicker } from "./backtest-jobs-picker";
import { ProductChromeFrame } from "../_story-frame";

const meta: Meta<typeof BacktestJobsPicker> = {
  title: "Backtests/Configure/JobsPicker",
  component: BacktestJobsPicker,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="none">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof BacktestJobsPicker>;

export const Default: Story = {};

export const NoRecent: Story = {
  args: { hideRecent: true },
};
