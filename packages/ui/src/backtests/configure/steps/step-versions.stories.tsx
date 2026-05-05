import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { StepVersions } from "./step-versions";
import { ProductChromeFrame } from "../../_story-frame";
import { BACKTEST_JOB_PRESETS, cloneRecipe } from "../../data";
import { agentsManagerSeed } from "../../../agents/data";
import type { BacktestRecipe } from "../../types";

const meta: Meta<typeof StepVersions> = {
  title: "Backtests/Configure/Steps/Versions",
  component: StepVersions,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md">
        <div className="mx-auto w-full max-w-3xl rounded-[2px] border border-divider bg-wash-micro">
          <Story />
        </div>
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof StepVersions>;

function Stateful(initial: BacktestRecipe) {
  return function Component(
    args: React.ComponentProps<typeof StepVersions>,
  ) {
    const [recipe, setRecipe] = React.useState<BacktestRecipe>(initial);
    return (
      <StepVersions
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
const noAgents: BacktestRecipe = { ...compareRecipe, agents: [] };

export const PickedFromCatalog: Story = {
  render: Stateful(compareRecipe),
};

export const Empty: Story = {
  render: Stateful(noAgents),
};

export const WithRealAgents: Story = {
  render: Stateful(noAgents),
  args: { availableAgents: agentsManagerSeed },
};
