import type { Meta, StoryObj } from "@storybook/react";
import { Listbox, ListboxItem, ListboxSection } from "./listbox";

const meta: Meta = {
  title: "Primitives/Listbox",
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <div className="w-[280px]">
      <Listbox
        aria-label="Select a source"
        selectionMode="single"
        defaultSelectedKeys={["intercom"]}
      >
        <ListboxItem id="intercom">Intercom</ListboxItem>
        <ListboxItem id="shopify">Shopify</ListboxItem>
        <ListboxItem id="stripe">Stripe</ListboxItem>
        <ListboxItem id="slack">Slack</ListboxItem>
      </Listbox>
    </div>
  ),
};

export const WithSections: Story = {
  render: () => (
    <div className="w-[280px]">
      <Listbox aria-label="Grouped sources" selectionMode="single">
        <ListboxSection title="Support">
          <ListboxItem id="intercom">Intercom</ListboxItem>
          <ListboxItem id="zendesk">Zendesk</ListboxItem>
        </ListboxSection>
        <ListboxSection title="Commerce">
          <ListboxItem id="shopify">Shopify</ListboxItem>
          <ListboxItem id="stripe">Stripe</ListboxItem>
        </ListboxSection>
      </Listbox>
    </div>
  ),
};
