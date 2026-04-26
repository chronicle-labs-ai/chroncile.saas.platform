import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { WorkspaceSetup } from "./workspace-setup";
import { AuthShell } from "./auth-shell";
import type { ProvisioningStep } from "./provisioning-checklist";

const meta: Meta<typeof WorkspaceSetup> = {
  title: "Auth/WorkspaceSetup",
  component: WorkspaceSetup,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof WorkspaceSetup>;

const Frame = ({ children }: { children: React.ReactNode }) => (
  <AuthShell topbar={false}>{children}</AuthShell>
);

const STEPS_RUNNING: ProvisioningStep[] = [
  { label: "Create tenant", state: "done", techKey: "tenants.create" },
  {
    label: "Mirror to WorkOS organization",
    state: "done",
    techKey: "workos.organizations.create",
  },
  {
    label: "Attach as admin",
    state: "running",
    techKey: "userManagement.createOrganizationMembership",
  },
  {
    label: "Create local user row",
    state: "pending",
    techKey: "users.create",
  },
  {
    label: "Mint Chronicle JWT",
    state: "pending",
    techKey: "auth.mintJwt",
  },
];

export const A4Capture: Story = {
  name: "A.4 · capture (workspace name + URL)",
  render: () => (
    <Frame>
      <WorkspaceSetup
        sub="capture"
        email="ada@stripe.com"
        onSubmit={(v) => alert("submit " + JSON.stringify(v))}
      />
    </Frame>
  ),
};

export const A5Running: Story = {
  name: "A.5 · running (provisioning)",
  render: () => (
    <Frame>
      <WorkspaceSetup sub="running" steps={STEPS_RUNNING} />
    </Frame>
  ),
};

export const A6Success: Story = {
  name: "A.6 · success (workspace ready)",
  render: () => (
    <Frame>
      <WorkspaceSetup
        sub="success"
        firstName="Ada"
        workspaceName="Stripe Events"
        onContinueOnboarding={() => alert("onboarding")}
        onSkipToDashboard={() => alert("dashboard")}
      />
    </Frame>
  ),
};

export const Live: Story = {
  name: "live (capture → running → success)",
  render: () => {
    const [sub, setSub] = React.useState<"capture" | "running" | "success">(
      "capture",
    );
    const [stepIdx, setStepIdx] = React.useState(0);
    const [name, setName] = React.useState("");

    React.useEffect(() => {
      if (sub !== "running") return;
      if (stepIdx >= STEPS_RUNNING.length) {
        const t = setTimeout(() => setSub("success"), 600);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setStepIdx((i) => i + 1), 700);
      return () => clearTimeout(t);
    }, [sub, stepIdx]);

    const liveSteps: ProvisioningStep[] = STEPS_RUNNING.map((s, i) => ({
      ...s,
      state: i < stepIdx ? "done" : i === stepIdx ? "running" : "pending",
    }));

    return (
      <Frame>
        <WorkspaceSetup
          sub={sub}
          email="ada@stripe.com"
          steps={liveSteps}
          firstName="Ada"
          workspaceName={name || "Stripe Events"}
          onSubmit={(v) => {
            setName(v.orgName);
            setSub("running");
            setStepIdx(0);
          }}
          onContinueOnboarding={() => alert("onboarding")}
          onSkipToDashboard={() => alert("dashboard")}
        />
      </Frame>
    );
  },
};
