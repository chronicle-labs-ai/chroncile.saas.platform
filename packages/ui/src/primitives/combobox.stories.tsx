import type { Meta, StoryObj } from "@storybook/react";
import { Combobox, ComboboxItem, ComboboxSection } from "./combobox";

const meta: Meta<typeof Combobox> = {
  title: "Primitives/Combobox",
  component: Combobox,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof Combobox>;

export const Default: Story = {
  render: () => (
    <div className="w-[320px]">
      <Combobox aria-label="Pick a source" placeholder="Search…">
        <ComboboxItem id="intercom">Intercom</ComboboxItem>
        <ComboboxItem id="shopify">Shopify</ComboboxItem>
        <ComboboxItem id="stripe">Stripe</ComboboxItem>
        <ComboboxItem id="slack">Slack</ComboboxItem>
        <ComboboxItem id="sandbox">Sandbox</ComboboxItem>
      </Combobox>
    </div>
  ),
};

export const WithSections: Story = {
  render: () => (
    <div className="w-[320px]">
      <Combobox
        aria-label="Grouped integrations"
        placeholder="Filter integrations"
      >
        <ComboboxSection title="Support">
          <ComboboxItem id="intercom">Intercom</ComboboxItem>
          <ComboboxItem id="zendesk">Zendesk</ComboboxItem>
        </ComboboxSection>
        <ComboboxSection title="Commerce">
          <ComboboxItem id="shopify">Shopify</ComboboxItem>
          <ComboboxItem id="stripe">Stripe</ComboboxItem>
        </ComboboxSection>
      </Combobox>
    </div>
  ),
};
