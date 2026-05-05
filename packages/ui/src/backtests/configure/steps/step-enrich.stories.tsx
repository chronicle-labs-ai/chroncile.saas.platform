import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { StepEnrich } from "./step-enrich";
import { ProductChromeFrame } from "../../_story-frame";
import {
  BACKTEST_DISCOVERY_PROPOSALS,
  BACKTEST_JOB_PRESETS,
  cloneRecipe,
} from "../../data";
import type { BacktestRecipe } from "../../types";

const meta: Meta<typeof StepEnrich> = {
  title: "Backtests/Configure/Steps/Enrich",
  component: StepEnrich,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md">
        <div className="mx-auto w-full max-w-5xl rounded-[2px] border border-divider bg-wash-micro">
          <Story />
        </div>
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof StepEnrich>;

function Stateful(initial: BacktestRecipe) {
  return function Component(args: React.ComponentProps<typeof StepEnrich>) {
    const [recipe, setRecipe] = React.useState<BacktestRecipe>(initial);
    return (
      <StepEnrich
        {...args}
        recipe={recipe}
        onChange={(patch) => setRecipe({ ...recipe, ...patch })}
      />
    );
  };
}

const compareRecipe = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "compare")!.recipe,
);
const compareWithProposals: BacktestRecipe = {
  ...compareRecipe,
  data: {
    ...compareRecipe.data,
    scenarios: BACKTEST_DISCOVERY_PROPOSALS.map((s) => ({ ...s })),
  },
};
const replayRecipe = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "replay")!.recipe,
);

export const Default: Story = {
  render: Stateful(compareWithProposals),
};

export const NothingAccepted: Story = {
  render: Stateful({
    ...compareRecipe,
    data: {
      ...compareRecipe.data,
      scenarios: BACKTEST_DISCOVERY_PROPOSALS.map((s) => ({ ...s, accepted: false })),
    },
  }),
};

export const ReplaySkipped: Story = {
  render: Stateful(replayRecipe),
};
