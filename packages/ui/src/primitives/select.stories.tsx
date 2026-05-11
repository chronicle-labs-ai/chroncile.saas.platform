import type { Meta, StoryObj } from "@storybook/react";
import { Select, SelectItem, SelectSection } from "./select";
import { NativeSelect } from "./native-select";

const meta: Meta<typeof Select> = {
  title: "Primitives/Select",
  component: Select,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: () => (
    <div className="w-[280px]">
      <Select defaultValue="intercom" placeholder="Pick a source">
        <SelectItem value="intercom">Intercom</SelectItem>
        <SelectItem value="shopify">Shopify</SelectItem>
        <SelectItem value="stripe">Stripe</SelectItem>
        <SelectItem value="slack">Slack</SelectItem>
        <SelectItem value="sandbox">Sandbox</SelectItem>
      </Select>
    </div>
  ),
};

export const WithSections: Story = {
  render: () => (
    <div className="w-[280px]">
      <Select placeholder="Select integration">
        <SelectSection title="Support">
          <SelectItem value="intercom">Intercom</SelectItem>
          <SelectItem value="zendesk">Zendesk</SelectItem>
        </SelectSection>
        <SelectSection title="Commerce">
          <SelectItem value="shopify">Shopify</SelectItem>
          <SelectItem value="stripe">Stripe</SelectItem>
        </SelectSection>
        <SelectSection title="Workspace">
          <SelectItem value="slack">Slack</SelectItem>
        </SelectSection>
      </Select>
    </div>
  ),
};

export const Invalid: Story = {
  render: () => (
    <div className="w-[280px]">
      <Select invalid placeholder="Required">
        <SelectItem value="a">A</SelectItem>
        <SelectItem value="b">B</SelectItem>
      </Select>
    </div>
  ),
};

export const NativeSelectLegacy: StoryObj<typeof NativeSelect> = {
  name: "NativeSelect (legacy)",
  render: () => (
    <div className="w-[280px]">
      <NativeSelect defaultValue="intercom">
        <option value="intercom">intercom</option>
        <option value="shopify">shopify</option>
        <option value="stripe">stripe</option>
      </NativeSelect>
    </div>
  ),
};
