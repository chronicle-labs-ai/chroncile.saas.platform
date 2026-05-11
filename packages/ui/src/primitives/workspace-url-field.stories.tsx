import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { WorkspaceUrlField } from "./workspace-url-field";

const meta: Meta<typeof WorkspaceUrlField> = {
  title: "Primitives/WorkspaceUrlField",
  component: WorkspaceUrlField,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof WorkspaceUrlField>;

export const Empty: Story = {
  render: () => {
    const [v, setV] = React.useState("");
    return (
      <div className="w-[460px]">
        <WorkspaceUrlField value={v} onChange={setV} />
      </div>
    );
  },
};

export const ValidSlug: Story = {
  render: () => {
    const [v, setV] = React.useState("acme-industries");
    return (
      <div className="w-[460px]">
        <WorkspaceUrlField value={v} onChange={setV} />
      </div>
    );
  },
};

export const Invalid: Story = {
  render: () => {
    const [v, setV] = React.useState("acme");
    return (
      <div className="flex w-[460px] flex-col gap-s-2">
        <WorkspaceUrlField value={v} onChange={setV} invalid />
        <span className="font-mono text-mono-sm text-event-red">
          That slug is already taken.
        </span>
      </div>
    );
  },
};

export const Live: Story = {
  name: "Live (auto-slugify)",
  render: () => {
    const [v, setV] = React.useState("Hello World 2026");
    React.useEffect(() => {
      // The component normalises on every change, but the seed
      // arrives un-normalised — flush once on mount.
      setV((prev) =>
        prev
          .toLowerCase()
          .trim()
          .replace(/[\s_]+/g, "-")
          .replace(/[^a-z0-9-]/g, "")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
      );
    }, []);
    return (
      <div className="flex w-[460px] flex-col gap-s-2">
        <WorkspaceUrlField value={v} onChange={setV} />
        <span className="font-mono text-mono-sm text-ink-dim">
          Type spaces, Caps, or symbols — slug normalises live.
        </span>
      </div>
    );
  },
};

export const Disabled: Story = {
  render: () => (
    <div className="w-[460px]">
      <WorkspaceUrlField value="acme-industries" onChange={() => {}} disabled />
    </div>
  ),
};
