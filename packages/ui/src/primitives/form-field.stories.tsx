import type { Meta, StoryObj } from "@storybook/react";
import { FormField } from "./form-field";
import { Input } from "./input";
import { Textarea } from "./textarea";

const meta: Meta<typeof FormField> = {
  title: "Primitives/FormField",
  component: FormField,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof FormField>;

export const WithInput: Story = {
  render: () => (
    <div className="w-[480px]">
      <FormField
        label="Scenario name"
        htmlFor="name"
        description="Shown in the replay suite."
        required
      >
        <Input id="name" placeholder="Refund escalation — wrong address" />
      </FormField>
    </div>
  ),
};

export const WithError: Story = {
  render: () => (
    <div className="w-[480px]">
      <FormField
        label="Baseline version"
        htmlFor="baseline"
        error="Must be a semver like `v2.8.0`."
      >
        <Input id="baseline" invalid defaultValue="latest" />
      </FormField>
    </div>
  ),
};

export const WithTextarea: Story = {
  render: () => (
    <div className="w-[520px]">
      <FormField
        label="System prompt"
        htmlFor="prompt"
        description="Pinned to this scenario only."
      >
        <Textarea id="prompt" rows={4} placeholder="You are a support agent…" />
      </FormField>
    </div>
  ),
};
