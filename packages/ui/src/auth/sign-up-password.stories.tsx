import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { SignUpPassword, type SignUpPasswordValue } from "./sign-up-password";
import { AuthShell } from "./auth-shell";

const SIGNUP_STEPS = [
  { id: "email", label: "Email" },
  { id: "password", label: "Password" },
  { id: "verify", label: "Verify" },
  { id: "workspace", label: "Workspace" },
];

const Frame = ({ children }: { children: React.ReactNode }) => (
  <AuthShell topbar={{ steps: SIGNUP_STEPS, currentIndex: 1 }}>
    {children}
  </AuthShell>
);

const meta: Meta<typeof SignUpPassword> = {
  title: "Auth/SignUpPassword",
  component: SignUpPassword,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof SignUpPassword>;

export const A2RulesVisible: Story = {
  name: "A.2 · rules list visible",
  render: () => {
    const [v, setV] = React.useState<SignUpPasswordValue>({
      email: "ada@stripe.com",
      firstName: "Ada",
      password: "Chr0nicle!",
    });
    return (
      <Frame>
        <SignUpPassword
          value={v}
          onChange={setV}
          onSubmit={(val) => alert("continue " + val.firstName)}
          onBack={() => alert("back")}
        />
      </Frame>
    );
  },
};

export const Empty: Story = {
  render: () => {
    const [v, setV] = React.useState<SignUpPasswordValue>({
      email: "ada@stripe.com",
      firstName: "",
      password: "",
    });
    return (
      <Frame>
        <SignUpPassword value={v} onChange={setV} />
      </Frame>
    );
  },
};

export const Weak: Story = {
  render: () => (
    <Frame>
      <SignUpPassword
        value={{
          email: "ada@stripe.com",
          firstName: "Ada",
          password: "short",
        }}
      />
    </Frame>
  ),
};

export const Strong: Story = {
  render: () => (
    <Frame>
      <SignUpPassword
        value={{
          email: "ada@stripe.com",
          firstName: "Ada",
          password: "Chr0nicle!Labs#",
        }}
      />
    </Frame>
  ),
};

export const HideFirstNameLegacy: Story = {
  name: "legacy (hideFirstName)",
  render: () => (
    <Frame>
      <SignUpPassword
        hideFirstName
        value={{ email: "ada@stripe.com", password: "Chr0nicle!" }}
      />
    </Frame>
  ),
};
