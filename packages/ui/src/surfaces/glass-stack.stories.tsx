import type { Meta, StoryObj } from "@storybook/react";

import { GlassScene } from "./glass-scene";
import { GlassStack } from "./glass-stack";
import { LightSource } from "./light-source";

const meta: Meta<typeof GlassStack> = {
  title: "Surfaces/GlassStack",
  component: GlassStack,
  parameters: { layout: "padded" },
  argTypes: {
    count: { control: { type: "number", min: 1, max: 24 } },
    orientation: { control: "radio", options: ["vertical", "horizontal"] },
    blur: { control: "select", options: ["sm", "md", "lg", "xl", "2xl"] },
    highlight: { control: "radio", options: ["default", "soft"] },
    paneGrain: { control: { type: "number", min: 0, max: 1, step: 0.05 } },
  },
  args: {
    count: 11,
    orientation: "vertical",
    blur: "xl",
    highlight: "default",
    paneGrain: 0.8,
  },
};
export default meta;
type Story = StoryObj<typeof GlassStack>;

export const OverLight: Story = {
  render: (args) => (
    <div className="h-[420px] overflow-hidden rounded-md border border-hairline">
      <GlassScene background="obsidian" aspectRatio="16 / 9">
        <LightSource
          palette="ember"
          shape="pill"
          rotation={-118.42}
          flipY
          size={{ w: 550, h: 2800 }}
          position={{ x: "48%", y: "55%" }}
        />
        <GlassStack {...args} noise highlightAngle={268.16} />
      </GlassScene>
    </div>
  ),
};

export const Orientations: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-s-4">
      <div className="h-[280px] overflow-hidden rounded-md border border-hairline">
        <GlassScene background="obsidian" aspectRatio="1 / 1">
          <LightSource
            palette="ember"
            shape="pill"
            rotation={-90}
            size={{ w: 400, h: 1800 }}
          />
          <GlassStack
            count={10}
            orientation="vertical"
            blur="xl"
            paneGrain={0.8}
            noise
          />
        </GlassScene>
      </div>
      <div className="h-[280px] overflow-hidden rounded-md border border-hairline">
        <GlassScene background="obsidian" aspectRatio="1 / 1">
          <LightSource
            palette="ember"
            shape="pill"
            rotation={0}
            size={{ w: 1800, h: 400 }}
          />
          <GlassStack
            count={10}
            orientation="horizontal"
            blur="xl"
            paneGrain={0.8}
            noise
          />
        </GlassScene>
      </div>
    </div>
  ),
};
