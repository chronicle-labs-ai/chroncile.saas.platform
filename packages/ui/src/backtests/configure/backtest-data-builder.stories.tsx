import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { BacktestDataBuilder } from "./backtest-data-builder";
import { ProductChromeFrame } from "../_story-frame";
import { BACKTEST_JOB_PRESETS, cloneRecipe } from "../data";
import type { BacktestData } from "../types";

const meta: Meta<typeof BacktestDataBuilder> = {
  title: "Backtests/Configure/DataBuilder",
  component: BacktestDataBuilder,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md">
        <div className="rounded-md border border-hairline bg-surface-00 p-4">
          <Story />
        </div>
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof BacktestDataBuilder>;

const emptyData: BacktestData = {
  kind: "composed",
  sources: [],
  scenarios: [],
  savedAs: null,
};

const composedData = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "regression")!.recipe,
).data;

const datasetData = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "suite")!.recipe,
).data;

function Stateful(initial: BacktestData) {
  return function Component() {
    const [data, setData] = React.useState<BacktestData>(initial);
    return <BacktestDataBuilder data={data} onChange={setData} />;
  };
}

export const EmptyTray: Story = {
  render: Stateful(emptyData),
};

export const ComposedTray: Story = {
  render: Stateful(composedData),
};

export const SavedDataset: Story = {
  render: Stateful(datasetData),
};
