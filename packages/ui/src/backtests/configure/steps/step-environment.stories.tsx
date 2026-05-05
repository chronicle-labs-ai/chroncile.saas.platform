import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { StepEnvironment } from "./step-environment";
import { ProductChromeFrame } from "../../_story-frame";
import { BACKTEST_JOB_PRESETS, cloneRecipe } from "../../data";
import type { BacktestEnvironmentRef, BacktestRecipe } from "../../types";

const meta: Meta<typeof StepEnvironment> = {
  title: "Backtests/Configure/Steps/Environment",
  component: StepEnvironment,
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
type Story = StoryObj<typeof StepEnvironment>;

function Stateful(initial: BacktestRecipe) {
  return function Component(
    args: React.ComponentProps<typeof StepEnvironment>,
  ) {
    const [recipe, setRecipe] = React.useState<BacktestRecipe>(initial);
    return (
      <StepEnvironment
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
const noEnv: BacktestRecipe = { ...compareRecipe, environment: undefined };

const cloneSandbox = async (
  recipe: BacktestRecipe,
): Promise<BacktestEnvironmentRef> => {
  await new Promise((r) => setTimeout(r, 600));
  const slug =
    recipe.data.kind === "dataset"
      ? recipe.data.datasetLabel ?? "ephemeral"
      : "ephemeral";
  return {
    id: `env_clone_${Date.now()}`,
    label: `${slug} (cloned)`,
    snapshotLabel: slug,
    status: "starting",
    ephemeral: true,
  };
};

export const SavedEnvSelected: Story = {
  render: Stateful(compareRecipe),
};

export const NoEnvYet: Story = {
  render: Stateful(noEnv),
};

export const WithCloneAction: Story = {
  render: Stateful(noEnv),
  args: { onCloneSandbox: cloneSandbox },
};
