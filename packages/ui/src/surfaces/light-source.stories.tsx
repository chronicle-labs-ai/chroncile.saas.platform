import type { Meta, StoryObj } from "@storybook/react";

import { GlassScene } from "./glass-scene";
import { LightSource } from "./light-source";

const meta: Meta<typeof LightSource> = {
  title: "Surfaces/LightSource",
  component: LightSource,
  parameters: { layout: "fullscreen" },
  argTypes: {
    palette: {
      control: "select",
      options: ["ember", "emberSoft", "emberMonolith", "tide"],
    },
    shape: { control: "radio", options: ["pill", "sheet", "blob"] },
    rotation: { control: { type: "number", min: -180, max: 180, step: 1 } },
    grain: { control: { type: "number", min: 0, max: 1, step: 0.01 } },
  },
  args: {
    palette: "ember",
    shape: "pill",
    rotation: 0,
    size: { w: "60%", h: "120%" },
    position: { x: "50%", y: "50%" },
  },
};
export default meta;
type Story = StoryObj<typeof LightSource>;

export const Solo: Story = {
  render: (args) => (
    <div className="h-[420px]">
      <GlassScene background="obsidian" aspectRatio="16 / 9">
        <LightSource {...args} />
      </GlassScene>
    </div>
  ),
};

export const Palettes: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-s-4 p-s-6">
      {(["ember", "emberSoft", "emberMonolith", "tide"] as const).map((p) => (
        <div
          key={p}
          className="h-[240px] overflow-hidden rounded-md border border-hairline"
        >
          <GlassScene background="obsidian" aspectRatio="16 / 9">
            <LightSource
              palette={p}
              shape="pill"
              rotation={-20}
              size={{ w: "70%", h: "160%" }}
            />
          </GlassScene>
          <div className="mt-s-2 font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
            {p}
          </div>
        </div>
      ))}
    </div>
  ),
};
