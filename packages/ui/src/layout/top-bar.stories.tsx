import type { Meta, StoryObj } from "@storybook/react";
import { TopBar } from "./top-bar";

const meta: Meta<typeof TopBar> = {
  title: "Layout/TopBar",
  component: TopBar,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof TopBar>;

export const Default: Story = {
  render: () => (
    <div className="border-b border-l-border bg-l-surface px-s-3 h-[44px] w-[1100px] flex items-center">
      <TopBar>
        <TopBar.Crumb>
          Chronicle <TopBar.CrumbSep /> support-agent <TopBar.CrumbSep />
          <TopBar.CrumbActive>Timeline</TopBar.CrumbActive>
        </TopBar.Crumb>
        <TopBar.Spacer />
        <TopBar.Live on />
        <TopBar.TimeSelector>Last 1h · 1s resolution</TopBar.TimeSelector>
        <TopBar.SearchTrigger />
      </TopBar>
    </div>
  ),
};

export const Paused: Story = {
  render: () => (
    <div className="border-b border-l-border bg-l-surface px-s-3 h-[44px] w-[1100px] flex items-center">
      <TopBar>
        <TopBar.Crumb>
          <TopBar.CrumbActive>Replay suite</TopBar.CrumbActive>
        </TopBar.Crumb>
        <TopBar.Spacer />
        <TopBar.Live on={false} />
        <TopBar.TimeSelector>Last 24h · 1m resolution</TopBar.TimeSelector>
        <TopBar.SearchTrigger />
      </TopBar>
    </div>
  ),
};
