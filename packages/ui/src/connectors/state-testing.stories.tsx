import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { StateTesting, type ConnectorCheck } from "./state-testing";
import { getSource } from "../onboarding/data";

const meta: Meta<typeof StateTesting> = {
  title: "Connectors/StateTesting",
  component: StateTesting,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof StateTesting>;

const RUNNING_CHECKS: ConnectorCheck[] = [
  {
    id: "auth",
    label: "Auth handshake",
    status: "ok",
    detail: "200 OK · 142 ms",
  },
  {
    id: "scopes",
    label: "Scope check",
    status: "ok",
    detail: "5 of 5 granted",
  },
  {
    id: "first",
    label: "First event",
    status: "pending",
    detail: "Listening…",
  },
];

const ALL_OK_CHECKS: ConnectorCheck[] = [
  {
    id: "auth",
    label: "Auth handshake",
    status: "ok",
    detail: "200 OK · 142 ms",
  },
  {
    id: "scopes",
    label: "Scope check",
    status: "ok",
    detail: "5 of 5 granted",
  },
  { id: "first", label: "First event", status: "ok", detail: "stream.opened" },
];

const FAILED_CHECKS: ConnectorCheck[] = [
  {
    id: "auth",
    label: "Auth handshake",
    status: "ok",
    detail: "200 OK · 142 ms",
  },
  {
    id: "scopes",
    label: "Scope check",
    status: "fail",
    detail: "missing chat:write",
  },
  { id: "first", label: "First event", status: "pending", detail: "Skipped" },
];

function RunningDemo() {
  const [open, setOpen] = React.useState(true);
  return (
    <StateTesting
      source={getSource("slack")!}
      isOpen={open}
      onClose={() => setOpen(false)}
      checks={RUNNING_CHECKS}
    />
  );
}

function AllPassedDemo() {
  const [open, setOpen] = React.useState(true);
  return (
    <StateTesting
      source={getSource("slack")!}
      isOpen={open}
      onClose={() => setOpen(false)}
      checks={ALL_OK_CHECKS}
    />
  );
}

function FailedDemo() {
  const [open, setOpen] = React.useState(true);
  return (
    <StateTesting
      source={getSource("slack")!}
      isOpen={open}
      onClose={() => setOpen(false)}
      checks={FAILED_CHECKS}
    />
  );
}

export const Running: Story = { render: () => <RunningDemo /> };
export const AllPassed: Story = { render: () => <AllPassedDemo /> };
export const Failed: Story = { render: () => <FailedDemo /> };
