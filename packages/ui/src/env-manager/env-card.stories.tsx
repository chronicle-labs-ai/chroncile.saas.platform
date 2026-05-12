import type { Meta, StoryObj } from "@storybook/react";
import type * as React from "react";

import { Skeleton } from "../primitives/skeleton";
import { EnvCard } from "./env-card";

const meta = {
  title: "Env Manager/EnvCard",
  component: EnvCard,
  parameters: { layout: "padded" },
  argTypes: {
    type: {
      control: "select",
      options: ["prod", "stg", "dev", "local", "ephemeral"],
    },
    title: { control: "text" },
    meta: { control: "text" },
    badgeLabel: { control: "text" },
  },
  args: {
    type: "ephemeral",
    title: "invite-flow · pr-1276",
    meta: "feature/invite-flow · 8f3a91c",
  },
} satisfies Meta<typeof EnvCard>;

export default meta;
type Story = StoryObj<typeof EnvCard>;

function CardDemo() {
  return (
    <div className="grid max-w-[900px] grid-cols-1 gap-s-4 md:grid-cols-2">
      <EnvCard type="prod" title="production" meta="main · 9f81abc">
        <EnvCard.Hosts>
          <EnvCard.HostRow label="Backend" value="api.chroniclelabs.io" />
          <EnvCard.HostRow label="Frontend" value="app.chroniclelabs.io" />
        </EnvCard.Hosts>
        <EnvCard.Footer>
          <EnvCard.Health>healthy</EnvCard.Health>
          <EnvCard.Ttl>permanent</EnvCard.Ttl>
        </EnvCard.Footer>
      </EnvCard>
      <EnvCard
        type="ephemeral"
        title="invite-flow · pr-1276"
        meta="feature/invite-flow · 8f3a91c"
      >
        <EnvCard.Hosts>
          <EnvCard.HostRow label="Backend" value="chronicle-pr-1276.fly.dev" />
          <EnvCard.HostRow label="Frontend" />
        </EnvCard.Hosts>
        <EnvCard.Footer>
          <EnvCard.Health status="warning">provisioning</EnvCard.Health>
          <EnvCard.Ttl>18h remaining</EnvCard.Ttl>
        </EnvCard.Footer>
      </EnvCard>
    </div>
  );
}

function ControlledCard(
  args: Omit<React.ComponentProps<typeof EnvCard>, "children">
) {
  return (
    <div className="max-w-[420px]">
      <EnvCard {...args}>
        <EnvCard.Hosts>
          <EnvCard.HostRow label="Backend" value="chronicle-pr-1276.fly.dev" />
          <EnvCard.HostRow label="Frontend" />
        </EnvCard.Hosts>
        <EnvCard.Footer>
          <EnvCard.Health status="warning">provisioning</EnvCard.Health>
          <EnvCard.Ttl>18h remaining</EnvCard.Ttl>
        </EnvCard.Footer>
      </EnvCard>
    </div>
  );
}

export const Default: Story = {
  render: (args) => <ControlledCard {...args} />,
};

export const Gallery: Story = {
  render: () => <CardDemo />,
};

/* Loading-state capture for the boneyard registry.
 *
 * `<Skeleton name="env-card" loading fixture={…}>` renders the real
 * card during `yarn workspace ui bones:build`, so the captured bones
 * mirror the production EnvCard shape (header, host rows, footer).
 * Consumers (env-manager dashboard) render the same `name="env-card"`
 * with `loading={isLoading}` and pick the bones up automatically. */
function LoadingFixture() {
  return (
    <div className="max-w-[420px]">
      <EnvCard
        type="ephemeral"
        title="invite-flow · pr-1276"
        meta="feature/invite-flow · 8f3a91c"
        badgeLabel="ephemeral"
      >
        <EnvCard.Hosts>
          <EnvCard.HostRow label="Backend" value="chronicle-pr-1276.fly.dev" />
          <EnvCard.HostRow label="Frontend" value="chronicle-pr-1276.vercel.app" />
        </EnvCard.Hosts>
        <EnvCard.Footer>
          <EnvCard.Health status="hot">2m ago</EnvCard.Health>
          <EnvCard.Ttl>TTL 18h</EnvCard.Ttl>
        </EnvCard.Footer>
      </EnvCard>
    </div>
  );
}

export const Loading: Story = {
  render: () => (
    <Skeleton name="env-card" loading fixture={<LoadingFixture />}>
      <LoadingFixture />
    </Skeleton>
  ),
};
