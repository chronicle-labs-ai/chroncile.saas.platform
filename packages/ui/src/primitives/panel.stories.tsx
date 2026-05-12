import type { Meta, StoryObj } from "@storybook/react";
import { Panel, PanelHeader, PanelContent } from "./panel";
import { Button } from "./button";

const meta: Meta<typeof Panel> = {
  title: "Primitives/Panel",
  component: Panel,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof Panel>;

export const Default: Story = {
  render: () => (
    <div className="w-[520px]">
      <Panel>
        <PanelHeader
          title="Replay suite"
          actions={<Button size="sm">Re-run</Button>}
        />
        <PanelContent>
          <p className="font-sans text-body-sm text-ink-lo">
            19 pass · 3 partial · 2 fail. Run 14m ago.
          </p>
        </PanelContent>
      </Panel>
    </div>
  ),
};

export const Active: Story = {
  render: () => (
    <div className="w-[520px]">
      <Panel active elevated>
        <PanelHeader title="Active scenario" />
        <PanelContent>
          <p className="font-sans text-body-sm text-ink-lo">
            This panel is the "one hot surface" — ember bar on the left.
          </p>
        </PanelContent>
      </Panel>
    </div>
  ),
};
