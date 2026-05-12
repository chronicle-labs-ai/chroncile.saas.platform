import type { Meta, StoryObj } from "@storybook/react";
import { ReplayBar } from "./replay-bar";

const meta: Meta<typeof ReplayBar> = {
  title: "Product/ReplayBar",
  component: ReplayBar,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof ReplayBar>;

export const BaselineVsCandidate: Story = {
  render: () => (
    <div className="flex w-[520px] flex-col gap-s-3">
      <ReplayBar
        variant="baseline"
        value={98}
        label={
          <>
            BASELINE <b className="text-ink-hi font-normal">v2.8</b>
          </>
        }
        readout="98.4% match"
        tone="green"
      />
      <ReplayBar
        variant="candidate"
        value={62}
        label={
          <>
            CANDIDATE <b className="text-ember font-normal">v3.0.4</b>
          </>
        }
        readout="62.1% — FAIL"
        tone="red"
      />
    </div>
  ),
};
