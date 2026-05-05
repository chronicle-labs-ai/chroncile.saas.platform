import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { BacktestStepper } from "./backtest-stepper";
import { ProductChromeFrame } from "../_story-frame";
import { BACKTEST_JOB_PRESETS, cloneRecipe } from "../data";
import type { BacktestPipelineStep } from "../types";

const meta: Meta<typeof BacktestStepper> = {
  title: "Backtests/Configure/Stepper",
  component: BacktestStepper,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md">
        <div className="w-[920px] max-w-full">
          <Story />
        </div>
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof BacktestStepper>;

const regression = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "regression")!.recipe,
);
const replay = cloneRecipe(
  BACKTEST_JOB_PRESETS.find((j) => j.id === "replay")!.recipe,
);
const empty = {
  ...regression,
  agents: [],
  data: { ...regression.data, sources: [], scenarios: [] },
  environment: undefined,
};

function Stateful(initialStep: BacktestPipelineStep) {
  return function Component({
    recipe,
  }: React.ComponentProps<typeof BacktestStepper>) {
    const [step, setStep] = React.useState<BacktestPipelineStep>(initialStep);
    return (
      <BacktestStepper recipe={recipe} active={step} onStepChange={setStep} />
    );
  };
}

export const StepDatasetActive: Story = {
  args: { recipe: regression, active: "dataset" },
  render: Stateful("dataset"),
};

export const StepEnrichActive: Story = {
  args: { recipe: regression, active: "enrich" },
  render: Stateful("enrich"),
};

export const StepEnvironmentActive: Story = {
  args: { recipe: regression, active: "environment" },
  render: Stateful("environment"),
};

export const StepVersionsActive: Story = {
  args: { recipe: regression, active: "versions" },
  render: Stateful("versions"),
};

export const ReplaySkipsEnrich: Story = {
  args: { recipe: replay, active: "dataset" },
  render: Stateful("dataset"),
};

export const Empty: Story = {
  args: { recipe: empty, active: "dataset" },
  render: Stateful("dataset"),
};
