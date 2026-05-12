import type { Meta, StoryObj } from "@storybook/react";
import { ScanLoader } from "./scan-loader";

const meta: Meta<typeof ScanLoader> = {
  title: "Primitives/ScanLoader",
  component: ScanLoader,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof ScanLoader>;

export const Default: Story = {
  render: () => (
    <div className="w-[420px]">
      <ScanLoader />
    </div>
  ),
};

export const InContext: Story = {
  name: "In context (provisioning A.5)",
  render: () => (
    <div className="w-[420px] flex flex-col gap-s-3">
      <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
        Provisioning
      </span>
      <ScanLoader />
      <span className="font-mono text-mono-sm text-ink-dim">
        workos.organizations.create · users.create · auth.mintJwt
      </span>
    </div>
  ),
};

export const Compact: Story = {
  name: "Compact (h-[2px])",
  render: () => (
    <div className="w-[200px]">
      <ScanLoader className="h-[2px]" />
    </div>
  ),
};
