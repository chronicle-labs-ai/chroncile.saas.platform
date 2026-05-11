import type { Meta, StoryObj } from "@storybook/react";
import { MetaKV } from "./meta-kv";

const meta: Meta<typeof MetaKV> = {
  title: "Product/MetaKV",
  component: MetaKV,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof MetaKV>;

export const Default: Story = {
  render: () => (
    <MetaKV
      entries={[
        {
          label: "Cards",
          value: (
            <>
              <b className="text-ink-hi font-normal">7</b> · brand → product
            </>
          ),
        },
        {
          label: "Tokens",
          value: (
            <>
              <b className="text-ink-hi font-normal">tokens.css</b> · 1 source
              of truth
            </>
          ),
        },
        {
          label: "Canvas",
          value: (
            <>
              <b className="text-ink-hi font-normal">1440</b> design width ·
              responsive ready
            </>
          ),
        },
        { label: "Ref", value: "Linear · Vercel · Anthropic" },
      ]}
    />
  ),
};
