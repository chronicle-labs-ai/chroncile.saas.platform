import type { Meta, StoryObj } from "@storybook/react";
import { SignUpSuccess } from "./sign-up-success";
import { AuthShell } from "./auth-shell";

const SIGNUP_STEPS = [
  { id: "email", label: "Account" },
  { id: "password", label: "Password" },
  { id: "verify", label: "Verify" },
  { id: "success", label: "Launch" },
];

const meta: Meta<typeof SignUpSuccess> = {
  title: "Auth/SignUpSuccess",
  component: SignUpSuccess,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof SignUpSuccess>;

export const Default: Story = {
  render: () => (
    <AuthShell topbar={{ steps: SIGNUP_STEPS, currentIndex: 3 }}>
      <SignUpSuccess
        name="Ada Lovelace"
        onBegin={() => alert("begin onboarding")}
        onRestart={() => alert("restart")}
      />
    </AuthShell>
  ),
};

export const NoSDKKey: Story = {
  render: () => (
    <AuthShell topbar={{ steps: SIGNUP_STEPS, currentIndex: 3 }}>
      <SignUpSuccess name="Ada" hideSdkKey />
    </AuthShell>
  ),
};

export const CustomBeginLabel: Story = {
  render: () => (
    <AuthShell topbar={{ steps: SIGNUP_STEPS, currentIndex: 3 }}>
      <SignUpSuccess
        name="Sage"
        beginLabel="Open workspace"
        sdkKey="chk_test_demo…1234"
      />
    </AuthShell>
  ),
};
