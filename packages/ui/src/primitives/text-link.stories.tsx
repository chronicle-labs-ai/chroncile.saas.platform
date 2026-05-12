import type { Meta, StoryObj } from "@storybook/react";
import { TextLink } from "./text-link";

const meta: Meta<typeof TextLink> = {
  title: "Primitives/TextLink",
  component: TextLink,
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof TextLink>;

export const InlineAnchor: Story = {
  render: () => (
    <p className="font-sans text-body-sm text-ink-lo">
      Already have an account? <TextLink href="/login">Sign in</TextLink>.
    </p>
  ),
};

export const InlineButton: Story = {
  render: () => (
    <p className="font-sans text-body-sm text-ink-lo">
      This account is registered with Google. <TextLink onClick={() => {}}>
        Click here
      </TextLink>{" "}
      to set a password.
    </p>
  ),
};
