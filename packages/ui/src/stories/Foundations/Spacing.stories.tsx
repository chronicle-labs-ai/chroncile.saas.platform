import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { spacing } from "../../tokens/spacing";

function ScaleRow({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center gap-s-4 border-b border-hairline py-s-3">
      <span className="w-[60px] font-mono text-mono text-ink-dim">
        s-{name}
      </span>
      <span className="w-[100px] font-mono text-mono-sm text-ink-lo">
        {value}
      </span>
      <span className="h-[12px] bg-ember" style={{ width: value }} />
    </div>
  );
}

function SpacingScale() {
  return (
    <div className="flex flex-col p-s-10">
      <div className="font-mono text-mono uppercase tracking-eyebrow text-ember mb-s-5">
        Spacing scale
      </div>
      {Object.entries(spacing).map(([k, v]) => (
        <ScaleRow key={k} name={k} value={v} />
      ))}
    </div>
  );
}

const meta: Meta<typeof SpacingScale> = {
  title: "Foundations/Spacing",
  component: SpacingScale,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof SpacingScale>;
export const Scale: Story = { render: () => <SpacingScale /> };
