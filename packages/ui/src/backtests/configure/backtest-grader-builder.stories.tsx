import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { BacktestGraderBuilder } from "./backtest-grader-builder";
import { ProductChromeFrame } from "../_story-frame";
import { BACKTEST_JOB_PRESETS, cloneRecipe } from "../data";
import type { BacktestData, BacktestGrader } from "../types";

const meta: Meta<typeof BacktestGraderBuilder> = {
  title: "Backtests/Configure/GraderBuilder",
  component: BacktestGraderBuilder,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md">
        <div className="rounded-l border border-hairline bg-surface-00 p-4">
          <Story />
        </div>
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof BacktestGraderBuilder>;

const regression = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "regression")!.recipe,
);
const suite = cloneRecipe(BACKTEST_JOB_PRESETS.find((j) => j.id === "suite")!.recipe);

function Stateful(initial: {
  graders: readonly BacktestGrader[];
  data: BacktestData;
}) {
  return function Component() {
    const [graders, setGraders] = React.useState<readonly BacktestGrader[]>(initial.graders);
    return (
      <BacktestGraderBuilder graders={graders} data={initial.data} onChange={setGraders} />
    );
  };
}

export const Proposed: Story = {
  render: Stateful({ graders: regression.graders, data: regression.data }),
};

export const Empty: Story = {
  render: Stateful({ graders: [], data: regression.data }),
};

export const FromSavedDataset: Story = {
  render: Stateful({ graders: suite.graders, data: suite.data }),
};
