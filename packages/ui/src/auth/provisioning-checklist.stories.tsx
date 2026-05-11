import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import {
  ProvisioningChecklist,
  type ProvisioningStep,
} from "./provisioning-checklist";

const meta: Meta<typeof ProvisioningChecklist> = {
  title: "Auth/ProvisioningChecklist",
  component: ProvisioningChecklist,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof ProvisioningChecklist>;

const PROVISION_STEPS_WITH_KEYS: ProvisioningStep[] = [
  { label: "Create tenant", state: "done", techKey: "tenants.create" },
  {
    label: "Mirror to WorkOS organization",
    state: "done",
    techKey: "workos.organizations.create",
  },
  {
    label: "Attach as admin",
    state: "done",
    techKey: "userManagement.createOrganizationMembership",
  },
  {
    label: "Create local user row",
    state: "running",
    techKey: "users.create",
  },
  {
    label: "Mint Chronicle JWT",
    state: "pending",
    techKey: "auth.mintJwt",
  },
];

const PROVISION_STEPS_PLAIN: ProvisioningStep[] = [
  { label: "Verify your email", state: "done" },
  { label: "Create your workspace", state: "running" },
  { label: "Sign you in", state: "pending" },
];

export const Step4Running: Story = {
  name: "step 4 running (A.5)",
  render: () => (
    <div className="w-[460px]">
      <ProvisioningChecklist steps={PROVISION_STEPS_WITH_KEYS} />
    </div>
  ),
};

export const AllDone: Story = {
  render: () => (
    <div className="w-[460px]">
      <ProvisioningChecklist
        steps={PROVISION_STEPS_WITH_KEYS.map((s) => ({ ...s, state: "done" }))}
      />
    </div>
  ),
};

export const AllPending: Story = {
  render: () => (
    <div className="w-[460px]">
      <ProvisioningChecklist
        steps={PROVISION_STEPS_WITH_KEYS.map((s) => ({
          ...s,
          state: "pending",
        }))}
      />
    </div>
  ),
};

export const WithoutTechKeys: Story = {
  render: () => (
    <div className="w-[460px]">
      <ProvisioningChecklist steps={PROVISION_STEPS_PLAIN} />
    </div>
  ),
};

export const Live: Story = {
  name: "live (auto-advance)",
  render: () => {
    const [idx, setIdx] = React.useState(0);
    React.useEffect(() => {
      if (idx >= PROVISION_STEPS_WITH_KEYS.length) return;
      const id = setTimeout(() => setIdx((i) => i + 1), 700);
      return () => clearTimeout(id);
    }, [idx]);
    const steps: ProvisioningStep[] = PROVISION_STEPS_WITH_KEYS.map((s, i) => ({
      ...s,
      state: i < idx ? "done" : i === idx ? "running" : "pending",
    }));
    return (
      <div className="flex w-[460px] flex-col gap-s-3">
        <ProvisioningChecklist steps={steps} />
        <button
          type="button"
          onClick={() => setIdx(0)}
          className="self-start font-mono text-mono-sm text-ink-dim hover:text-ink-hi transition-colors"
        >
          Restart
        </button>
      </div>
    );
  },
};
