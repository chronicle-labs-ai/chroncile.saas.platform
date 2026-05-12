import type { Meta, StoryObj } from "@storybook/react";
import { Tabs, TabList, Tab, TabPanel } from "./tabs";

const meta: Meta = {
  title: "Primitives/Tabs",
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <div className="w-[560px]">
      <Tabs defaultValue="events">
        <TabList aria-label="Dashboard">
          <Tab value="events">Events</Tab>
          <Tab value="runs">Runs</Tab>
          <Tab value="rules">Rules</Tab>
        </TabList>
        <TabPanel value="events">
          <div className="py-s-4">Events panel content</div>
        </TabPanel>
        <TabPanel value="runs">
          <div className="py-s-4">Runs panel content</div>
        </TabPanel>
        <TabPanel value="rules">
          <div className="py-s-4">Rules panel content</div>
        </TabPanel>
      </Tabs>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="w-[560px]">
      <Tabs orientation="vertical" defaultValue="general">
        <TabList aria-label="Settings">
          <Tab value="general">General</Tab>
          <Tab value="billing">Billing</Tab>
          <Tab value="members">Members</Tab>
        </TabList>
        <TabPanel value="general">
          <div className="px-s-4">General settings</div>
        </TabPanel>
        <TabPanel value="billing">
          <div className="px-s-4">Billing settings</div>
        </TabPanel>
        <TabPanel value="members">
          <div className="px-s-4">Members settings</div>
        </TabPanel>
      </Tabs>
    </div>
  ),
};
