import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { Skeleton } from "./skeleton";
import { Avatar, AvatarFallback } from "./avatar";
import { Badge } from "./badge";
import { Button } from "./button";
import { Panel, PanelContent, PanelHeader } from "./panel";

/*
 * Stories for the boneyard-backed `<Skeleton>` wrapper.
 *
 * The pattern: render the real component twice in the story — once
 * with `loading={true}` (skeleton state) and once with `loading={false}`
 * (real content) — so the bone capture run can snapshot both shapes.
 *
 * Run `yarn workspace ui bones:build` to capture bone descriptors for
 * any `<Skeleton name="...">` rendered by these stories. Captured
 * bones land in `packages/ui/src/bones/`, are committed with the PR,
 * and resolve at runtime via `src/bones/registry.ts`.
 */

const meta: Meta<typeof Skeleton> = {
  title: "Primitives/Skeleton",
  component: Skeleton,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof Skeleton>;

function SampleProfileCard() {
  return (
    <Panel className="w-[420px]">
      <PanelHeader title="Workspace member" />
      <PanelContent className="flex flex-col gap-s-4">
        <div className="flex items-center gap-s-3">
          <Avatar size="md">
            <AvatarFallback>AS</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-sans text-sm font-medium text-ink-hi">
              Ayman Saleh
            </span>
            <span className="font-mono text-xs text-ink-dim">
              ayman@chroniclelabs.org
            </span>
          </div>
        </div>
        <p className="text-sm text-ink">
          Owner of the Chronicle Labs production workspace. Joined April 26,
          2026; last active two minutes ago.
        </p>
        <div className="flex flex-wrap gap-s-2">
          <Badge variant="neutral">Owner</Badge>
          <Badge variant="neutral">Billing</Badge>
          <Badge variant="neutral">SSO</Badge>
        </div>
        <Button size="sm" variant="secondary">
          View profile
        </Button>
      </PanelContent>
    </Panel>
  );
}

/* Hosting story for the bone-capture pass — every breakpoint snapshot
 * picks up `<Skeleton name="profile-card" loading>` and stores the bones.
 * The `fixture` prop renders the real component during capture, so the
 * extractor sees the same DOM you ship in production. */
export const ProfileCard: Story = {
  render: () => (
    <Skeleton
      name="profile-card"
      loading
      fixture={<SampleProfileCard />}
    >
      <SampleProfileCard />
    </Skeleton>
  ),
};

/* Toggleable variant lets you flip between the loaded and skeleton
 * states inside the canvas. Useful for double-checking that the
 * captured bones still cover the surface after a component refactor. */
export const Toggle: Story = {
  render: () => {
    function Demo() {
      const [loading, setLoading] = React.useState(true);
      return (
        <div className="flex flex-col gap-s-4">
          <Button size="sm" onClick={() => setLoading((v) => !v)}>
            {loading ? "Show content" : "Show skeleton"}
          </Button>
          <Skeleton
            name="profile-card"
            loading={loading}
            fixture={<SampleProfileCard />}
          >
            <SampleProfileCard />
          </Skeleton>
        </div>
      );
    }
    return <Demo />;
  },
};
